import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {fingerprintFiles, fingerprintProjectInputs} from './lib/input-fingerprint.mjs';
import {inspectOutput} from './inspect-output.mjs';

const REQUIRED = ['fullPlaybackPassed', 'visualHierarchyPassed', 'textReadabilityPassed', 'overlaySafeAreaPassed', 'assetRightsPassed'];

function read(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
function write(filePath, value) { fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`); }

export function checkVisualHandoffEligibility(run, qa, review) {
  const issues = [];
  if (run.status !== 'completed' || run.deliveryStatus !== 'visual-handoff-pending' || run.outputPurpose !== 'visual-master' || run.stages?.qa !== 'completed') {
    issues.push('只有完成自动 QA 且等待视觉审片的画面底片才能确认交接。');
  }
  if (!qa?.automatedPassed || qa.mode !== 'visual-master' || qa.checks?.output?.passed !== true || qa.checks.output.audioStreams !== 0 || qa.checks?.visualMasterProfile?.passed !== true) {
    issues.push('画面底片未通过无音轨输出 QA。');
  }
  if (typeof review?.reviewer !== 'string' || !review.reviewer.trim() || typeof review?.notes !== 'string' || !review.notes.trim() || REQUIRED.some((key) => review?.[key] !== true)) {
    issues.push(`视觉审片记录需要 reviewer、notes 和 ${REQUIRED.join('、')} 全部为 true。`);
  }
  return issues;
}

export function approveVisualHandoff(projectDirectory, reviewFilePath) {
  const projectPath = path.resolve(projectDirectory);
  const runPath = path.join(projectPath, 'run.json');
  const run = read(runPath);
  const review = read(path.resolve(reviewFilePath));
  const videoPath = path.resolve(projectPath, run.artifacts.video);
  const qaPath = path.resolve(projectPath, run.artifacts.qaReport);
  const packagePath = path.resolve(projectPath, run.artifacts.visualHandoff);
  const qa = read(qaPath);
  const handoff = read(packagePath);
  const issues = checkVisualHandoffEligibility(run, qa, review);
  if (issues.length > 0) throw new Error(issues.join('\n'));
  if (!qa.video || path.resolve(qa.video) !== videoPath) throw new Error('画面底片 QA 指向的视频与 run.json 不一致。');
  if (run.outputFingerprint !== fingerprintFiles([videoPath], projectPath) || handoff.videoFingerprint !== run.outputFingerprint) {
    throw new Error('画面底片在自动 QA 后变化，请重新渲染并完整复核。');
  }
  const narrationManifestPath = path.join(path.dirname(path.resolve(projectPath, run.artifacts.narrationScript)), 'narration-manifest.json');
  const packageFingerprint = fingerprintFiles([
    path.resolve(projectPath, run.artifacts.narrationScript),
    narrationManifestPath,
    path.resolve(projectPath, run.artifacts.shotTiming),
    packagePath
  ], projectPath);
  if (run.handoffFingerprint !== packageFingerprint) throw new Error('讲稿或镜头交接包在 QA 后变化，请重新生成并复核。');
  const styleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'styles');
  if (run.inputFingerprint !== fingerprintProjectInputs(projectPath, styleRoot, run.audioConfigPath, run.ttsConfigPath, {includeAudio: false})) {
    throw new Error('讲稿、分镜、素材或预留区域在 QA 后变化，请重新运行 produce。');
  }
  const storyboard = read(path.join(projectPath, 'storyboard.json'));
  inspectOutput(videoPath, storyboard, {expectAudio: false});
  const reviewedAt = new Date().toISOString();
  qa.manualReview = {...review, reviewer: review.reviewer.trim(), notes: review.notes.trim(), reviewedAt, required: true};
  qa.visualHandoffReady = true;
  qa.approvedOutputFingerprint = run.outputFingerprint;
  qa.approvedInputFingerprint = run.inputFingerprint;
  write(qaPath, qa);
  run.deliveryStatus = 'visual-handoff-ready';
  run.deliveryReviewedAt = reviewedAt;
  run.artifacts.handoffVideo = run.artifacts.video;
  write(runPath, run);
  return {videoPath, packagePath};
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const [projectPath, reviewPath] = process.argv.slice(2);
  if (!projectPath || !reviewPath) { console.error('Usage: npm run approve:visual-handoff -- <project-dir> <review.json>'); process.exit(1); }
  try { console.log(`VISUAL HANDOFF READY ${approveVisualHandoff(projectPath, reviewPath).videoPath}`); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); }
}
