import {illustrationFiles} from './illustrations.mjs';
import {fixtureAssets} from './library-assets.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {SHOT_CATALOG} from '../../src/shots/catalog.ts';
import {compatibleCanvases} from '../../src/shots/compatibility.ts';
import {AUXILIARY_CATALOG} from '../../src/shots/auxiliary-catalog.ts';
import {CHAPTER_TRANSITIONS} from '../../src/shots/shortlist/chapter-transitions.tsx';
import {loadStyleIndex, projectRoot} from './style-catalog.mjs';
import {FONT_CATALOG, recommendedFont} from '../../src/fonts/catalog.ts';
import {readFontPreviews} from './font-previews.mjs';

// Approved direction: a local catalog with actual renderer samples and selection exports.
// Catalogs own capabilities; this file only joins presentation labels and public evidence.
const labels = JSON.parse(fs.readFileSync(path.join(projectRoot, 'library/catalog-labels.json'), 'utf8'));
const styleDescriptions = {
  'annotated-reasoning': ['批注推演', '文案保持稳定，圈词、旁注与关系线按讲述顺序累积；小插画只提供情境。样片与白板使用同一观察文案。'],
  'editorial-typography': ['编辑式排印', '浅色画布、克制字号与细线；文字连续迁移、归组、沿关系追踪，再连接成解释。辅助插画保持在角落。'],
  'flat-explainer': ['彩色手绘讲解', '大幅漫画人物与物件置于有机舞台，说明围绕主体展开；对照与流程横向推进，曲线关系配合连续入场。样片“好问题，从观察开始”与另外两套使用相同文案。'],
  'paper-collage': ['像素讲解笔记', '紧凑像素主体配浅灰笔记线与阶梯模块；对照和流程纵向逐项展开，直角关系、分块显现与短促重点提示。样片“好问题，从观察开始”与另外两套使用相同文案。'],
  whiteboard: ['手绘白板', '开放点阵白板配手绘人物与物件，文字、步骤和单支铅笔逐项展开；原创样片“好问题，从观察开始”展示亲子观察、比较和提问。'],
  'retro-zine': ['墨白杂志', '中文宋体、杂志分栏与朱红印章；内容逐段揭示。适合观点、知识与故事。'],
  signal: ['暗场信号', '石墨暗场、中央焦点与淡紫强调；一次聚焦一个重点。适合核心观点与转折。'],
  scatterbrain: ['手绘便签', '黄色便签、中文楷体与蓝色批注；贴入后沿关系描线。适合笔记与方法拆解。'],
  'archive-grid': ['瑞士蓝', '克莱因蓝、直角色块与强字号对比；按网格组织内容。适合报告、分析与方法论。'],
  'signal-noir': ['工程蓝图', '石墨蓝灰网格、等宽标注与琥珀路由；模块按连接展开。适合技术机制与系统流程。'],
  'studio-frame': ['产品演示', '冷灰工作台、界面层次与绿色状态；说明跟随操作步骤。适合产品、教程与更新。']
};
export const previewRoot = path.join(projectRoot, 'library/previews');
export function readLibraryText(relative) {return fs.readFileSync(path.join(projectRoot, relative), 'utf8');}
export function libraryFixtures() {
  const hosted = {
    'marker-underline': 'blur-slide/storyboard.json',
    'scanline-annotate-focus': 'document-write/scanline-annotate-focus.json',
    'scan-bracket-sweep': 'document-write/scan-bracket-sweep.json',
    'line-boil': 'ring-annotation/line-boil.json',
    'speed-ramp-freeze': 'scroll-brake/speed-ramp-freeze.json',
    'mosaic-reframe': 'member-grid/mosaic-reframe.json',
    'outline-trace': 'structure-then-text/storyboard.json',
    'paper-tape': 'row-embed/storyboard.json',
    'card-flip': 'concept-matrix/flip.json'
  };
  return [...SHOT_CATALOG, ...AUXILIARY_CATALOG, ...CHAPTER_TRANSITIONS].map((item) => ({
    id: item.id,
    source: ['annotated-manuscript', 'editorial-flow'].includes(item.id) ? `examples/text-led-video/${item.styles[0]}/study-storyboard.json` : item.id === 'whiteboard-board' ? 'examples/whiteboard-original/storyboard.json' : item.id.startsWith('illustrated-') ? `examples/illustrated-video/whiteboard/${item.id}.json` : `examples/shot-recipes/${hosted[item.id] ?? (item.kind === 'cross-scene-transition' ? `chapter-transitions/${item.id}.json` : `${item.id}/storyboard.json`)}`
  }));
}
export const additionalPreviewFixtures = [
  {id: 'concept-matrix-wireframe', source: 'examples/shot-recipes/concept-matrix/wireframe.json', host: 'concept-matrix', name: '线框描画'},
  {id: 'card-stack-tape', source: 'examples/shot-recipes/card-stack/tape.json', host: 'card-stack', name: '胶带拍定'}
];
export const libraryStyleIds = loadStyleIndex().styles.filter(item => item.status !== 'deprecated').map(item => item.id);
export function libraryPreviewFixtures() {
  return [...libraryFixtures(), ...additionalPreviewFixtures].flatMap(item => {
    const manifest = [...SHOT_CATALOG, ...AUXILIARY_CATALOG, ...CHAPTER_TRANSITIONS].find(recipe => recipe.id === (item.host ?? item.id));
    const canvases = manifest.orientations ?? ['landscape'];
    return canvases.flatMap(canvas => libraryStyleIds.filter(styleId => compatibleCanvases(manifest, styleId).includes(canvas)).map(styleId => ({
      ...item, source: item.id.startsWith('illustrated-') ? `examples/illustrated-video/${styleId}/${item.id}.json` : canvas === 'portrait' ? item.source.replace(/storyboard\.json$/u, 'portrait.json') : item.source,
      recipeId: item.id, styleId, canvas,
      id: `${styleId === 'retro-zine' ? item.id : `${item.id}--${styleId}`}${canvas === 'portrait' ? '--portrait' : ''}`
    })));
  });
}
function sourceFiles(directory) {
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(file) : /\.(tsx?|json)$/u.test(file) ? [file] : [];
  }).sort();
}
export function previewFingerprint() {
  const hash = createHash('sha256');
  const inputs = [...sourceFiles(path.join(projectRoot, 'src')), ...sourceFiles(path.join(projectRoot, 'shots')), ...sourceFiles(path.join(projectRoot, 'styles')),
    ...[...new Set(libraryPreviewFixtures().map(item => item.source))].map((source) => path.join(projectRoot, source)),
    ...libraryPreviewFixtures().flatMap(item => fixtureAssets(path.join(projectRoot, item.source))),
    ...[...new Set(libraryPreviewFixtures().filter(item => item.recipeId.startsWith('illustrated-') || item.recipeId === 'whiteboard-board').map(item => path.dirname(path.join(projectRoot, item.source))))].flatMap(directory => [path.join(directory, 'asset-manifest.json'), ...illustrationFiles(directory)]),
    ...['annotated-reasoning', 'editorial-typography'].flatMap(id => ['asset-manifest.json', 'project-input.json', 'source.md', 'source-imagegen-requests.json'].map(file => path.join(projectRoot, 'examples/text-led-video', id, file))),
    path.join(projectRoot, 'scripts/lib/library-assets.mjs'), path.join(projectRoot, 'scripts/render-library-previews.mjs'), path.join(projectRoot, 'scripts/lib/library-catalog.mjs'), path.join(projectRoot, 'package-lock.json')];
  for (const input of inputs) {hash.update(path.relative(projectRoot, input)); hash.update(fs.readFileSync(input));}
  return hash.digest('hex');
}
function readPreviewManifest() {
  const manifestPath = path.join(previewRoot, 'manifest.json');
  return fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : null;
}
// Invalid previews must not silently substitute historical fixture screenshots.
export function buildLibraryCatalog({previewManifest = readPreviewManifest(), previewFilesRoot = previewRoot} = {}) {
  const fresh = previewManifest?.fingerprint === previewFingerprint();
  function preview(id) {
    const sample = fresh && previewManifest.samples?.some(item => item.id === id);
    const posterSource = `library/previews/${id}.png`;
    const videoSource = `library/previews/${id}.mp4`;
    const complete = sample && [posterSource, videoSource].every(source => {
      const file = path.join(previewFilesRoot, path.basename(source));
      return fs.existsSync(file) && fs.statSync(file).isFile() && fs.statSync(file).size > 0;
    });
    return complete ? {posterSource, videoSource, previewStatus: 'ready'}
      : {posterSource: null, videoSource: null, previewStatus: previewManifest && !fresh ? 'stale' : 'missing'};
  }
  function stylePreviews(id, manifest) {
    return (manifest.orientations ?? ['landscape']).flatMap(canvas => libraryStyleIds.filter(styleId => compatibleCanvases(manifest, styleId).includes(canvas)).map(styleId => {
      const sampleId = `${styleId === 'retro-zine' ? id : `${id}--${styleId}`}${canvas === 'portrait' ? '--portrait' : ''}`;
      return {id: sampleId, style: styleId, canvas, ...preview(sampleId)};
    }));
  }
  const styles = loadStyleIndex().styles.filter((item) => item.status !== 'deprecated').sort((a, b) => Number(b.role === 'primary') - Number(a.role === 'primary')).map((item) => {
    const description = styleDescriptions[item.id];
    if (!description) throw new Error(`风格缺少配方库说明：${item.id}`);
    return {...item, recommendedFont: recommendedFont(item.id).id, subtitle: description[0], description: description[1],
      posterSource: `examples/template-families/previews/${item.id}-${item.id === 'whiteboard' ? 'original' : ['annotated-reasoning', 'editorial-typography'].includes(item.id) ? 'text-led' : item.role === 'primary' ? 'illustrated' : 'semantic-process'}.png`,
      videoSource: `examples/template-families/previews/${item.id}-${item.id === 'whiteboard' ? 'original' : ['annotated-reasoning', 'editorial-typography'].includes(item.id) ? 'text-led' : item.role === 'primary' ? 'illustrated' : 'semantic'}.mp4`};
  });
  const fixtures = libraryFixtures();
  const recipes = [...SHOT_CATALOG, ...AUXILIARY_CATALOG, ...CHAPTER_TRANSITIONS].map((item) => {
    const label = labels[item.id];
    if (!label) throw new Error(`镜头缺少配方库说明：${item.id}`);
    const fixture = fixtures.find((candidate) => candidate.id === item.id);
    return {...item, name: label[0], category: label[1], description: label[2], kind: item.kind ?? 'scene',
      recipe: readLibraryText(`shots/${item.id}/recipe.md`),
      provenance: JSON.parse(readLibraryText(`shots/${item.id}/provenance.json`)), fixture: fixture.source,
      ...preview(item.styles.includes('retro-zine') ? item.id : `${item.id}--${item.styles[0]}`),
      sampleStyle: item.styles.includes('retro-zine') ? 'retro-zine' : item.styles[0], sampleCanvas: 'landscape', styleCanvases: Object.fromEntries(item.styles.map(style => [style, compatibleCanvases(item, style)])), stylePreviews: stylePreviews(item.id, item),
      previewVariants: additionalPreviewFixtures.filter(variant => variant.host === item.id).map(variant => ({id: variant.id, name: variant.name,
        ...preview(variant.id), stylePreviews: stylePreviews(variant.id, item)}))};
  });
  return {schemaVersion: '1.0', styles, fonts: FONT_CATALOG, fontPreviews: readFontPreviews(), recipes};
}
