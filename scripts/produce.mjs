import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {AudioConfigSchema} from '../src/schemas/audio-config.ts';
import {StoryboardSchema} from '../src/schemas/storyboard.ts';
import {assertProductionLock, productionDirectory} from './lib/production-lock.mjs';
import {runQa} from './qa-storyboard.mjs';
import {fingerprintFiles, fingerprintProjectInputs} from './lib/input-fingerprint.mjs';
import {checkAssetInput, checkStoryboardInput, checkVisualInput} from './lib/preflight.mjs';
import {loadHandoffConfig, nextMasterOutput, OUTPUT_PURPOSES, resolveOutputPurpose} from './lib/output-purpose.mjs';
import {assertStoryboardApproval} from './lib/storyboard-approval.mjs';
import {assertNarrationMatchesHandoff, buildNarrationHandoff, writeNarrationHandoff} from './lib/narration-handoff.mjs';
import {getSceneTimeline} from '../src/timeline/scene-timeline.ts';
import {selectTtsProfile} from './lib/tts-profiles.mjs';

const STAGE_NAMES = ['storyboard', 'validation', 'assets', 'safeArea', 'render', 'qa'];
const AUTOMATED_STATUSES = new Set(['generated', 'validated', 'reviewed', 'approved']);
const REVIEW_STATUSES = new Set(['reviewed', 'approved']);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const styleRoot = path.join(projectRoot, 'styles');

function parseArgs(args) {
  const options = {executionMode: 'review', from: 'storyboard', force: false, audioMode: 'auto'};
  const positional = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--mode') {
      options.executionMode = args[index + 1];
      if (!options.executionMode) throw new Error('--mode 需要 review 或 fast。');
      index += 1;
    } else if (arg === '--audio-config') {
      options.audioConfigPath = args[index + 1];
      if (!options.audioConfigPath) throw new Error('--audio-config 需要一个路径。');
      index += 1;
    } else if (arg === '--tts-config') {
      options.ttsConfigPath = args[index + 1];
      if (!options.ttsConfigPath) throw new Error('--tts-config 需要一个路径。');
      index += 1;
    } else if (arg === '--audio-mode') {
      options.audioMode = args[index + 1];
      if (!options.audioMode) throw new Error('--audio-mode 需要 silent、tts、external 或 auto。');
      index += 1;
    } else if (arg === '--output-purpose') {
      options.outputPurpose = args[++index];
      if (!OUTPUT_PURPOSES.includes(options.outputPurpose)) throw new Error(`--output-purpose 只能是 ${OUTPUT_PURPOSES.join('、')}。`);
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--retime-from-master') {
      options.retimeFromMaster = true;
    } else if (arg === '--from') {
      options.from = args[index + 1];
      if (!options.from) throw new Error('--from 需要一个阶段名称。');
      index += 1;
    } else {
      positional.push(arg);
    }
  }
  if (!['review', 'fast'].includes(options.executionMode)) {
    throw new Error('--mode 只能是 review 或 fast。');
  }
  if (!['silent', 'tts', 'external', 'auto'].includes(options.audioMode)) {
    throw new Error('--audio-mode 只能是 silent、tts、external 或 auto。');
  }
  if (options.outputPurpose && options.outputPurpose !== 'in-project-video' && !['silent', 'auto'].includes(options.audioMode)) {
    throw new Error(`${options.outputPurpose} 只能使用静音模式。`);
  }
  if (!STAGE_NAMES.includes(options.from)) {
    throw new Error(`--from 只能是 ${STAGE_NAMES.join('、')}。`);
  }
  if (positional.length !== 1) {
    throw new Error('Usage: npm run produce -- <project-dir> [--mode review|fast] [--output-purpose visual-preview|visual-master|in-project-video] [--audio-mode silent|tts|external|auto] [--audio-config <audio-config.json>] [--tts-config <tts-config.json>] [--retime-from-master] [--from storyboard|validation|assets|safeArea|render|qa] [--force]');
  }
  options.projectPath = path.resolve(process.cwd(), positional[0]);
  return options;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function createRunState(projectPath, executionMode, from, previousRun) {
  return {
    schemaVersion: '1.0',
    projectId: path.basename(projectPath),
    projectPath,
    executionMode,
    resumedFrom: from === 'storyboard' ? null : from,
    previousRun: previousRun ? {
      status: previousRun.status,
      updatedAt: previousRun.updatedAt
    } : null,
    status: 'running',
    deliveryStatus: 'pending',
    currentStage: 'storyboard',
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    stages: Object.fromEntries(STAGE_NAMES.map((name) => [name, 'pending'])),
    artifacts: {},
    warnings: [],
    errors: []
  };
}

