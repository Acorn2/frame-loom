import fs from 'node:fs';
import path from 'node:path';
import {getSceneTimeline} from '../../src/timeline/scene-timeline.ts';
import {completedStatus} from '../workflow-status.mjs';
import {assertProjectOutput, writeProjectJson} from './project-files.mjs';
import {hashValue} from './production-lock.mjs';
import {fingerprintFiles} from './input-fingerprint.mjs';
import {basisFile} from './review-ledger.mjs';
import {readBasis} from './preview-gate.mjs';
import {reviewTimeline, groupQaIssues} from './review-impact.mjs';
import {readFeedback, versionOf} from './review-feedback.mjs';

export function reviewCandidate(project, {requireCurrentInputs = false} = {}) {
  const read = name => JSON.parse(fs.readFileSync(assertProjectOutput(project, path.join(project, name)), 'utf8'));
  const run = read('run.json');
  if (run.status !== 'completed' || !run.artifacts?.video) throw new Error('请先完成候选视频的生产与 QA。');
  const checked = completedStatus(project, run);
  const board = read('storyboard.json');
  // In a fresh TTS shell completedStatus can still verify a 2.4 candidate's
  // bytes, QA and production lock, which binds the displayed scene timeline.
  const verifiedTimeline = board.schemaVersion === '2.4' && checked.file === path.resolve(project, run.artifacts.video);
  if (checked.owner !== '创作者' && (requireCurrentInputs || !verifiedTimeline)) throw new Error(checked.next);
  const scenes = getSceneTimeline(board).map(({scene, startFrame, endFrame}) => ({id: scene.id, title: scene.title, start: startFrame, end: endFrame}));
  return {file: checked.file, title: board.project.title, fps: board.project.fps, frames: board.project.durationFrames,
    version: versionOf(run), scenes};
}

// Capture the reviewed timeline before edits. The original run identifies the video
// even while the working storyboard and subtitles already describe the next cut.
export function playbackCandidate(project) {
  const read = name => JSON.parse(fs.readFileSync(assertProjectOutput(project, path.resolve(project, name)), 'utf8'));
  const run = read('run.json');
  const active = readFeedback(project).filter(issue => issue.basisHash && !issue.producedVersion);
  const issue = run.status === 'completed' ? active.find(issue => issue.version === versionOf(run)) : active.at(-1);
  if (issue) {
    const basis = readBasis(project, issue);
    const original = assertProjectOutput(project, path.resolve(project, basis.file));
    const expected = issue.version.split('.')[1];
    if (fs.existsSync(original) && fingerprintFiles([original], project) === expected) {
      return {...basis, file: original, basisHash: issue.basisHash};
    }
    // A failed full run may have replaced the output before QA. The compact
    // revision archive retains the prior candidate at the same relative path.
    const revisions = path.join(project, 'revisions');
    if (fs.existsSync(revisions)) {
      for (const entry of fs.readdirSync(revisions, {withFileTypes: true})) {
        if (!entry.isDirectory()) continue;
        const archive = path.join(revisions, entry.name);
        const file = assertProjectOutput(project, path.resolve(archive, basis.file));
        if (fs.existsSync(file) && fingerprintFiles([file], archive) === expected) {
          return {...basis, file, basisHash: issue.basisHash};
        }
      }
    }
    throw new Error('无法核对原版视频或其修订归档。');
  }
  const candidate = reviewCandidate(project);
  const audioMode = run.audioModeResolved ?? 'silent';
  const audio = audioMode === 'tts' ? path.join(project, 'audio/audio-config.tts.json') :
    audioMode === 'external' ? run.audioConfigPath ?? path.join(project, 'audio/audio-config.json') : null;
  const route = {mode:run.executionMode ?? 'fast', purpose:run.outputPurpose, audioMode, audio, tts:run.ttsConfigPath ?? null};
  return {...candidate, route, timeline:reviewTimeline(project,read('storyboard.json'),route),
    qaGroups:groupQaIssues(read(run.artifacts.qaReport),candidate.scenes)};
}

export function saveBasis(project, candidate) {
  if (candidate.basisHash) return candidate.basisHash;
  const basis = {...candidate, file: path.relative(project, candidate.file)};
  const target = basisFile(project,candidate.version);
  const hash = hashValue(basis);
  if (!fs.existsSync(target)) writeProjectJson(project,target,basis);
  else if (hashValue(JSON.parse(fs.readFileSync(target,'utf8'))) !== hash) throw new Error('当前原版记录不一致。');
  return hash;
}
