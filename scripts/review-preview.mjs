import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {getSceneTimeline} from '../src/timeline/scene-timeline.ts';
import {projectRoot} from './lib/style-catalog.mjs';
import {acquireProjectLock, assertProjectOutput, writeProjectJson} from './lib/project-files.mjs';
import {clipFile, readFeedback, ledgerName} from './lib/review-ledger.mjs';
import {previewInputs, readBasis} from './lib/preview-gate.mjs';
import {reviewTimeline, timingImpact} from './lib/review-impact.mjs';
import {fingerprintFiles} from './lib/input-fingerprint.mjs';

const [directory, id, replacement, ...extra] = process.argv.slice(2);
if (!directory || !id || extra.length) throw new Error('Usage: npm run review:preview -- <project> <feedback-id> [replacement-scene-id]');
const project = fs.realpathSync(directory);
const release = acquireProjectLock(project, 'production');
let unpublished;
try {
  const issues = readFeedback(project);
  const issue = issues.find(item => item.id === id);
  if (!issue?.basisHash || issue.producedVersion) throw new Error('需要有原版记录的待处理反馈。');
  const basis = readBasis(project, issue);
  const {route} = basis;
  const file = assertProjectOutput(project, path.join(project, 'storyboard.json'));
  const inputs = previewInputs(project, route);
  const board = JSON.parse(fs.readFileSync(file, 'utf8'));
  const ids = replacement ? [replacement] : issue.scenes.map(scene => scene.id);
  const timeline = getSceneTimeline(board);
  const scenes = timeline.filter(item => ids.includes(item.scene.id));
  if (scenes.length !== ids.length) throw new Error('找不到反馈对应的镜头，请显式传入替代镜头 ID。');
  if (timeline.indexOf(scenes.at(-1)) - timeline.indexOf(scenes[0]) + 1 !== scenes.length) {
    throw new Error('原反馈对应的镜头已分开，请指定这次要看的镜头 ID。');
  }
  const commandOptions = {cwd: projectRoot, stdio: 'inherit'};
  if (route.audioMode === 'tts') {
    if (!fs.existsSync(path.join(project, 'audio/audio-manifest.json'))) throw new Error('请先准备修订后的 TTS 音频包。');
    execFileSync(process.execPath, ['--import', 'tsx/esm', 'scripts/synthesize-voiceover.mjs', project,
      '--tts-config', route.tts, '--reuse'], commandOptions);
  }
  const impact = timingImpact(basis.timeline, reviewTimeline(project, board, route));
  const clipId = randomUUID();
  const output = clipFile(project, clipId);
  if (fs.existsSync(output)) throw new Error('预览编号冲突，请重试。');
  unpublished = output;
  const args = [file, scenes[0].scene.id, output, '--through-scene', scenes.at(-1).scene.id, '--mode', route.mode, '--output-purpose', route.purpose];
  if (route.audio) args.push('--audio-config', route.audio);
  execFileSync(process.execPath, ['--import', 'tsx/esm', 'scripts/preview-storyboard-shot.mjs', ...args], commandOptions);
  if (previewInputs(project, route) !== inputs) throw new Error('制作输入在生成预览期间变化，请重试。');
  (issue.previews ??= []).push({id: clipId, sceneIds: ids, inputs, route, impact,
    bytes: fingerprintFiles([output], project), createdAt: new Date().toISOString()});
  writeProjectJson(project, path.join(project, ledgerName), {schemaVersion: '1.0', issues});
  unpublished = undefined;
  console.log(`整片 ${impact.beforeSeconds.toFixed(3)} → ${impact.afterSeconds.toFixed(3)} 秒。请在 review:player 查看逐场字幕差异并确认镜头。`);
} finally {
  try {if (unpublished && fs.existsSync(unpublished)) fs.unlinkSync(unpublished);} finally {release();}
}
