import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {getCompositions, renderMedia, renderStill} from '@remotion/renderer';
import {MotionPackSchema, StylePackSchema} from '../src/schemas/style-pack.ts';
import {createStyleTokens} from '../src/styles/style-loader.ts';
import {getSceneTimeline} from '../src/timeline/scene-timeline.ts';
import {checkAssetInput, checkAudioInput, checkStoryboardInput, checkVisualInput} from './lib/preflight.mjs';

import {loadAudioRuntime} from './lib/audio-runtime.mjs';
import {assertStoryboardApproval} from './lib/storyboard-approval.mjs';

const args = process.argv.slice(2);
let executionMode = 'fast';
let audioConfigPath;
const positional = [];
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--mode') executionMode = args[++i];
  else if (args[i] === '--audio-config') {
    audioConfigPath = args[++i];
    if (!audioConfigPath) throw new Error('--audio-config 需要路径。');
  } else positional.push(args[i]);
}
if (positional.length !== 3 || !['fast', 'review'].includes(executionMode)) {
  throw new Error('Usage: npm run preview:shot -- <storyboard.json> <scene-id> <new-output.mp4> [--mode fast|review] [--audio-config <audio-config.json>]');
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
if (executionMode === 'review') assertStoryboardApproval(path.dirname(storyboardPath));
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
const audioTiming = audioConfigPath ? checkAudioInput(storyboardPath, audioConfigPath) : undefined;
const audioRuntime = loadAudioRuntime(audioConfigPath, audioTiming);
const hasAudio = Boolean(audioRuntime?.voiceoverDataUri || audioRuntime?.musicDataUri || audioRuntime?.sfx?.length);
const inputProps = {storyboard: hydrated, audioRuntime, styleTokens: createStyleTokens(style, motion, storyboard.project.width, storyboard.project.height), renderProfile: {purpose: 'visual-preview'}};
console.log('Bundling Remotion composition...');
const serveUrl = await bundle({entryPoint: path.join(root, 'src/index.ts')});
const composition = (await getCompositions(serveUrl, {inputProps})).find((item) => item.id === 'StoryboardV2');
if (!composition) throw new Error('找不到 StoryboardV2 composition。');
fs.mkdirSync(path.dirname(outputPath), {recursive: true});
const context = hasAudio ? Math.round(storyboard.project.fps * 0.5) : 0;
const start = Math.max(0, timing.startFrame - context);
const end = Math.min(storyboard.project.durationFrames - 1, timing.endFrame + context - 1);
await renderMedia({composition, serveUrl, inputProps, codec: 'h264', outputLocation: outputPath, audioCodec: hasAudio ? 'aac' : null, muted: !hasAudio, enforceAudioTrack: hasAudio, frameRange: [start, end]});
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
  const frame = timing.startFrame + Math.max(0, Math.min(timing.scene.durationFrames - 1, item.local));
  await renderStill({composition, serveUrl, inputProps, frame, output: path.join(reviewDir, `${item.name}.png`), imageFormat: 'png'});
}
fs.writeFileSync(path.join(reviewDir, 'clip-timing.json'), JSON.stringify({sceneId, sourceStartFrame: start, sourceEndFrameInclusive: end, fps: storyboard.project.fps, hasAudio, reviewOnly: true}, null, 2));
console.log(`SHOT PREVIEW ${outputPath} (${timing.scene.durationFrames / storyboard.project.fps}s)`);
console.log(`REVIEW FRAMES ${reviewDir}`);
