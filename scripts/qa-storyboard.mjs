import fs from 'node:fs';
import {assertProductionLock} from './lib/production-lock.mjs';
import {compileStoryboardShots} from '../src/shots/compile-shot.ts';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {StoryboardSchema} from '../src/schemas/storyboard.ts';
import {getSceneTimeline} from '../src/timeline/scene-timeline.ts';
import {getNodeState} from '../src/renderer/node-state.ts';
import {AudioConfigSchema} from '../src/schemas/audio-config.ts';
import {AudioManifestSchema} from '../src/schemas/audio-manifest.ts';
import {analyzeSceneAudioAlignment} from '../src/audio/timing.ts';
import {extractReviewFrames} from './extract-review-frames.mjs';
import {inspectOutput} from './inspect-output.mjs';
import {checkAssetInput, checkAudioInput, checkStoryboardInput, checkVisualInput} from './lib/preflight.mjs';
import {loadHandoffConfig, OUTPUT_PURPOSES} from './lib/output-purpose.mjs';
import {fingerprintFiles} from './lib/input-fingerprint.mjs';
import {inspectCleanNarratedRender} from './lib/render-receipt.mjs';
import {inspectTrailingSilence} from './lib/audio-tail.mjs';

function parseArgs(args) {
  const options = {expectAudio: false, executionMode: 'review'};
  const positional = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--expect-audio') options.expectAudio = true;
    else if (args[index] === '--audio-config') {
      options.audioConfigPath = args[index + 1];
      if (!options.audioConfigPath) throw new Error('--audio-config 需要一个路径。');
      index += 1;
    } else if (args[index] === '--mode') {
      options.executionMode = args[index + 1];
      if (!options.executionMode) throw new Error('--mode 需要 review 或 fast。');
      index += 1;
    } else if (args[index] === '--output-purpose') {
      options.outputPurpose = args[++index];
      if (!OUTPUT_PURPOSES.includes(options.outputPurpose)) throw new Error(`--output-purpose 只能是 ${OUTPUT_PURPOSES.join('、')}。`);
    } else positional.push(args[index]);
  }
  if (!['review', 'fast'].includes(options.executionMode)) {
    throw new Error('--mode 只能是 review 或 fast。');
  }
  if (positional.length < 2 || positional.length > 3) {
    throw new Error('Usage: npm run qa:storyboard -- <storyboard.json> <video.mp4> [review-dir] [--mode review|fast] [--output-purpose visual-preview|visual-master|in-project-video] [--audio-config <audio-config.json>] [--expect-audio]');
  }
  return {storyboardPath: positional[0], videoPath: positional[1], reviewDir: positional[2], ...options};
}

function invalidatePriorDelivery(storyboardPath, reportPath, report) {
  const projectPath = path.dirname(storyboardPath);
  const runPath = path.join(projectPath, 'run.json');
  if (!fs.existsSync(runPath)) return;
  const run = JSON.parse(fs.readFileSync(runPath, 'utf8'));
  if (!['release-ready', 'visual-handoff-ready'].includes(run.deliveryStatus) || !run.artifacts?.qaReport) return;
  if (path.resolve(projectPath, run.artifacts.qaReport) !== reportPath) return;
  run.deliveryStatus = report.automatedPassed
    ? (report.mode === 'audio-pilot' ? 'manual-review-pending' : report.mode === 'visual-master' ? 'visual-handoff-pending' : 'preview-only')
    : 'pending';
  delete run.deliveryReviewedAt;
  delete run.artifacts.deliverableVideo;
  delete run.artifacts.handoffVideo;
  run.updatedAt = new Date().toISOString();
  fs.writeFileSync(runPath, `${JSON.stringify(run, null, 2)}\n`);
}