function stageIndex(stage) {
  return STAGE_NAMES.indexOf(stage);
}

function shouldRunStage(from, stage) {
  return stageIndex(stage) >= stageIndex(from);
}

function readPreviousRun(projectPath) {
  const runPath = path.join(projectPath, 'run.json');
  if (!fs.existsSync(runPath)) return undefined;
  const value = readJson(runPath);
  if (!value || typeof value !== 'object' || !value.stages) {
    throw new Error(`run.json 无效，无法从已有运行恢复：${runPath}`);
  }
  return value;
}

function assertResumePreconditions(options, previousRun) {
  if (options.from === 'storyboard') return;
  if (!previousRun) {
    throw new Error(`无法从 ${options.from} 恢复：项目没有可用的 run.json。`);
  }
  if (previousRun.executionMode !== options.executionMode) {
    throw new Error(`无法从 ${options.from} 恢复：上一次运行是 ${previousRun.executionMode} 模式，本次是 ${options.executionMode} 模式。`);
  }
  if ((previousRun.audioConfigPath ?? null) !== (options.audioConfigPath ? path.resolve(options.audioConfigPath) : null)) {
    throw new Error('无法恢复：音频配置路径已变化，请从 storyboard 阶段重跑。');
  }
  const selectedTtsPath = options.ttsConfigPath
    ? path.resolve(options.ttsConfigPath)
    : previousRun.audioModeResolved === 'tts' ? selectTtsProfile(options.projectPath)?.path ?? null : null;
  if ((previousRun.ttsConfigPath ?? null) !== selectedTtsPath) {
    throw new Error('无法恢复：TTS 配置路径已变化，请从 storyboard 阶段重跑。');
  }
  if ((previousRun.audioMode ?? 'auto') !== options.audioMode) {
    throw new Error('无法恢复：音频模式已变化，请从 storyboard 阶段重跑。');
  }
  if ((previousRun.outputPurposeRequested ?? null) !== (options.outputPurpose ?? null)) {
    throw new Error('无法恢复：输出用途已变化，请从 storyboard 阶段重跑。');
  }
  const currentFingerprint = fingerprintProjectInputs(options.projectPath, styleRoot, options.audioConfigPath, selectedTtsPath, {includeAudio: !['visual-preview', 'visual-master'].includes(options.outputPurpose)});
  if (!previousRun.inputFingerprint || previousRun.inputFingerprint !== currentFingerprint) {
    throw new Error('无法恢复：storyboard、素材、风格或音频输入与上次运行不同。请先同步有效的 storyboard.json，再从 storyboard 阶段重跑。');
  }
  const start = stageIndex(options.from);
  for (let index = 0; index < start; index += 1) {
    const stage = STAGE_NAMES[index];
    if (!['completed', 'reused'].includes(previousRun.stages[stage])) {
      throw new Error(`无法从 ${options.from} 恢复：前置阶段 ${stage} 上一次没有成功完成。`);
    }
  }
}

function assertReusableStoryboardStatus(storyboard, executionMode, from) {
  if (stageIndex(from) < stageIndex('render')) return;
  const allowed = executionMode === 'fast' ? AUTOMATED_STATUSES : REVIEW_STATUSES;
  if (!allowed.has(storyboard.project.status) || (executionMode === 'fast' && storyboard.project.status === 'generated')) {
    throw new Error(`无法从 ${from} 恢复：当前 storyboard 状态 "${storyboard.project.status}" 不能跳过前置校验。`);
  }
}

