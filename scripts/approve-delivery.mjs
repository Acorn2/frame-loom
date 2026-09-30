import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {fingerprintFiles, fingerprintProjectInputs} from './lib/input-fingerprint.mjs';
import {inspectOutput} from './inspect-output.mjs';
import {AudioConfigSchema} from '../src/schemas/audio-config.ts';
import {inspectCleanNarratedRender} from './lib/render-receipt.mjs';

const REQUIRED_REVIEW_CHECKS = [
  'fullPlaybackPassed',
  'visualHierarchyPassed',
  'textReadabilityPassed',
  'transitionTimingPassed',
  'audioQualityPassed',
  'captionReadabilityPassed',
  'assetRightsPassed'
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function checkDeliveryEligibility(run, qa, review) {
  const issues = [];
  if (run.status !== 'completed' || run.stages?.qa !== 'completed') issues.push('生产流程和自动 QA 必须先完成。');
  if (!['tts', 'external'].includes(run.audioModeResolved)) issues.push('静音预览不能作为可交付视频。');
  if (run.outputPurpose && run.outputPurpose !== 'in-project-video') issues.push('只有项目内有声视频可以通过有声交付审核。');
  if (qa.checks?.narratedRenderProfile?.passed !== true) issues.push('干净有声候选文件必须通过渲染配置 QA。');
  if (!qa.automatedPassed || qa.mode !== 'audio-pilot' || qa.checks?.output?.passed !== true || !(qa.checks.output.audioStreams >= 1) || qa.checks?.audio?.passed !== true) {
    issues.push('带音频 MP4 必须通过输出和音频 QA。');
  }
  if (typeof review?.reviewer !== 'string' || !review.reviewer.trim()) issues.push('人工复核记录需要 reviewer。');
  if (typeof review?.notes !== 'string' || !review.notes.trim()) issues.push('人工复核记录需要 notes。');
  for (const check of REQUIRED_REVIEW_CHECKS) {
    if (review?.[check] !== true) issues.push(`人工复核记录需要 ${check}=true。`);
  }
  return issues;
}

export function approveDelivery(projectDirectory, reviewFilePath) {
  const projectPath = path.resolve(projectDirectory);
  const runPath = path.join(projectPath, 'run.json');
  const run = readJson(runPath);
  const videoPath = path.resolve(projectPath, run.artifacts?.video ?? '');
  const qaPath = path.resolve(projectPath, run.artifacts?.qaReport ?? '');
  if (!run.artifacts?.video || !run.artifacts?.qaReport) throw new Error('run.json 缺少视频或 QA 报告路径。');
  const qa = readJson(qaPath);
  const review = readJson(path.resolve(reviewFilePath));
  const issues = checkDeliveryEligibility(run, qa, review);
  if (issues.length > 0) throw new Error(issues.join('\n'));
  if (!qa.video || path.resolve(qa.video) !== videoPath) throw new Error('QA 报告指向的视频与 run.json 不一致。');
  const audioConfigPath = run.audioModeResolved === 'tts'
    ? path.join(projectPath, 'audio', 'audio-config.tts.json')
    : run.audioConfigPath ?? path.join(projectPath, 'audio', 'audio-config.json');
  const audioConfig = AudioConfigSchema.parse(readJson(audioConfigPath));
  if (!audioConfig.voiceover?.enabled) throw new Error('只有配乐或音效的输出不能作为讲解视频交付。');
  if (run.outputFingerprint !== fingerprintFiles([videoPath], projectPath)) throw new Error('视频已在 QA 后变化，请重新渲染和复核。');
  inspectCleanNarratedRender(videoPath);
  const styleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'styles');
  const currentInputs = fingerprintProjectInputs(projectPath, styleRoot, run.audioConfigPath, run.ttsConfigPath);
  if (run.inputFingerprint !== currentInputs) throw new Error('项目输入已在 QA 后变化，请重新运行 produce。');
  if (run.audioModeResolved === 'tts') {
    const ttsConfigPath = run.ttsConfigPath ?? path.join(projectPath, 'audio', 'tts-config.json');
    if (readJson(ttsConfigPath).provider === 'mock') throw new Error('mock TTS 仅用于测试，不能确认交付。');
  }
  const storyboard = readJson(path.join(projectPath, 'storyboard.json'));
  inspectOutput(videoPath, storyboard, {expectAudio: true});
  const reviewedAt = new Date().toISOString();
  qa.manualReview = {
    ...Object.fromEntries(REQUIRED_REVIEW_CHECKS.map((check) => [check, true])),
    reviewer: review.reviewer.trim(),
    notes: review.notes.trim(),
    reviewedAt,
    required: true
  };
  qa.releaseReady = true;
  qa.approvedInputFingerprint = currentInputs;
  qa.approvedOutputFingerprint = run.outputFingerprint;
  writeJson(qaPath, qa);
  run.deliveryStatus = 'release-ready';
  run.deliveryReviewedAt = reviewedAt;
  run.artifacts.deliverableVideo = run.artifacts.video;
  writeJson(runPath, run);
  return {videoPath, qaPath, reviewedAt};
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  const [projectDirectory, reviewFilePath] = process.argv.slice(2);
  if (!projectDirectory || !reviewFilePath) {
    console.error('Usage: npm run approve:delivery -- <project-dir> <manual-review.json>');
    process.exit(1);
  }
  try {
    const result = approveDelivery(projectDirectory, reviewFilePath);
    console.log(`DELIVERY READY ${result.videoPath}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
