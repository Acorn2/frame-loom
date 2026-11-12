import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, expect, it} from 'vitest';
import {initProject} from '../scripts/init-project.mjs';
import {checkScenePlan, emptyScenePlan, readScenePlan, scenePlanEvidence, writeScenePlanDocuments} from '../scripts/lib/scene-plan.mjs';
import {workflowStatus} from '../scripts/workflow-status.mjs';
import {recordCheckpoint} from '../scripts/workflow-checkpoint.mjs';
import {storyboardApprovalFingerprint} from '../scripts/lib/storyboard-approval.mjs';
import {fingerprintProjectInputs} from '../scripts/lib/input-fingerprint.mjs';

let root;
beforeEach(() => {root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'loom-plan-')));});
afterEach(() => {fs.rmSync(root, {recursive: true, force: true});});
const put = (project, name, data) => fs.writeFileSync(path.join(project, name), JSON.stringify(data));
const contents = (project, file) => fs.readFileSync(path.join(project, file), 'utf8');

function rows() {
  return ['intro', 'source', 'options'].map(id => ({id, title: id, kind: 'statement', visualIntent: '展示问题', takeaway: '说明查找方法',
    source: '资料 | 第 1 段', narration: id + ' 的原旁白。'}));
}
function storyboard(scenes) {
  return {schemaVersion: '2.3', scenes: scenes.map(s => ({id: s.id, title: s.title, narration: s.narration, primaryClaim: s.takeaway,
    visual: {kind: s.kind, explanation: s.visualIntent, source: s.source}, layers: []}))};
}

it('exports two views and pinpoints each successive edit of scene three by ID', () => {
  const project = initProject(['acceptance', '--style', 'retro-zine', '--shots', 'semantic-default', '--projects-dir', root]);
  expect(workflowStatus(project).file).toBe(path.join(project, 'scene-plan.json'));
  const plan = readScenePlan(project);
  plan.scenes = rows();
  const board = storyboard(plan.scenes);
  put(project, 'storyboard.json', board);
  const save = () => put(project, 'scene-plan.json', plan);
  save();
  writeScenePlanDocuments(project, plan);
  expect(checkScenePlan(project, board)).toEqual([]);
  const originalScript = contents(project, 'script.md');
  recordCheckpoint(project, 'review', 'scene-review.md', '审阅视觉意图');
  const third = plan.scenes[2];
  Object.assign(third, {kind: 'compare', visualIntent: '方案甲和方案乙左右并排'});
  save();
  expect(workflowStatus(project).owner).toBe('Agent');
  writeScenePlanDocuments(project, plan);
  expect(contents(project, 'scene-review.md')).toContain(third.visualIntent);
  expect(contents(project, 'script.md')).toBe(originalScript);
  expect(checkScenePlan(project, board).map(e => e.path)).toEqual(['scene-plan.options.kind', 'scene-plan.options.visualIntent']);
  Object.assign(board.scenes[2].visual, {kind: third.kind, explanation: third.visualIntent});
  expect(checkScenePlan(project, board)).toEqual([]);
  const approval = storyboardApprovalFingerprint(project);
  const production = fingerprintProjectInputs(project, path.resolve('styles'));
  third.narration = '记得地点就从地图找，记得人物就从人物表找。';
  save();
  expect(storyboardApprovalFingerprint(project)).not.toBe(approval);
  expect(fingerprintProjectInputs(project, path.resolve('styles'))).not.toBe(production);
  expect(checkScenePlan(project, board).map(e => e.path)).toContain('scene-plan.script.md');
  writeScenePlanDocuments(project, plan);
  for (const name of ['script.md', 'scene-review.md']) expect(contents(project, name)).toContain(third.narration);
  expect(checkScenePlan(project, board).map(e => e.path)).toEqual(['scene-plan.options.narration']);
  board.scenes[2].narration = third.narration;
  expect(checkScenePlan(project, board)).toEqual([]);
  expect(board.scenes.slice(0, 2)).toEqual(storyboard(rows()).scenes.slice(0, 2));
});

it('detects identity, order, missing files and stale derived output', () => {
  const plan = {...emptyScenePlan(), scenes: rows()};
  put(root, 'scene-plan.json', plan);
  writeScenePlanDocuments(root, plan);
  const board = storyboard(plan.scenes);
  board.scenes.reverse();
  expect(checkScenePlan(root, board).some(e => e.message.includes('计划第'))).toBe(true);
  board.scenes[0].id = 'extra';
  const paths = checkScenePlan(root, board).map(e => e.path);
  expect(paths).toContain('scene-plan.extra');
  expect(paths).toContain('scene-plan.options');
  put(root, 'scene-plan.json', {...plan, scenes: [...plan.scenes, plan.scenes[0]]});
  expect(() => readScenePlan(root)).toThrow(/重复场景 ID/);
  fs.unlinkSync(path.join(root, 'scene-plan.json'));
  expect(checkScenePlan(root, board)[0].message).toMatch(/缺少 scene-plan/);
});

it('leaves informal legacy plans inert and preflights both files before replacing either', () => {
  put(root, 'scene-plan.json', rows());
  const plan = {...emptyScenePlan(), scenes: rows()};
  expect(scenePlanEvidence(root)).toEqual([]);
  expect(checkScenePlan(root, storyboard(plan.scenes))).toEqual([]);
  fs.writeFileSync(path.join(root, 'scene-review.md'), '手写审阅记录');
  expect(() => writeScenePlanDocuments(root, plan)).toThrow(/独立文稿/);
  expect(fs.existsSync(path.join(root, 'script.md'))).toBe(false);
  expect(contents(root, 'scene-review.md')).toBe('手写审阅记录');
});