function persistRun(projectPath, run) {
  run.updatedAt = new Date().toISOString();
  writeJson(path.join(projectPath, 'run.json'), run);
}

function setStage(run, stage, status) {
  run.currentStage = stage;
  run.stages[stage] = status;
}

function addWarnings(run, items) {
  for (const item of items) {
    const value = typeof item === 'string' ? item : `${item.path}: ${item.message}`;
    if (!run.warnings.includes(value)) run.warnings.push(value);
  }
}

function parseStoryboard(storyboardPath) {
  const parsed = StoryboardSchema.safeParse(readJson(storyboardPath));
  if (!parsed.success) {
    throw new Error(`storyboard.json 无效：${parsed.error.issues.map((item) => `${item.path.join('.')}: ${item.message}`).join('; ')}`);
  }
  return parsed.data;
}

export function promoteDraftStoryboard(draftValue) {
  const parsed = StoryboardSchema.parse(draftValue);
  if (parsed.project.status !== 'draft') return parsed;
  return {
    ...parsed,
    project: {
      ...parsed.project,
      status: 'generated'
    }
  };
}

function prepareStoryboard(options, run) {
  const storyboardPath = path.join(options.projectPath, 'storyboard.json');
  const draftPath = path.join(options.projectPath, 'storyboard.draft.json');
  if (fs.existsSync(storyboardPath)) {
    run.artifacts.storyboard = path.relative(options.projectPath, storyboardPath);
    return {storyboardPath, storyboard: parseStoryboard(storyboardPath)};
  }
  if (options.executionMode !== 'fast' || !fs.existsSync(draftPath)) {
    throw new Error('缺少 storyboard.json。review 模式需要人工审核后的 storyboard.json；fast 模式可从 storyboard.draft.json 自动生成。');
  }
  const storyboard = promoteDraftStoryboard(readJson(draftPath));
  writeJson(storyboardPath, storyboard);
  run.artifacts.draftStoryboard = path.relative(options.projectPath, draftPath);
  run.artifacts.storyboard = path.relative(options.projectPath, storyboardPath);
  return {storyboardPath, storyboard};
}

function resolveAudioConfig(options) {
  const defaultPath = path.join(options.projectPath, 'audio', 'audio-config.json');
  const configuredPath = options.audioConfigPath
    ? path.resolve(process.cwd(), options.audioConfigPath)
    : (fs.existsSync(defaultPath) ? defaultPath : undefined);
  if (!configuredPath) return undefined;
  const config = AudioConfigSchema.parse(readJson(configuredPath));
  const enabled = Boolean(
    config.voiceover?.enabled ||
    config.music?.enabled ||
    config.sfx?.some((item) => item.enabled)
  );
  return {path: configuredPath, enabled};
}

function resolveTtsConfig(options) {
  return selectTtsProfile(options.projectPath, options.ttsConfigPath)?.path;
}

function resolveAudioMode(options) {
  if (options.audioMode !== 'auto') return options.audioMode;
  if (options.executionMode === 'fast' && resolveTtsConfig(options)) return 'tts';
  if (resolveTtsConfig(options)) return 'tts';
  const external = resolveAudioConfig(options);
  return external?.enabled ? 'external' : 'silent';
}

function requireEnabledAudio(audio, mode) {
  if (!audio?.enabled) {
    throw new Error(`${mode} 模式需要一个已启用且可读取的 audio-config.json。`);
  }
  return audio;
}