export function runQa(options) {
  const executionMode = options.executionMode ?? 'review';
  const outputPurpose = options.outputPurpose ?? (options.expectAudio ? 'in-project-video' : 'visual-preview');
  if (outputPurpose === 'visual-master' && (options.audioConfigPath || options.expectAudio)) throw new Error('画面底片 QA 必须按无音轨检查。');
  const resolvedStoryboard = path.resolve(options.storyboardPath);
  const resolvedVideo = path.resolve(options.videoPath);
  const resolvedReviewDir = path.resolve(options.reviewDir ?? path.join(path.dirname(resolvedVideo), `${path.parse(resolvedVideo).name}-review`));
  fs.mkdirSync(resolvedReviewDir, {recursive: true});
  const reportPath = path.join(resolvedReviewDir, 'qa-report.json');
  const checks = {};
  const errors = [];
  let storyboard;

  try {
    const parsed = StoryboardSchema.safeParse(JSON.parse(fs.readFileSync(resolvedStoryboard, 'utf8')));
    if (!parsed.success) throw new Error(parsed.error.issues.map((item) => `${item.path.join('.')}: ${item.message}`).join('; '));
    storyboard = parsed.data;
    checks.schema = {passed: true};
  } catch (error) {
    checks.schema = {passed: false, error: error instanceof Error ? error.message : String(error)};
    errors.push(`schema: ${checks.schema.error}`);
  }

  if (storyboard) {
    if (storyboard.schemaVersion === '2.4') {
      try {checks.productionLock = {passed: true, hash: assertProductionLock(storyboard, resolvedVideo, undefined, path.dirname(resolvedStoryboard)).hash};}
      catch (error) {checks.productionLock = {passed: false, error: error.message}; errors.push(`production lock: ${error.message}`);}
    }
    let expectAudio = options.expectAudio || outputPurpose === 'in-project-video';
    if (options.audioConfigPath) {
      try {
        const config = AudioConfigSchema.parse(JSON.parse(fs.readFileSync(path.resolve(options.audioConfigPath), 'utf8')));
        if (outputPurpose === 'in-project-video' && !config.voiceover?.enabled) {
          errors.push('项目内讲解视频需要已启用的旁白音轨。');
        }
        expectAudio ||= Boolean(
          config.voiceover?.enabled || config.music?.enabled || config.sfx?.some((item) => item.enabled)
        );
      } catch {
        // inspectAudio below records the actionable schema or file error.
      }
    }
    const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const validationIssues = checkStoryboardInput(storyboard, {
      storyboardPath: resolvedStoryboard,
      styleRoot: path.join(projectRoot, 'styles'),
      executionMode
    });
    checks.storyboard = {passed: !validationIssues.some((item) => item.severity === 'error'), issues: validationIssues};
    if (!checks.storyboard.passed) errors.push('storyboard validation failed');
    checks.timeline = {
      passed: true,
      scenes: getSceneTimeline(storyboard).map(({scene, startFrame, endFrame, overlapInFrames, overlapOutFrames}) => {
        const lastActionEnd = Math.max(0, ...scene.beats.map((beat) => beat.start + beat.duration), scene.visual?.mediaFocus ? scene.visual.mediaFocus.start + scene.visual.mediaFocus.duration : 0);
        const stateFrames = [0, ...scene.beats.filter((beat) => beat.action === 'set-state').map((beat) => beat.start)];
        const peakCurrentNodes = Math.max(0, ...stateFrames.map((frame) => scene.layers.filter((layer) => getNodeState(layer, scene, frame) === 'current').length));
        return {
          id: scene.id, startFrame, endFrame, overlapInFrames, overlapOutFrames,
          primaryClaim: scene.primaryClaim ?? null,
          visualKind: scene.visual?.kind ?? null,
          visualExplanation: scene.visual?.explanation ?? null,
          attentionTarget: scene.attentionTarget ?? null,
          lastActionEnd,
          stableHoldFrames: scene.durationFrames - (overlapOutFrames > 0 ? overlapOutFrames : (scene.outro?.fadeFrames ?? (['2.3', '2.4'].includes(storyboard.schemaVersion) ? 0 : 24))) - lastActionEnd,
          peakCurrentNodes
        };
      })
    };

    const assetIssues = checkAssetInput(resolvedStoryboard);
    checks.assets = {passed: assetIssues.length === 0, issues: assetIssues};
    if (!checks.assets.passed) errors.push('asset validation failed');

    try {
      const {safeArea, textLayout} = checkVisualInput(storyboard);
      checks.safeArea = {passed: !safeArea.issues.some((item) => item.severity === 'error'), ...safeArea};
      if (!checks.safeArea.passed) errors.push('safe-area validation failed');
      checks.textLayout = {passed: !textLayout.some((item) => item.severity === 'error'), issues: textLayout};
      if (!checks.textLayout.passed) errors.push('text-layout validation failed');
    } catch (error) {
      checks.safeArea = {passed: false, error: error instanceof Error ? error.message : String(error)};
      errors.push(`safe area: ${checks.safeArea.error}`);
    }

    if (outputPurpose === 'visual-master') {
      try {
        const projectPath = path.dirname(resolvedStoryboard);
        const config = loadHandoffConfig(projectPath);
        const runPath = path.join(projectPath, 'run.json');
        if (!fs.existsSync(runPath)) throw new Error('画面底片 QA 需要 produce 的渲染记录。');
        const run = JSON.parse(fs.readFileSync(runPath, 'utf8'));
        if (run.outputPurpose !== 'visual-master' || !run.artifacts?.video || path.resolve(projectPath, run.artifacts.video) !== resolvedVideo) {
          throw new Error('画面底片 QA 与本次 produce 输出不匹配。');
        }
        if (run.outputFingerprint !== fingerprintFiles([resolvedVideo], projectPath)) throw new Error('画面底片在渲染后已变化。');
        if (run.visualHandoff?.facecamRightFraction !== config.facecamRightFraction || run.visualHandoff?.subtitleBottomFraction !== config.subtitleBottomFraction || run.visualHandoff?.timelinePolicy !== config.timelinePolicy) {
          throw new Error('画面预留配置与渲染时的配置不同，请重新渲染。');
        }
        const scale = Math.min(1 - config.facecamRightFraction, 1 - config.subtitleBottomFraction);
        const contentRight = storyboard.project.width * scale;
        const contentBottom = storyboard.project.height * scale;
        const facecamLeft = storyboard.project.width * (1 - config.facecamRightFraction);
        const subtitleTop = storyboard.project.height * (1 - config.subtitleBottomFraction);
        checks.visualMasterProfile = {
          passed: contentRight <= facecamLeft && contentBottom <= subtitleTop,
          renderProfileSuppressesNarrationCaptions: true,
          renderProfileSuppressesPreviewMarker: true,
          verification: 'renderer profile and output metadata; full visual playback remains required',
          facecamRightFraction: config.facecamRightFraction,
          subtitleBottomFraction: config.subtitleBottomFraction,
          sceneScale: scale,
          contentBounds: {right: contentRight, bottom: contentBottom},
          reservedFrom: {rightColumnLeft: facecamLeft, bottomBandTop: subtitleTop}
        };
        if (!checks.visualMasterProfile.passed) errors.push('visual master overlay clearance failed');
      } catch (error) {
        checks.visualMasterProfile = {passed: false, error: error instanceof Error ? error.message : String(error)};
        errors.push(`visual master profile: ${checks.visualMasterProfile.error}`);
      }
    }

    if (outputPurpose === 'in-project-video') {
      try {
        checks.narratedRenderProfile = inspectCleanNarratedRender(resolvedVideo);
      } catch (error) {
        checks.narratedRenderProfile = {passed: false, error: error.message};
        errors.push(`narrated render profile: ${error.message}`);
      }
    }

    try {
      checks.output = {passed: true, ...inspectOutput(resolvedVideo, storyboard, {expectAudio})};
    } catch (error) {
      checks.output = {passed: false, error: error instanceof Error ? error.message : String(error)};
      errors.push(`output: ${checks.output.error}`);
    }

    if (options.audioConfigPath) {
      try {
        const audio = checkAudioInput(resolvedStoryboard, options.audioConfigPath);
        checks.audio = {passed: !audio.needsRetiming, ...audio};
        if (!checks.audio.passed) errors.push('audio timing failed');
        const audioConfigPath = path.resolve(options.audioConfigPath);
        const manifestPath = path.join(path.dirname(audioConfigPath), 'audio-manifest.json');
        if (fs.existsSync(manifestPath)) {
          const manifest = AudioManifestSchema.parse(JSON.parse(fs.readFileSync(manifestPath, 'utf8')));
          const projectPath = path.dirname(resolvedStoryboard);
          if (path.resolve(projectPath, manifest.storyboardPath) === resolvedStoryboard && path.resolve(projectPath, manifest.audioConfigPath) === audioConfigPath) {
            const narratedScenes = getSceneTimeline(storyboard)
              .filter(({scene}) => scene.narration.trim())
              .map(({scene, startFrame, endFrame}) => ({sceneId: scene.id, startSec: startFrame / storyboard.project.fps, endSec: endFrame / storyboard.project.fps}));
            checks.sceneAudioAlignment = analyzeSceneAudioAlignment(narratedScenes, manifest.segments);
            if (!checks.sceneAudioAlignment.passed) errors.push('scene audio alignment failed');
          }
        }
      } catch (error) {
        checks.audio = {passed: false, error: error instanceof Error ? error.message : String(error)};
        errors.push(`audio: ${checks.audio.error}`);
      }
    } else {
      checks.audio = {passed: !expectAudio, skipped: !expectAudio, reason: expectAudio ? '需要 --audio-config 才能验证音频时长和字幕。' : '本次输出无需音轨'};
      if (!checks.audio.passed) errors.push('audio config missing');
    }

    if (outputPurpose === 'in-project-video' && checks.output?.passed && checks.output.audioStreams > 0) {
      try {
        const tail = inspectTrailingSilence(resolvedVideo, checks.output.durationSec);
        checks.audioTail = {
          passed: true,
          ...tail,
          issues: tail.durationSec > 2 ? [{
            severity: 'warning',
            path: 'audioTail',
            message: `片尾约 ${tail.durationSec.toFixed(2)} 秒低于 ${tail.noiseThresholdDb} dB；检查结束卡是否需要旁白或有来源的配乐收束。`
          }] : []
        };
      } catch (error) {
        checks.audioTail = {passed: false, error: error instanceof Error ? error.message : String(error)};
        errors.push(`audio tail: ${checks.audioTail.error}`);
      }
    }

    if (checks.output.passed) {
      try {
        const review = extractReviewFrames(resolvedVideo, resolvedStoryboard, resolvedReviewDir);
        const requiredLabels = ['2.3', '2.4'].includes(storyboard.schemaVersion)
          ? storyboard.scenes.flatMap((scene) => [`${scene.id}-complete`, `${scene.id}-before-handoff`]) : [];
        if (storyboard.schemaVersion === '2.4') requiredLabels.push(...compileStoryboardShots(storyboard).flatMap((plan) => plan.checkpoints.map((event) => `${plan.sceneId}-shot-${event.id}`)));
        const extractedLabels = new Set(review.frames.map((frame) => frame.label));
        const missingRequired = requiredLabels.filter((label) => !extractedLabels.has(label));
        checks.reviewFrames = {
          passed: review.frames.length >= (storyboard.project.durationSec >= 20 ? 6 : 1)
            && missingRequired.length === 0 && review.pages.length === Math.ceil(review.frames.length / 48),
          count: review.frames.length,
          missingRequired,
          contactSheet: review.contactSheet,
          contactSheets: review.contactSheets,
          pages: review.pages
        };
        if (!checks.reviewFrames.passed) errors.push('insufficient review frames');
      } catch (error) {
        checks.reviewFrames = {passed: false, error: error instanceof Error ? error.message : String(error)};
        errors.push(`review frames: ${checks.reviewFrames.error}`);
      }
    } else {
      checks.reviewFrames = {passed: false, skipped: true, reason: '输出元数据检查未通过。'};
    }
  }

  const automatedPassed = errors.length === 0;
  const report = {
    generatedAt: new Date().toISOString(),
    storyboard: resolvedStoryboard,
    video: resolvedVideo,
    executionMode,
    outputPurpose,
    mode: outputPurpose === 'visual-master' ? 'visual-master' : checks.output?.audioStreams > 0 ? 'audio-pilot' : 'silent-preview',
    automatedPassed,
    releaseReady: false,
    checks,
    manualReview: {
      required: true,
      fullPlaybackPassed: false,
      visualHierarchyPassed: false,
      textReadabilityPassed: false,
      transitionTimingPassed: false,
      audioQualityPassed: false,
      captionReadabilityPassed: false,
      assetRightsPassed: false,
      reviewer: '',
      reviewedAt: null,
      notes: ''
    },
    errors
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  invalidatePriorDelivery(resolvedStoryboard, reportPath, report);
  console.log(`QA ${automatedPassed ? 'AUTOMATED PASS' : 'FAILED'} ${reportPath}`);
  console.log('MANUAL REVIEW REQUIRED before releaseReady can be true.');
  return {report, reportPath};
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  try {
    const result = runQa(parseArgs(process.argv.slice(2)));
    if (!result.report.automatedPassed) process.exit(1);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
