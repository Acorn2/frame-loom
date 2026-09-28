import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {getCompositions, renderStill} from '@remotion/renderer';
import {MotionPackSchema, StylePackSchema} from '../src/schemas/style-pack.ts';
import {createStyleTokens} from '../src/styles/style-loader.ts';
import {getSceneTimeline} from '../src/timeline/scene-timeline.ts';
import {checkStoryboardInput, checkVisualInput} from './lib/preflight.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};
const output = option('--output');
const portrait = args.includes('--portrait');
const chosen = option('--styles');
if (!output || (args.includes('--styles') && !chosen)) {
  throw new Error('Usage: npm run preview:semantic -- --output <new-directory> [--styles id,id] [--portrait]');
}
const outputRoot = path.resolve(output);
if (fs.existsSync(outputRoot)) throw new Error(`输出目录已存在，未覆盖：${outputRoot}`);
const styleRoot = path.join(root, 'styles');
const index = JSON.parse(fs.readFileSync(path.join(styleRoot, 'style-index.json'), 'utf8'));
const styleIds = chosen ? chosen.split(',').map((id) => id.trim()).filter(Boolean) : index.styles.map((style) => style.id);
if (styleIds.length === 0 || new Set(styleIds).size !== styleIds.length) throw new Error('Style Pack id 不能为空或重复。');
const source = JSON.parse(fs.readFileSync(path.join(root, 'examples/semantic-visuals/storyboard.json'), 'utf8'));
const plans = styleIds.map((id) => {
  const style = StylePackSchema.parse(JSON.parse(fs.readFileSync(path.join(styleRoot, id, 'style.json'), 'utf8')));
  const motion = MotionPackSchema.parse(JSON.parse(fs.readFileSync(path.join(styleRoot, id, 'motion.json'), 'utf8')));
  const storyboard = structuredClone(source);
  storyboard.style = {id, version: style.version};
  if (portrait) Object.assign(storyboard.project, {width: 1080, height: 1920});
  const visualIssues = checkVisualInput(storyboard);
  const issues = [...checkStoryboardInput(storyboard, {styleRoot, executionMode: 'fast'}), ...visualIssues.safeArea.issues, ...visualIssues.textLayout];
  const errors = issues.filter((item) => item.severity === 'error');
  if (errors.length) throw new Error(`${id} 未通过校验：${errors.map((item) => item.message).join('；')}`);
  return {id, storyboard, styleTokens: createStyleTokens(style, motion, storyboard.project.width, storyboard.project.height)};
});
fs.mkdirSync(outputRoot, {recursive: true});
console.log('Bundling Remotion composition...');
const serveUrl = await bundle({entryPoint: path.join(root, 'src/index.ts')});
const sections = [];
for (const plan of plans) {
  const inputProps = {storyboard: plan.storyboard, styleTokens: plan.styleTokens, renderProfile: {purpose: 'visual-preview'}};
  const compositions = await getCompositions(serveUrl, {inputProps});
  const composition = compositions.find((item) => item.id === 'StoryboardV2');
  if (!composition) throw new Error('找不到 StoryboardV2 composition。');
  const files = [];
  for (const timing of getSceneTimeline(plan.storyboard)) {
    const frame = timing.startFrame + Math.min(timing.scene.durationFrames - 2, Math.max(90, ...timing.scene.beats.map((beat) => beat.start + beat.duration + 30)));
    const file = `${plan.id}-${timing.scene.id}.png`;
    await renderStill({composition, serveUrl, inputProps, frame, output: path.join(outputRoot, file), imageFormat: 'png'});
    files.push({file, scene: timing.scene});
  }
  fs.writeFileSync(path.join(outputRoot, `${plan.id}.storyboard.json`), `${JSON.stringify(plan.storyboard, null, 2)}\n`);
  sections.push(`<section><h2>${plan.id}</h2><div class="grid">${files.map(({file, scene}) => `<figure><img src="${file}" alt="${scene.id}"><figcaption>${scene.visual.kind} · ${scene.title}</figcaption></figure>`).join('')}</div></section>`);
  console.log(`Rendered ${plan.id}: ${files.length} completed frames`);
}
fs.writeFileSync(path.join(outputRoot, 'index.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>FrameLoom semantic visuals</title><style>body{font:16px Arial,sans-serif;background:#222;color:#eee;margin:32px}section{margin:0 0 60px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}figure{margin:0}img{width:100%;display:block}figcaption{padding:10px;background:#333}</style><h1>Storyboard 2.3 / completed frames</h1>${sections.join('')}</html>\n`);
console.log(`Gallery: ${path.join(outputRoot, 'index.html')}`);