function runCommand(args) {
  const result = spawnSync(process.execPath, ['--import', 'tsx/esm', ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: 'inherit'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`命令执行失败，退出码：${result.status ?? 'unknown'}`);
}

function completeAutomatedStatus(storyboardPath, storyboard, executionMode) {
  if (executionMode !== 'fast' || storyboard.project.status !== 'generated') return storyboard;
  const validated = {
    ...storyboard,
    project: {
      ...storyboard.project,
      status: 'validated'
    }
  };
  writeJson(storyboardPath, validated);
  return validated;
}

export function runProduction(options) {
  const executionMode = options.executionMode ?? 'review';
  const from = options.from ?? 'storyboard';
  const projectPath = path.resolve(options.projectPath);
  options = {...options, executionMode, from, projectPath, audioMode: options.audioMode ?? 'auto'};
  if (!fs.existsSync(projectPath) || !fs.statSync(projectPath).isDirectory()) {
    throw new Error(`项目目录不存在：${projectPath}`);
  }

  const previousRun = readPreviousRun(projectPath);
  assertResumePreconditions({...options, executionMode, from, projectPath}, previousRun);
  const run = createRunState(projectPath, executionMode, from, previousRun);
  run.audioConfigPath = options.audioConfigPath ? path.resolve(options.audioConfigPath) : null;
  run.ttsConfigPath = options.ttsConfigPath ? path.resolve(options.ttsConfigPath) : null;
  run.audioMode = options.audioMode;
  run.outputPurposeRequested = options.outputPurpose ?? null;
  run.retimeFromMaster = Boolean(options.retimeFromMaster);
  if (previousRun?.outputPurpose === 'visual-master' && previousRun.artifacts?.visualHandoff) {
    run.sourceVisualMaster = {video: previousRun.artifacts.video, handoff: previousRun.artifacts.visualHandoff};
  } else if (previousRun?.sourceVisualMaster) {
    run.sourceVisualMaster = previousRun.sourceVisualMaster;
  }
  if (previousRun && from !== 'storyboard') {
    run.artifacts = {...(previousRun.artifacts ?? {})};
    run.outputFingerprint = previousRun.outputFingerprint;
    for (let index = 0; index < stageIndex(from); index += 1) {
      run.stages[STAGE_NAMES[index]] = 'reused';
    }
  }
  persistRun(projectPath, run);
  let storyboardPath;
  let storyboard;
  let audio;

  try {
    setStage(run, 'storyboard', shouldRunStage(from, 'storyboard') ? 'running' : 'reused');
    persistRun(projectPath, run);
    ({storyboardPath, storyboard} = prepareStoryboard(options, run));
    if (executionMode === 'review') assertStoryboardApproval(projectPath);
    if (shouldRunStage(from, 'storyboard')) setStage(run, 'storyboard', 'completed');
    assertReusableStoryboardStatus(storyboard, executionMode, from);
    run.inputFingerprint = fingerprintProjectInputs(projectPath, styleRoot, options.audioConfigPath, options.ttsConfigPath, {includeAudio: !['visual-preview', 'visual-master'].includes(options.outputPurpose)});
    persistRun(projectPath, run);

    if (!shouldRunStage(from, 'validation')) {
      setStage(run, 'validation', 'reused');
      persistRun(projectPath, run);
    } else {
      setStage(run, 'validation', 'running');
      persistRun(projectPath, run);
      const validationIssues = checkStoryboardInput(storyboard, {
        storyboardPath,
        styleRoot,
        executionMode
      });
      addWarnings(run, validationIssues.filter((item) => item.severity === 'warning'));
      const validationErrors = validationIssues.filter((item) => item.severity === 'error');
      if (validationErrors.length > 0) {
        run.errors.push(...validationErrors.map((item) => `${item.path}: ${item.message}`));
        setStage(run, 'validation', 'blocked');
        run.status = 'blocked';
        persistRun(projectPath, run);
        return run;
      }
      setStage(run, 'validation', 'completed');
      persistRun(projectPath, run);
    }

    if (!shouldRunStage(from, 'assets')) {
      setStage(run, 'assets', 'reused');
      persistRun(projectPath, run);
    } else {
      setStage(run, 'assets', 'running');
      persistRun(projectPath, run);
      const assetIssues = checkAssetInput(storyboardPath);
      if (assetIssues.length > 0) {
        run.errors.push(...assetIssues);
        setStage(run, 'assets', 'blocked');
        run.status = 'blocked';
        persistRun(projectPath, run);
        return run;
      }
      setStage(run, 'assets', 'completed');
      persistRun(projectPath, run);
    }

    if (!shouldRunStage(from, 'safeArea')) {
      setStage(run, 'safeArea', 'reused');
      persistRun(projectPath, run);
    } else {
      setStage(run, 'safeArea', 'running');
      persistRun(projectPath, run);
      const {safeArea, textLayout} = checkVisualInput(storyboard);
      addWarnings(run, safeArea.issues.filter((item) => item.severity === 'warning').map((item) => `scene ${item.sceneId}, layer ${item.layerId}: ${item.message}`));
      addWarnings(run, textLayout.filter((item) => item.severity === 'warning').map((item) => `scene ${item.sceneId}, ${item.target}: ${item.message}`));
      const safeAreaErrors = safeArea.issues.filter((item) => item.severity === 'error');
      const layoutErrors = textLayout.filter((item) => item.severity === 'error');
      if (safeAreaErrors.length > 0 || layoutErrors.length > 0) {
        run.errors.push(...safeAreaErrors.map((item) => `scene ${item.sceneId}, layer ${item.layerId}: ${item.message}`));
        run.errors.push(...layoutErrors.map((item) => `scene ${item.sceneId}, ${item.target}: ${item.message}`));
        setStage(run, 'safeArea', 'blocked');
        run.status = 'blocked';
        persistRun(projectPath, run);
        return run;
      }
      setStage(run, 'safeArea', 'completed');
      storyboard = completeAutomatedStatus(storyboardPath, storyboard, executionMode);
      run.inputFingerprint = fingerprintProjectInputs(projectPath, styleRoot, options.audioConfigPath, undefined, {includeAudio: !['visual-preview', 'visual-master'].includes(options.outputPurpose)});
      persistRun(projectPath, run);
    }

    try {
      const audioMode = options.outputPurpose && options.outputPurpose !== 'in-project-video'
        ? 'silent'
        : resolveAudioMode({...options, projectPath});
      run.audioModeResolved = audioMode;
      run.outputPurpose = resolveOutputPurpose(options.outputPurpose, audioMode);
      if (run.outputPurpose === 'in-project-video' && run.sourceVisualMaster?.handoff) {
        const priorHandoff = readJson(path.resolve(projectPath, run.sourceVisualMaster.handoff));
        const previousNarration = path.join(path.dirname(path.resolve(projectPath, run.sourceVisualMaster.handoff)), 'narration-manifest.json');
        assertNarrationMatchesHandoff(projectPath, storyboard, previousNarration);
        const currentStoryboardFingerprint = fingerprintFiles([storyboardPath], projectPath);
        const storyboardChanged = currentStoryboardFingerprint !== priorHandoff.storyboardFingerprint;
        if (storyboardChanged && priorHandoff.timelinePolicy === 'picture-locked' && !options.retimeFromMaster) {
          throw new Error('前一版画面底片已锁定时间线；若要按新配音调整画面，请明确使用 --retime-from-master，旧底片会保留。');
        }
        run.sourceVisualMaster = {
          video: run.sourceVisualMaster.video,
          handoff: run.sourceVisualMaster.handoff,
          timelinePolicy: priorHandoff.timelinePolicy,
          storyboardChanged
        };
      }
      if (run.outputPurpose === 'visual-master') {
        buildNarrationHandoff(projectPath, storyboard);
        const handoff = loadHandoffConfig(projectPath);
        run.visualHandoff = {
          facecamRightFraction: handoff.facecamRightFraction,
          subtitleBottomFraction: handoff.subtitleBottomFraction,
          timelinePolicy: handoff.timelinePolicy
        };
      }
      if (audioMode === 'tts') {
        const selectedTts = selectTtsProfile(projectPath, options.ttsConfigPath);
        if (!selectedTts) throw new Error('没有可用的 TTS 配置；请选择静音预览、画面底片，或先准备外部音频。');
        run.ttsProfile = {id: selectedTts.id, provider: selectedTts.provider, voiceType: selectedTts.voiceType, model: selectedTts.model};
        run.ttsConfigPath = selectedTts.path;
        const generatedAudioConfigPath = path.join(projectPath, 'audio', 'audio-config.tts.json');
        if (shouldRunStage(from, 'render')) {
          const ttsArgs = [
            'scripts/synthesize-voiceover.mjs',
            projectPath
          ];
          ttsArgs.push('--tts-config', selectedTts.path);
          ttsArgs.push('--reuse');
          if (options.force) ttsArgs.push('--force');
          runCommand(ttsArgs);
        } else if (!fs.existsSync(generatedAudioConfigPath)) {
          throw new Error(`无法从 ${from} 恢复：缺少 TTS 音频配置 ${generatedAudioConfigPath}，请从 render 阶段重跑。`);
        }
        run.artifacts.audioManifest = 'audio/audio-manifest.json';
        run.artifacts.ttsAudioConfig = 'audio/audio-config.tts.json';
        audio = requireEnabledAudio(
          resolveAudioConfig({...options, projectPath, audioConfigPath: generatedAudioConfigPath}),
          'tts'
        );
        run.inputFingerprint = fingerprintProjectInputs(projectPath, styleRoot, options.audioConfigPath, selectedTts.path);
        persistRun(projectPath, run);
      } else if (audioMode === 'external') {
        const priorScript = path.join(projectPath, 'output', 'script-handoff', 'narration-manifest.json');
        assertNarrationMatchesHandoff(projectPath, storyboard, priorScript);
        audio = requireEnabledAudio(resolveAudioConfig({...options, projectPath}), 'external');
      } else {
        audio = undefined;
      }
    } catch (error) {
      setStage(run, 'render', 'failed');
      throw error;
    }
    if (run.outputPurpose === 'in-project-video' && audio?.path) {
      const config = AudioConfigSchema.parse(readJson(audio.path));
      if (!config.voiceover?.enabled) throw new Error('项目内讲解视频需要已启用的旁白；只有配乐或音效不构成讲解成片。');
    }
    const outputName = run.outputPurpose === 'visual-master' ? path.basename(nextMasterOutput(projectPath, options.force))
      : run.outputPurpose === 'in-project-video' ? 'pilot-audio.mp4' : 'preview-silent.mp4';
    const previousOutput = previousRun?.artifacts?.video;
    const previousReviewDir = previousRun?.artifacts?.reviewDir;
    const outputPath = previousOutput && from !== 'storyboard'
      ? path.resolve(projectPath, previousOutput)
      : path.join(projectPath, 'output', outputName);
    const reviewDir = previousReviewDir && from !== 'storyboard'
      ? path.resolve(projectPath, previousReviewDir)
      : path.join(projectPath, 'output', `${path.parse(outputName).name}-review`);
    run.artifacts.video = path.relative(projectPath, outputPath);
    run.artifacts.reviewDir = path.relative(projectPath, reviewDir);

    if (!shouldRunStage(from, 'render')) {
      if (!fs.existsSync(outputPath)) throw new Error(`无法从 qa 恢复：输出视频不存在：${outputPath}`);
      if (!previousRun.outputFingerprint || previousRun.outputFingerprint !== fingerprintFiles([outputPath], projectPath)) {
        throw new Error('无法从 qa 恢复：输出视频与上次渲染结果不同，请从 render 阶段重跑。');
      }
      const lock = assertProductionLock(storyboard, outputPath, undefined, options.projectPath);
      if (lock && previousRun.productionLockHash !== lock.hash) throw new Error('无法恢复：run 与生产锁不匹配。');
      if (lock) run.productionLockHash = lock.hash;
      setStage(run, 'render', 'reused');
      persistRun(projectPath, run);
    } else {
      setStage(run, 'render', 'running');
      persistRun(projectPath, run);
      const renderArgs = [
        'scripts/render-storyboard.mjs',
        storyboardPath,
        outputPath,
        '--mode',
        executionMode
      ];
      if (audio?.path) renderArgs.push('--audio-config', audio.path);
      renderArgs.push('--output-purpose', run.outputPurpose);
      if (options.force) renderArgs.push('--force');
      runCommand(renderArgs);
      setStage(run, 'render', 'completed');
      run.outputFingerprint = fingerprintFiles([outputPath], projectPath);
      const lock = assertProductionLock(storyboard, outputPath, undefined, options.projectPath);
      if (lock) {
        run.productionLockHash = lock.hash;
        run.artifacts.productionLock = path.relative(projectPath, path.join(productionDirectory(outputPath), 'production-lock.json'));
        run.artifacts.resolvedShotPlan = path.relative(projectPath, path.join(productionDirectory(outputPath), 'resolved-shot-plan.json'));
      }
      persistRun(projectPath, run);
    }

    if (!shouldRunStage(from, 'qa')) {
      setStage(run, 'qa', 'reused');
      persistRun(projectPath, run);
    } else {
      setStage(run, 'qa', 'running');
      persistRun(projectPath, run);
      const qa = runQa({
        storyboardPath,
        videoPath: outputPath,
        reviewDir,
        audioConfigPath: audio?.path,
        expectAudio: Boolean(audio?.enabled),
        executionMode,
        outputPurpose: run.outputPurpose
      });
      run.artifacts.qaReport = path.relative(projectPath, qa.reportPath);
      addWarnings(run, qa.report.checks.audioTail?.issues ?? []);
      if (!qa.report.automatedPassed) {
        run.errors.push(...qa.report.errors);
        setStage(run, 'qa', 'blocked');
        run.status = 'blocked';
        persistRun(projectPath, run);
        return run;
      }
      setStage(run, 'qa', 'completed');
    }
    run.status = 'completed';
    if (run.outputPurpose === 'visual-master') {
      const handoffDir = path.join(reviewDir, 'handoff');
      const narration = writeNarrationHandoff(projectPath, storyboard, handoffDir, options.force);
      const timingPath = path.join(handoffDir, 'shot-timing.json');
      const timing = getSceneTimeline(storyboard).map(({scene, startFrame, endFrame}) => ({
        sceneId: scene.id,
        startFrame,
        endFrame,
        startSec: startFrame / storyboard.project.fps,
        endSec: endFrame / storyboard.project.fps,
        narration: scene.narration
      }));
      writeJson(timingPath, {schemaVersion: '1.0', fps: storyboard.project.fps, durationSec: storyboard.project.durationSec, timelinePolicy: run.visualHandoff.timelinePolicy, scenes: timing});
      const packagePath = path.join(handoffDir, 'visual-handoff.json');
      writeJson(packagePath, {
        schemaVersion: '1.0',
        video: path.relative(projectPath, outputPath),
        videoFingerprint: run.outputFingerprint,
        storyboardFingerprint: narration.handoff.storyboardFingerprint,
        scriptFingerprint: narration.handoff.scriptFingerprint,
        width: storyboard.project.width,
        height: storyboard.project.height,
        fps: storyboard.project.fps,
        durationSec: storyboard.project.durationSec,
        ...run.visualHandoff,
        manualReviewRequired: true
      });
      run.artifacts.narrationScript = path.relative(projectPath, narration.markdownPath);
      run.artifacts.shotTiming = path.relative(projectPath, timingPath);
      run.artifacts.visualHandoff = path.relative(projectPath, packagePath);
      run.handoffFingerprint = fingerprintFiles([narration.markdownPath, narration.manifestPath, timingPath, packagePath], projectPath);
      run.deliveryStatus = 'visual-handoff-pending';
    } else {
      run.deliveryStatus = run.outputPurpose === 'in-project-video' ? 'manual-review-pending' : 'preview-only';
    }
    run.currentStage = 'done';
    persistRun(projectPath, run);
    return run;
  } catch (error) {
    run.status = 'failed';
    run.errors.push(error instanceof Error ? error.message : String(error));
    if (run.currentStage && run.stages[run.currentStage] === 'running') {
      run.stages[run.currentStage] = 'failed';
    }
    persistRun(projectPath, run);
    throw error;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  try {
    const run = runProduction(parseArgs(process.argv.slice(2)));
    console.log(`PRODUCE ${run.status.toUpperCase()} ${path.join(run.projectPath, 'run.json')}`);
    if (run.warnings.length > 0) console.log(`WARNINGS ${run.warnings.length}`);
    if (run.errors.length > 0) {
      for (const error of run.errors) console.error(`ERROR ${error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
