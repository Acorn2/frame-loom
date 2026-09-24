import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {StoryboardSchema} from '../src/schemas/storyboard.ts';
import {getSceneTimeline} from '../src/timeline/scene-timeline.ts';
import {getNodeState} from '../src/renderer/node-state.ts';
import {AudioConfigSchema} from '../src/schemas/audio-config.ts';
import {extractReviewFrames} from './extract-review-frames.mjs';
import {inspectOutput} from './inspect-output.mjs';
import {checkAssetInput, checkAudioInput, checkStoryboardInput, checkVisualInput} from './lib/preflight.mjs';

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
    } else positional.push(args[index]);
  }
  if (!['review', 'fast'].includes(options.executionMode)) {
    throw new Error('--mode 只能是 review 或 fast。');
  }
  if (positional.length < 2 || positional.length > 3) {
    throw new Error('Usage: npm run qa:storyboard -- <storyboard.json> <video.mp4> [review-dir] [--mode review|fast] [--audio-config <audio-config.json>] [--expect-audio]');
  }
  return {storyboardPath: positional[0], videoPath: positional[1], reviewDir: positional[2], ...options};
}

export function runQa(options) {
  const executionMode = options.executionMode ?? 'review';
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
    let expectAudio = options.expectAudio;
    if (options.audioConfigPath) {
      try {
        const config = AudioConfigSchema.parse(JSON.parse(fs.readFileSync(path.resolve(options.audioConfigPath), 'utf8')));
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
        const lastActionEnd = Math.max(0, ...scene.beats.map((beat) => beat.start + beat.duration));
        const stateFrames = [0, ...scene.beats.filter((beat) => beat.action === 'set-state').map((beat) => beat.start)];
        const peakCurrentNodes = Math.max(0, ...stateFrames.map((frame) => scene.layers.filter((layer) => getNodeState(layer, scene, frame) === 'current').length));
        return {
          id: scene.id, startFrame, endFrame, overlapInFrames, overlapOutFrames,
          primaryClaim: scene.primaryClaim ?? null,
          attentionTarget: scene.attentionTarget ?? null,
          lastActionEnd,
          stableHoldFrames: scene.durationFrames - (overlapOutFrames > 0 ? overlapOutFrames : (scene.outro?.fadeFrames ?? 24)) - lastActionEnd,
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
      } catch (error) {
        checks.audio = {passed: false, error: error instanceof Error ? error.message : String(error)};
        errors.push(`audio: ${checks.audio.error}`);
      }
    } else {
      checks.audio = {passed: !expectAudio, skipped: !expectAudio, reason: expectAudio ? '需要 --audio-config 才能验证音频时长和字幕。' : '静音预览'};
      if (!checks.audio.passed) errors.push('audio config missing');
    }

    if (checks.output.passed) {
      try {
        const review = extractReviewFrames(resolvedVideo, resolvedStoryboard, resolvedReviewDir);
        checks.reviewFrames = {passed: review.frames.length >= (storyboard.project.durationSec >= 20 ? 6 : 1), count: review.frames.length, contactSheet: review.contactSheet};
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
    mode: checks.output?.audioStreams > 0 ? 'audio-pilot' : 'silent-preview',
    automatedPassed,
    releaseReady: false,
    checks,
    manualReview: {
      required: true,
      fullPlaybackPassed: false,
      visualHierarchyPassed: false,
      textReadabilityPassed: false,
      transitionTimingPassed: false,
      notes: ''
    },
    errors
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
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
