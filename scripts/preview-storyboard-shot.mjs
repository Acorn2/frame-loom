import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {getCompositions, renderMedia, renderStill} from '@remotion/renderer';
import {MotionPackSchema, StylePackSchema} from '../src/schemas/style-pack.ts';
import {createStyleTokens} from '../src/styles/style-loader.ts';
import {getSceneTimeline} from '../src/timeline/scene-timeline.ts';
import {checkAssetInput, checkStoryboardInput, checkVisualInput} from './lib/preflight.mjs';

const args = process.argv.slice(2);
const modeIndex = args.indexOf('--mode');
const executionMode = modeIndex < 0 ? 'fast' : args[modeIndex + 1];
const positional = args.filter((_value, index) => modeIndex < 0 || (index !== modeIndex && index !== modeIndex + 1));
if (positional.length !== 3 || !['fast', 'review'].includes(executionMode)) {
  throw new Error('Usage: npm run preview:shot -- <storyboard.json> <scene-id> <new-output.mp4> [--mode fast|review]');
}
const [input, sceneId, output] = positional;
const storyboardPath = path.resolve(input);
const outputPath = path.resolve(output);
if (path.basename(storyboardPath) === 'storyboard.draft.json') throw new Error('禁止直接渲染 storyboard.draft.json。');
if (fs.existsSync(outputPath)) throw new Error(`输出已存在，未覆盖：${outputPath}`);
const reviewDir = path.join(path.dirname(outputPath), `${path.parse(outputPath).name}-review`);
if (fs.existsSync(reviewDir)) throw new Error(`代表帧目录已存在，未覆盖：${reviewDir}`);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const styleRoot = path.join(root, 'styles');
const storyboard = JSON.parse(fs.readFileSync(storyboardPath, 'utf8'));
const issues = checkStoryboardInput(storyboard, {storyboardPath, styleRoot, executionMode});
const assets = checkAssetInput(storyboardPath);
const visual = checkVisualInput(storyboard);
const errors = [...issues.filter((item) => item.severity === 'error').map((item) => item.message), ...assets, ...visual.safeArea.issues.filter((item) => item.severity === 'error').map((item) => item.message), ...visual.textLayout.filter((item) => item.severity === 'error').map((item) => item.message)];
if (errors.length) throw new Error(`分镜未通过预检：${errors.join('；')}`);
const timing = getSceneTimeline(storyboard).find((item) => item.scene.id === sceneId);
if (!timing) throw new Error(`不存在 scene id：${sceneId}`);

const style = StylePackSchema.parse(JSON.parse(fs.readFileSync(path.join(styleRoot, storyboard.style.id, 'style.json'), 'utf8')));
const motion = MotionPackSchema.parse(JSON.parse(fs.readFileSync(path.join(styleRoot, storyboard.style.id, 'motion.json'), 'utf8')));
const hydrated = structuredClone(storyboard);
for (const scene of hydrated.scenes) {
  for (const layer of scene.layers) {
    if (!layer.asset) continue;
    const file = path.resolve(path.dirname(storyboardPath), layer.asset);
    const mime = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml'}[path.extname(file).toLowerCase()];
    if (!mime) throw new Error(`代表镜头暂不支持该素材类型：${file}`);
    layer.assetDataUri = `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
  }
}
const inputProps = {storyboard: hydrated, styleTokens: createStyleTokens(style, motion, storyboard.project.width, storyboard.project.height), renderProfile: {purpose: 'visual-preview'}};
console.log('Bundling Remotion composition...');
const serveUrl = await bundle({entryPoint: path.join(root, 'src/index.ts')});
const composition = (await getCompositions(serveUrl, {inputProps})).find((item) => item.id === 'StoryboardV2');
if (!composition) throw new Error('找不到 StoryboardV2 composition。');
fs.mkdirSync(path.dirname(outputPath), {recursive: true});
const start = timing.startFrame;
const end = start + timing.scene.durationFrames - 1;
await renderMedia({composition, serveUrl, inputProps, codec: 'h264', outputLocation: outputPath, audioCodec: null, muted: true, frameRange: [start, end]});
fs.mkdirSync(reviewDir, {recursive: true});
const firstAction = timing.scene.beats.find((beat) => beat.action !== 'set-state');
const lastActionEnd = Math.max(0, ...timing.scene.beats.map((beat) => beat.start + beat.duration));
const fadeFrames = timing.scene.outro?.fadeFrames ?? (timing.overlapOutFrames === 0 && timing.scene.transitionOut ? 12 : 0);
const frames = [
  {name: 'entry-mid', local: firstAction ? firstAction.start + Math.floor(firstAction.duration / 2) : 9},
  {name: 'complete', local: Math.max(22, lastActionEnd + 2)},
  {name: 'before-cut', local: timing.scene.durationFrames - timing.overlapOutFrames - fadeFrames - 2}
];
for (const item of frames) {
  const frame = start + Math.max(0, Math.min(timing.scene.durationFrames - 1, item.local));
  await renderStill({composition, serveUrl, inputProps, frame, output: path.join(reviewDir, `${item.name}.png`), imageFormat: 'png'});
}
console.log(`SHOT PREVIEW ${outputPath} (${timing.scene.durationFrames / storyboard.project.fps}s)`);
console.log(`REVIEW FRAMES ${reviewDir}`);
