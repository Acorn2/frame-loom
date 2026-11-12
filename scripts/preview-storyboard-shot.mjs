import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileStoryboardShots} from '../src/shots/compile-shot.ts';
import {bundle} from '@remotion/bundler';
import {getCompositions, renderMedia, renderStill} from '@remotion/renderer';
import {MotionPackSchema, StylePackSchema} from '../src/schemas/style-pack.ts';
import {createStyleTokens} from '../src/styles/style-loader.ts';
import {getSceneTimeline} from '../src/timeline/scene-timeline.ts';
import {checkAssetInput, checkAudioInput, checkStoryboardInput, checkVisualInput} from './lib/preflight.mjs';

import {loadAudioRuntime} from './lib/audio-runtime.mjs';
import {assertStoryboardApproval} from './lib/storyboard-approval.mjs';
import {layoutCollector} from './lib/layout-qa.mjs';
import {layoutCheckpoints} from '../src/layout/checkpoints.ts';

import {OUTPUT_PURPOSES, loadHandoffConfig} from './lib/output-purpose.mjs';
import {resolveBrand} from './lib/branding.mjs';

const args = process.argv.slice(2);
let executionMode = 'fast';
let audioConfigPath, purpose, through;
const positional = [];
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--mode') executionMode = args[++i];
  else if (args[i] === '--through-scene') through = args[++i];
  else if (args[i] === '--output-purpose') purpose = args[++i];
  else if (args[i] === '--audio-config') {
    audioConfigPath = args[++i];
    if (!audioConfigPath) throw new Error('--audio-config 需要路径。');
  } else positional.push(args[i]);
}
if (positional.length !== 3 || !['fast', 'review'].includes(executionMode)) {
  throw new Error('Usage: npm run preview:shot -- <storyboard.json> <scene-id> <new-output.mp4> [--mode fast|review] [--audio-config <audio-config.json>]');
}
if (purpose && !OUTPUT_PURPOSES.includes(purpose)) throw new Error('镜头预览用途无效。');
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
const timeline = getSceneTimeline(storyboard);
const timing = timeline.find((item) => item.scene.id === sceneId);
if (!timing) throw new Error(`不存在 scene id：${sceneId}`);

