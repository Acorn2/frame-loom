import fs from 'node:fs';
import path from 'node:path';
import {writeProjectJson} from './project-files.mjs';
import {readFeedback, ledgerName, clipFile, basisFile} from './review-ledger.mjs';
import {fingerprintFiles, fingerprintProjectInputs} from './input-fingerprint.mjs';
import {projectRoot} from './style-catalog.mjs';
import {hashValue} from './production-lock.mjs';

export function previewInputs(project, route) {
  return fingerprintProjectInputs(fs.realpathSync(project), path.join(projectRoot, 'styles'), route.audio, route.tts, {
    includeAudio: Boolean(route.audio), normalizeReviewStatus: true
  });
}

export function readBasis(project, issue) {
  const data = JSON.parse(fs.readFileSync(basisFile(project, issue.version), 'utf8'));
  if (hashValue(data) !== issue.basisHash) throw new Error('原版审片证据已变化。');
  return data;
}

export function verifyClip(project, clip) {
  const file = clipFile(project, clip.id);
  if (!fs.existsSync(file) || fingerprintFiles([file], project) !== clip.bytes) throw new Error('镜头预览文件已变化，请重新生成。');
  if (previewInputs(project, clip.route) !== clip.inputs) throw new Error('预览后制作输入已变化，请重新预览并确认。');
  return file;
}

function sameFile(first, second) {
  if (!first || !second) return !first && !second;
  return fs.realpathSync(first) === fs.realpathSync(second);
}

export function confirmBeforeRender(project, route) {
  const required = readFeedback(project).filter(issue => issue.basisHash && !issue.producedVersion);
  for (const issue of required) {
    const clip = issue.previews?.at(-1);
    if (clip?.answer !== 'accepted') throw new Error(`反馈 ${issue.id} 须先生成镜头预览并由创作者确认，才能生成整片。`);
    verifyClip(project, clip);
    if (route && (route.purpose !== clip.route.purpose || !sameFile(route.audio, clip.route.audio) ||
      ('tts' in route && clip.route.audioMode === 'tts' && !sameFile(route.tts, clip.route.tts)))) {
      throw new Error('整片用途或音频与已确认的预览不一致。');
    }
  }
  return required.map(issue => issue.previews.at(-1).id);
}

export function closeProducedPreviews(project, ids, version) {
  if (!ids.length) return;
  const issues = readFeedback(project);
  const pending = issues.filter(issue => !issue.producedVersion && ids.includes(issue.previews?.at(-1)?.id));
  if (!pending.length) return;
  for (const issue of pending) issue.producedVersion = version;
  writeProjectJson(project, path.join(project, ledgerName), {schemaVersion: '1.0', issues});
}
