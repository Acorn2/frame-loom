import {readEpisode, episodeFiles, checkEpisodeInputs, checkEnding} from './series.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {StoryboardSceneSchema, VisualKindSchema} from '../../src/schemas/storyboard.ts';
import {assertProjectOutput, writeProjectFile} from './project-files.mjs';

const text = z.string().regex(/\S/u, '不能为空');
const format = 'frame-loom/scene-plan';
export const emptyScenePlan = () => ({format, schemaVersion: '1.0', scenes: []});
export const ScenePlanSchema = z.object({
  format: z.literal(format), schemaVersion: z.literal('1.0'),
  scenes: z.array(z.object({
    id: StoryboardSceneSchema.shape.id, title: text, source: text, kind: VisualKindSchema,
    visualIntent: text, takeaway: text, narration: StoryboardSceneSchema.shape.narration,
    estimatedSeconds: z.number().positive().optional(), assets: z.array(text).optional()
  }).strict()).max(1000)
}).strict().superRefine((plan, ctx) => {
  const seen = new Set();
  for (const [i, scene] of plan.scenes.entries()) {
    if (seen.has(scene.id)) ctx.addIssue({code: 'custom', path: ['scenes', i, 'id'], message: '重复场景 ID：' + scene.id});
    seen.add(scene.id);
  }
});

const marker = '<!-- FrameLoom: generated from scene-plan.json -->';
const planName = 'scene-plan.json';
const exportsList = ['script.md', 'scene-review.md'];
const projectFile = (root, name) => assertProjectOutput(root, path.join(root, name));
const read = file => fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;

// Existing projects may have informal scene-plan.json arrays. Only the explicit
// format or one of our generated documents opts a project into this contract.
export function usesScenePlan(root) {
  if (episodeFiles(root).length) return true;
  for (const name of exportsList) {
    const file = path.join(root, name);
    if (fs.existsSync(file) && read(projectFile(root, name))?.startsWith(marker + '\n')) return true;
  }
  const file = path.join(root, planName);
  if (!fs.existsSync(file)) return false;
  const raw = read(projectFile(root, planName));
  try {return JSON.parse(raw)?.format === format;} catch {return false;}
}

export function scenePlanEvidence(root) {
  if (!usesScenePlan(root)) return [];
  const names = [planName, ...exportsList];
  const adopted = readEpisode(root);
  if (adopted) names.push('episode.json', 'series-lock.json', 'config.json', ...adopted.files.map(file => file.path));
  return names.map(name => {
    projectFile(root, name);
    return path.join(root, name);
  });
}

export function readScenePlan(root) {
  const raw = read(projectFile(root, planName));
  if (!raw) throw new Error('缺少 scene-plan.json。');
  let data;
  try {data = JSON.parse(raw);} catch {throw new Error('scene-plan.json 不是有效 JSON。');}
  const result = ScenePlanSchema.safeParse(data);
  if (!result.success) throw new Error(result.error.issues.map(e => e.path.join('.') + ' ' + e.message).join('\n'));
  const adopted = readEpisode(root);
  if (adopted) checkEnding(result.data.scenes, adopted.series.fixedEnding);
  return result.data;
}

function cell(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('\\', '\\\\').replaceAll('|', '\\|').replace(/\r?\n/gu, '<br>');
}

export function scenePlanDocuments(plan) {
  const script = [marker, '# 逐场讲稿', '', ...plan.scenes.flatMap(s => [`## ${s.id} · ${s.title}`, '', s.narration, ''])];
  const review = [marker, '# 逐场审阅表', '',
    '| 场景 ID | 标题 | 旁白 | 来源 | 画面类型 | 画面怎样解释 | 观众要看清什么 | 预计秒数 | 画面素材 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...plan.scenes.map(s => '| ' + [s.id, s.title, s.narration || '（无旁白）', s.source, s.kind,
      s.visualIntent, s.takeaway, s.estimatedSeconds ?? '待定', (s.assets ?? []).join('\n')].map(cell).join(' | ') + ' |')];
  return {'script.md': script.join('\n') + '\n', 'scene-review.md': review.join('\n') + '\n'};
}

export function writeScenePlanDocuments(directory, plan) {
  const root = fs.realpathSync(directory);
  const documents = Object.entries(scenePlanDocuments(plan));
  for (const [name] of documents) {
    const old = read(projectFile(root, name));
    if (old !== null && !old.startsWith(marker + '\n')) throw new Error(`${name} 是独立文稿，请先保留并核对再采用逐场计划。`);
  }
  for (const [name, content] of documents) {
    const file = projectFile(root, name);
    if (read(file) !== content) writeProjectFile(root, file, content);
  }
}

export function stalePlanDocuments(root, plan) {
  return Object.entries(scenePlanDocuments(plan)).filter(([name, content]) => read(projectFile(root, name)) !== content).map(([name]) => name);
}

export function checkScenePlan(root, board) {
  if (!usesScenePlan(root)) return [];
  const issues = [];
  const error = (field, message) => issues.push({severity: 'error', path: 'scene-plan.' + field, message});
  try {
    const adopted = readEpisode(root);
    if (adopted) checkEpisodeInputs(root, board, adopted);
    const plan = readScenePlan(root);
    if (!plan.scenes.length) error('scenes', '请先填写逐场计划。');
    for (const name of stalePlanDocuments(root, plan)) error(name, `${name} 与逐场计划不一致，请运行 export:scene-plan。`);
    const actual = new Map(board.scenes.map((s, index) => [s.id, {scene: s, index}]));
    for (const [index, s] of plan.scenes.entries()) {
      const entry = actual.get(s.id);
      if (!entry) {error(s.id, '正式分镜缺少该场。'); continue;}
      actual.delete(s.id);
      if (entry.index !== index) error(s.id, `计划第 ${index + 1} 场，分镜第 ${entry.index + 1} 场。`);
      const b = entry.scene;
      const fields = {title: b.title, narration: b.narration, kind: b.visual?.kind, visualIntent: b.visual?.explanation, source: b.visual?.source, takeaway: b.primaryClaim};
      for (const [field, value] of Object.entries(fields)) {
        if (s[field] !== value) error(`${s.id}.${field}`, `第 ${index + 1} 场 ${s.id} 的 ${field} 与计划不一致。`);
      }
      for (const asset of s.assets ?? []) {
        if (!b.layers.some(layer => layer.asset === asset)) error(`${s.id}.assets`, '分镜缺少计划素材：' + asset);
      }
    }
    for (const id of actual.keys()) error(id, '正式分镜多出未计划的场景。');
  } catch (e) {error('input', e.message);}
  return issues;
}

export function assertScenePlan(root, board) {
  const issues = checkScenePlan(root, board);
  if (issues.length) throw new Error(issues.map(e => e.path + ' ' + e.message).join('\n'));
}