const style = StylePackSchema.parse(JSON.parse(fs.readFileSync(path.join(styleRoot, storyboard.style.id, 'style.json'), 'utf8')));
const motion = MotionPackSchema.parse(JSON.parse(fs.readFileSync(path.join(styleRoot, storyboard.style.id, 'motion.json'), 'utf8')));
const hydrated = structuredClone(storyboard);
for (const scene of hydrated.scenes) {
  for (const layer of scene.layers) {
    if (!layer.asset) continue;
    const file = path.resolve(path.dirname(storyboardPath), layer.asset);
    const mime = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif'}[path.extname(file).toLowerCase()];
    if (!mime) throw new Error(`代表镜头暂不支持该素材类型：${file}`);
    layer.assetDataUri = `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
  }
}
const audioTiming = audioConfigPath ? checkAudioInput(storyboardPath, audioConfigPath) : undefined;
const audioRuntime = loadAudioRuntime(audioConfigPath, audioTiming);
const hasAudio = Boolean(audioRuntime?.voiceoverDataUri || audioRuntime?.musicDataUri || audioRuntime?.sfx?.length);
const tail = through ? timeline.find(s => s.scene.id === through) : timing;
if (!tail || tail.startFrame < timing.startFrame) throw new Error('预览结束镜头无效。');
if (purpose === 'in-project-video' && !audioRuntime?.voiceoverDataUri) throw new Error('有声镜头需要匹配的旁白。');
const context = !purpose && hasAudio ? Math.round(storyboard.project.fps * 0.5) : 0;
const start = Math.max(0, timing.startFrame - context);
const end = Math.min(storyboard.project.durationFrames - 1, Math.max(timing.endFrame,tail.endFrame) + context - 1);
const layout = layoutCollector(storyboard, {frames: layoutCheckpoints(storyboard).filter(frame => frame >= start && frame <= end)});
const handoff = purpose === 'visual-master' ? loadHandoffConfig(path.dirname(storyboardPath)) : undefined;
const brand = resolveBrand(storyboard.style.id, {root,projectPath:path.dirname(storyboardPath)});
const inputProps = {storyboard: hydrated, audioRuntime, styleTokens: createStyleTokens(style, motion, storyboard.project.width, storyboard.project.height, storyboard.font, storyboard.palette), renderProfile: {purpose: purpose ?? 'visual-preview', brand:brand?.runtime, showReviewMarker:!hasAudio && purpose !== 'visual-master',
  facecamRightFraction:handoff?.facecamRightFraction ?? 0, subtitleBottomFraction:handoff?.subtitleBottomFraction ?? 0, ...(storyboard.layoutPolicy ? {layoutCheckFrames: layout.frames} : {})}};
console.log('Bundling Remotion composition...');
const serveUrl = await bundle({entryPoint: path.join(root, 'src/index.ts')});
const composition = (await getCompositions(serveUrl, {inputProps})).find((item) => item.id === 'StoryboardV2');
if (!composition) throw new Error('找不到 StoryboardV2 composition。');
fs.mkdirSync(path.dirname(outputPath), {recursive: true});
const range = {composition, serveUrl, inputProps, frameRange: [start, end], logLevel: 'error'};
if (purpose && hasAudio && storyboard.schemaVersion === '2.4' && !timeline.some(scene => scene.overlapInFrames || scene.overlapOutFrames)) {
  // Match the full scene-cache route: PCM mix first, AAC only at final mux.
  // Direct range-to-AAC encoding inserts audible encoder padding at the cut.
  const temp = fs.mkdtempSync(path.join(path.dirname(outputPath), '.clip-'));
  const visual = path.join(temp, 'visual.mp4');
  const audio = path.join(temp, 'mix.wav');
  try {
    await renderMedia({...range, codec: 'h264', outputLocation: visual, muted: true, audioCodec: null, onBrowserLog: layout.onBrowserLog});
    await renderMedia({...range, codec: 'wav', outputLocation: audio, audioCodec: 'pcm-16', enforceAudioTrack: true});
    execFileSync('ffmpeg', ['-v', 'error', '-nostdin', '-n', '-i', visual, '-i', audio, '-map', '0:v:0', '-map', '1:a:0',
      '-c:v', 'copy', '-c:a', 'aac', '-t', String((end - start + 1) / storyboard.project.fps), '-movflags', '+faststart', outputPath]);
  } finally {
    for (const file of [visual, audio]) if (fs.existsSync(file)) fs.unlinkSync(file);
    fs.rmdirSync(temp);
  }
} else {
  await renderMedia({...range, codec: 'h264', outputLocation: outputPath, audioCodec: hasAudio ? 'aac' : null,
    muted: !hasAudio, enforceAudioTrack: hasAudio, onBrowserLog: layout.onBrowserLog});
}
// Feedback clips are played directly. Representative stills belong to preview:shot.
if (purpose) {
  layout.finish();
  console.log(`修改预览 ${outputPath}（帧 ${start}–${end}）`);
} else {
  fs.mkdirSync(reviewDir, {recursive: true});
  const firstAction = timing.scene.beats.find((beat) => beat.action !== 'set-state');
  const lastActionEnd = Math.max(0, ...timing.scene.beats.map((beat) => beat.start + beat.duration));
  const fadeFrames = timing.scene.outro?.fadeFrames ?? (timing.overlapOutFrames === 0 && timing.scene.transitionOut ? 12 : 0);
  const frames = [
    ...(compileStoryboardShots(storyboard).find((plan) => plan.sceneId === sceneId)?.checkpoints ?? []).map((event, index) => ({name: `shot-${String(index + 1).padStart(3, '0')}`, eventId: event.id, local: event.frame})),
    {name: 'entry-mid', local: firstAction ? firstAction.start + Math.floor(firstAction.duration / 2) : 9},
    {name: 'complete', local: Math.max(22, lastActionEnd + 2)},
    {name: 'before-cut', local: timing.scene.durationFrames - timing.overlapOutFrames - fadeFrames - 2}
  ];
  for (const item of frames) {
    const frame = timing.startFrame + Math.max(0, Math.min(timing.scene.durationFrames - 1, item.local));
    await renderStill({composition, serveUrl, inputProps, frame, output: path.join(reviewDir, `${item.name}.png`), imageFormat: 'png'});
  }
  const layoutQa = layout.finish();
  fs.writeFileSync(path.join(reviewDir, 'clip-timing.json'), JSON.stringify({sceneId, sourceStartFrame: start, sourceEndFrameInclusive: end, fps: storyboard.project.fps, hasAudio, reviewOnly: true, frames, ...(layoutQa ? {layoutQa} : {})}, null, 2));
  console.log(`SHOT PREVIEW ${outputPath} (${timing.scene.durationFrames / storyboard.project.fps}s)`);
  console.log(`REVIEW FRAMES ${reviewDir}`);
}
