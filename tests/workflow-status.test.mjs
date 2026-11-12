import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, expect, it} from 'vitest';
import {recordCheckpoint} from '../scripts/workflow-checkpoint.mjs';
import {workflowStatus} from '../scripts/workflow-status.mjs';
import {fingerprintFiles, fingerprintProjectInputs} from '../scripts/lib/input-fingerprint.mjs';
import {runProduction} from '../scripts/produce.mjs';
import {prepareScriptHandoff} from '../scripts/prepare-script-handoff.mjs';

let project;
const file = name => path.join(project, name);
const json = (name, value) => fs.writeFileSync(file(name), JSON.stringify(value));
beforeEach(() => {project = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'loom-status-')));});
afterEach(() => {fs.rmSync(project, {recursive: true});});

it('hands off an explicitly selected revision using only the directory on takeover', () => {
  const oldRun = {status: 'blocked', currentStage: 'assets'};
  json('run.json', oldRun);
  const goal = '交付本期读者初稿';
  recordCheckpoint(project, 'prepare', 'edition.md', goal);
  expect(workflowStatus(project)).toMatchObject({goal, owner: 'Agent', file: undefined});
  fs.writeFileSync(file('edition.md'), 'draft one');
  fs.writeFileSync(file('story-draft.md'), 'an unrelated earlier draft');
  expect(workflowStatus(project).owner).toBe('Agent');
  recordCheckpoint(project, 'review', 'edition.md', goal);
  const recordBytes = fs.readFileSync(file('workflow-checkpoint.json'));
  expect(workflowStatus(project)).toMatchObject({goal, owner: '创作者', file: file('edition.md')});
  expect(fs.readFileSync(file('workflow-checkpoint.json'))).toEqual(recordBytes);
  expect(JSON.parse(fs.readFileSync(file('run.json')))).toEqual(oldRun);
  fs.appendFileSync(file('edition.md'), 'changed');
  expect(workflowStatus(project)).toMatchObject({stage: '待审版本已失效', owner: 'Agent', file: undefined});
  fs.unlinkSync(file('edition.md'));
  expect(workflowStatus(project).owner).toBe('Agent');
  expect(() => recordCheckpoint(project, 'review', '../other.md', goal)).toThrow();
  expect(() => recordCheckpoint(project, 'review', 'run.json', goal)).toThrow();
});

it('reports a production failure after a document handoff and accepts a later document assignment', () => {
  fs.writeFileSync(file('outline.md'), 'ready');
  const checkpoint = recordCheckpoint(project, 'review', 'outline.md', '审提纲');
  expect(() => runProduction({projectPath: project, executionMode: 'fast'})).toThrow(/storyboard.json/);
  const run = JSON.parse(fs.readFileSync(file('run.json')));
  expect(run.workflowCheckpointId).toBe(checkpoint.id);
  expect(workflowStatus(project)).toMatchObject({stage: '生产受阻 · storyboard', owner: 'Agent'});
  recordCheckpoint(project, 'prepare', 'revised.md', '重新编排');
  expect(workflowStatus(project)).toMatchObject({goal: '重新编排', stage: '文档编排中'});
});

it('reports planning and interrupted stages without offering an old candidate', () => {
  json('storyboard.draft.json', {scenes: []});
  expect(workflowStatus(project).stage).toBe('待编排');
  json('run.json', {status: 'running', currentStage: 'render', artifacts: {video: 'old.mp4'}});
  expect(workflowStatus(project)).toMatchObject({owner: 'Agent', file: file('run.json')});
});

it('reports a usable script handoff and detects a changed exported script', () => {
  fs.cpSync(path.resolve('examples/creator-production-pilot'), project, {recursive: true});
  const storyboard = JSON.parse(fs.readFileSync(file('storyboard.json'), 'utf8'));
  const script = storyboard.scenes.map(scene => `## ${scene.id}\n\n${scene.narration}`).join('\n\n');
  fs.writeFileSync(file('script.md'), script);
  recordCheckpoint(project, 'review', 'script.md', '核对讲稿');
  expect(workflowStatus(project).file).toBe(file('script.md'));
  const {markdownPath} = prepareScriptHandoff(project);
  expect(workflowStatus(project)).toMatchObject({owner: '创作者', file: markdownPath});
  fs.appendFileSync(markdownPath, 'another version');
  expect(workflowStatus(project)).toMatchObject({owner: 'Agent', file: file('run.json')});
  recordCheckpoint(project, 'prepare', 'second-draft.md', '补写第二稿');
  expect(workflowStatus(project)).toMatchObject({stage: '文档编排中', owner: 'Agent'});
});

it('picks the recorded preview, verifies bytes, and rejects stale or unbound evidence', () => {
  json('storyboard.json', {schemaVersion: '2.3'});
  fs.writeFileSync(file('selected.mp4'), 'candidate fixture');
  fs.writeFileSync(file('newer.mp4'), 'unrelated');
  const run = {
    status: 'completed', outputPurpose: 'visual-preview', outputPurposeRequested: 'visual-preview', deliveryStatus: 'preview-only',
    stages: {qa: 'completed'}, artifacts: {video: 'selected.mp4', qaReport: 'qa.json'},
    inputFingerprint: fingerprintProjectInputs(project, path.resolve('styles'), null, null, {includeAudio: false}),
    outputFingerprint: fingerprintFiles([file('selected.mp4')], project)
  };
  const qa = {automatedPassed: true, outputPurpose: 'visual-preview', video: file('selected.mp4'), checks: {output: {passed: true}}};
  json('qa.json', qa);
  json('run.json', run);
  expect(workflowStatus(project)).toMatchObject({file: file('selected.mp4'), owner: '创作者'});
  json('qa.json', {...qa, video: file('newer.mp4')});
  expect(workflowStatus(project).stage).toBe('候选待核验');
  json('qa.json', qa);
  fs.writeFileSync(file('script.md'), 'changed');
  expect(workflowStatus(project).next).toMatch(/输入/);
  fs.writeFileSync(file('selected.mp4'), 'different video');
  expect(workflowStatus(project).next).toMatch(/字节/);
  json('run.json', {...run, artifacts: {...run.artifacts, video: '../outside.mp4'}});
  expect(workflowStatus(project).next).toMatch(/项目内/);
});
