import {CHAPTER_TRANSITIONS, ChapterManifestSchema} from '../src/shots/shortlist/chapter-transitions.tsx';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {SHOT_CATALOG} from '../src/shots/catalog.ts';
import {SHOT_RENDERERS} from '../src/shots/renderer-registry.tsx';
import {ShotSchema, ShotManifestSchema, SHOT_IDS} from '../src/schemas/shot-recipe.ts';
import {VideoTemplateSchema} from '../src/schemas/video-template.ts';
import {VIDEO_TEMPLATES} from '../src/video-templates/resolve-template.ts';
import {CAPABILITY_MANIFEST} from '../src/renderer/capability-manifest.ts';
import {AUXILIARY_CATALOG, AuxiliaryManifestSchema} from '../src/shots/auxiliary-catalog.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const equalIds = (actual, expected, label) => {
  if (new Set(actual).size !== actual.length || JSON.stringify([...actual].sort()) !== JSON.stringify([...expected].sort())) throw new Error(`${label} ID 集合不一致。`);
};
const index = read('shots/shot-index.json');
equalIds(index.shots.map((item) => item.id), SHOT_IDS, 'index');
equalIds(Object.keys(SHOT_RENDERERS), SHOT_IDS, 'renderer');
equalIds(ShotSchema.options.map((schema) => schema.shape.id.value), SHOT_IDS, 'schema');
equalIds(CAPABILITY_MANIFEST.shots, SHOT_IDS, 'capability');
for (const entry of index.shots) {
  if (entry.manifest !== `${entry.id}/manifest.json` || entry.recipe !== `${entry.id}/recipe.md`) throw new Error('目录入口必须是受控路径。');
  const disk = ShotManifestSchema.parse(read(`shots/${entry.manifest}`));
  const runtime = SHOT_CATALOG.find((item) => item.id === entry.id);
  if (disk.version !== entry.version || disk.status !== entry.status || JSON.stringify(disk) !== JSON.stringify(runtime)) throw new Error(`${entry.id} catalog/index/manifest 不一致。`);
  const schema = ShotSchema.options.find((item) => item.shape.id.value === entry.id);
  equalIds(Object.keys(schema.shape.slots.shape), Object.keys(disk.slots), `${entry.id} slots`);
  const provenance = read(`shots/${entry.id}/provenance.json`);
  if (provenance.id !== entry.id || !['method-reference', 'native', 'code-adaptation'].includes(provenance.mode)) throw new Error('缺少配方来源记录。');
  for (const name of ['recipe.md', 'preview.md']) if (!fs.existsSync(path.join(root, 'shots', entry.id, name))) throw new Error(`缺少 ${name}。`);
}
const templates = read('video-templates/template-index.json').templates;
equalIds(templates.map((entry) => entry.id), VIDEO_TEMPLATES.map((entry) => entry.id), 'template index');
equalIds(templates.map((entry) => entry.id), CAPABILITY_MANIFEST.videoTemplates, 'template capability');
for (const entry of templates) {
  if (entry.manifest !== `${entry.id}/template.json`) throw new Error('视频模板入口必须是受控路径。');
  const manifest = VideoTemplateSchema.parse(read(`video-templates/${entry.manifest}`));
  if (manifest.id !== entry.id || manifest.version !== entry.version || manifest.status !== entry.status) throw new Error('模板 index 与 manifest 不一致。');
  for (const shot of manifest.shots) {
    const recipe = SHOT_CATALOG.find((item) => item.id === shot.id && item.version === shot.version);
    if (!recipe || !recipe.styles.includes(manifest.defaultStyle.id) || manifest.orientations.some((value) => !recipe.orientations.includes(value))) throw new Error('模板含未支持的镜头组合。');
  }
}
equalIds(AUXILIARY_CATALOG.map((item) => item.id), CAPABILITY_MANIFEST.auxiliaryRecipes, 'auxiliary capability');
for (const recipe of AUXILIARY_CATALOG) {
  const disk = AuxiliaryManifestSchema.parse(read(`shots/${recipe.id}/manifest.json`));
  if (JSON.stringify(disk) !== JSON.stringify(recipe)) throw new Error('宿主动作 manifest 与 runtime 不一致。');
  for (const host of recipe.hosts) if (!SHOT_IDS.includes(host)) throw new Error('宿主镜头未注册。');
  for (const name of ['provenance.json', 'recipe.md', 'preview.md']) if (!fs.existsSync(path.join(root, 'shots', recipe.id, name))) throw new Error('宿主动作缺少来源或文档。');
}
equalIds(CHAPTER_TRANSITIONS.map((item) => item.id), CAPABILITY_MANIFEST.chapterTransitions, 'chapter transitions');
for (const recipe of CHAPTER_TRANSITIONS) {
  if (JSON.stringify(ChapterManifestSchema.parse(read(`shots/${recipe.id}/manifest.json`))) !== JSON.stringify(recipe)) throw new Error('换章 manifest/runtime 不一致。');
  for (const name of ['recipe.md', 'preview.md', 'provenance.json']) if (!fs.existsSync(path.join(root, 'shots', recipe.id, name))) throw new Error('换章配方缺少文档。');
}
const coverage = read('shots/shortlist-coverage.json').candidates;
const expectedNumbers = ['A', 'B', 'C'].flatMap((group) => Array.from({length: group === 'C' ? 14 : 17}, (_, index) => `${group}${String(index + 1).padStart(2, '0')}`));
equalIds(coverage.map((item) => item.number), expectedNumbers, 'shortlist coverage');
for (const item of coverage) {
  if (!item.recipe.startsWith('references/shots/') || !item.implementations.length || !['pending', 'registered-experimental'].includes(item.status)) throw new Error('清单来源或状态无效。');
  if (item.status === 'pending') {if (item.runtimeId !== null) throw new Error('未实现项不得声称已有运行时入口。'); continue;}
  const runtime = (item.runtimeKind === 'scene' ? SHOT_CATALOG : item.runtimeKind === 'transition' ? CHAPTER_TRANSITIONS : AUXILIARY_CATALOG).find((recipe) => recipe.id === item.runtimeId);
  const provenance = read(`shots/${item.runtimeId}/provenance.json`);
  if (!runtime || provenance.recipe !== item.recipe || !item.implementations.includes(provenance.implementation)) throw new Error(`${item.number} 的实际实现与清单来源不一致。`);
  equalIds(item.adaptedImplementations, provenance.implementations ?? [provenance.implementation], `${item.number} adapted variants`);
  if (item.adaptedImplementations.some((file) => !item.implementations.includes(file))) throw new Error('实现变体必须来自对应候选。');
}
const registered = coverage.filter((item) => item.status === 'registered-experimental').length;
const capabilitySummary = `当前运行时：${SHOT_CATALOG.length} 个场景配方、${AUXILIARY_CATALOG.length} 个宿主动作、${CHAPTER_TRANSITIONS.length} 个换章配方；筛选清单接入 ${registered}/${coverage.length}。`;
for (const file of ['README.md', 'SKILL.md']) {
  const lines = fs.readFileSync(path.join(root, file), 'utf8').split(/\r?\n/u).map((line) => line.trim());
  if (!lines.includes(capabilitySummary)) throw new Error(`${file} 的能力摘要与 catalog 不一致，请更新为：${capabilitySummary}`);
}
console.log(`VALID SHOTS ${index.shots.length}; AUXILIARIES ${AUXILIARY_CATALOG.length}; TRANSITIONS ${CHAPTER_TRANSITIONS.length}; SHORTLIST ${registered}/${coverage.length}; VIDEO TEMPLATES ${templates.length}; DOC SUMMARIES MATCH`);
