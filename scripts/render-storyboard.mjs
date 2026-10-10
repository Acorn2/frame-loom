import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveProductionLock, writeProductionLock, productionDirectory} from './lib/production-lock.mjs';
import {bundle} from '@remotion/bundler';
import {getCompositions, renderMedia} from '@remotion/renderer';
import {loadAudioRuntime} from './lib/audio-runtime.mjs';
import {MotionPackSchema, StylePackSchema} from '../src/schemas/style-pack.ts';
import {createStyleTokens} from '../src/styles/style-loader.ts';
import {inspectOutput} from './inspect-output.mjs';
import {checkAssetInput, checkAudioInput, checkStoryboardInput, checkVisualInput} from './lib/preflight.mjs';
import {loadHandoffConfig, OUTPUT_PURPOSES} from './lib/output-purpose.mjs';
import {assertStoryboardApproval} from './lib/storyboard-approval.mjs';
import {renderToVerifiedOutput} from './lib/verified-render-output.mjs';
import {verifyFontAssets} from '../src/fonts/assets.ts';
import {layoutCollector} from './lib/layout-qa.mjs';

const args = process.argv.slice(2);
let force = false;
let audioConfigPath;
let executionMode = 'review';
let outputPurpose;
const positional = [];
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--force') {
    force = true;
  } else if (arg === '--audio-config') {
    audioConfigPath = args[index + 1];
    if (!audioConfigPath) {
      console.error('--audio-config 需要一个路径。');
      process.exit(1);
    }
    index += 1;
  } else if (arg === '--mode') {
    executionMode = args[index + 1];
    if (!executionMode) {
      console.error('--mode 需要 review 或 fast。');
      process.exit(1);
    }
    index += 1;
  } else if (arg === '--output-purpose') {
    outputPurpose = args[++index];
    if (!OUTPUT_PURPOSES.includes(outputPurpose)) {
      console.error(`--output-purpose 只能是 ${OUTPUT_PURPOSES.join('、')}。`);
      process.exit(1);
    }
  } else {
    positional.push(arg);
  }
}
if (!['review', 'fast'].includes(executionMode)) {
  console.error('--mode 只能是 review 或 fast。');
  process.exit(1);
}
const [inputPath, outputPath, ...unknown] = positional;
if (!inputPath || !outputPath || unknown.length > 0) {
  console.error('Usage: npm run render:storyboard -- <storyboard.json> <output.mp4> [--mode review|fast] [--output-purpose visual-preview|visual-master|in-project-video] [--audio-config <audio-config.json>] [--force]');
  process.exit(1);
}

const resolvedInput = path.resolve(process.cwd(), inputPath);
const resolvedOutput = path.resolve(process.cwd(), outputPath);
if (['visual-preview', 'visual-master'].includes(outputPurpose) && audioConfigPath) {
  console.error(`${outputPurpose} 不能接入音频配置。`);
  process.exit(1);
}
if (outputPurpose === 'in-project-video' && !audioConfigPath) {
  console.error('项目内有声视频必须指定音频配置。');
  process.exit(1);
}
if (resolvedInput.endsWith('storyboard.draft.json')) {
  console.error('禁止直接渲染 storyboard.draft.json，请先完成人工审核并输出 storyboard.json。');
  process.exit(1);
}
if (executionMode === 'review') {
  if (path.basename(resolvedInput) !== 'storyboard.json') {
    console.error('review 模式只能渲染当前项目已审核的 storyboard.json。');
    process.exit(1);
  }
  try {
    assertStoryboardApproval(path.dirname(resolvedInput));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
if (resolvedInput === resolvedOutput) {
  console.error('输入 storyboard 与输出文件不能是同一路径。');
  process.exit(1);
}
if ((fs.existsSync(resolvedOutput) || fs.existsSync(`${resolvedOutput}.render.json`)) && !force) {
  console.error(`输出文件已存在，未覆盖：${resolvedOutput}\n确认目标后使用 --force 显式覆盖。`);
  process.exit(1);
}

let storyboard;
try {
  storyboard = JSON.parse(fs.readFileSync(resolvedInput, 'utf8'));
} catch (error) {
  console.error(`无法读取 storyboard：${resolvedInput}\n${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const styleRoot = path.join(projectRoot, 'styles');
const issues = checkStoryboardInput(storyboard, {storyboardPath: resolvedInput, styleRoot, executionMode});
const errors = issues.filter((item) => item.severity === 'error');
for (const item of issues) console[item.severity === 'error' ? 'error' : 'warn'](`${item.severity.toUpperCase()} ${item.path}: ${item.message}`);
if (errors.length > 0) process.exit(1);
const assetIssues = checkAssetInput(resolvedInput);
for (const item of assetIssues) console.error(`ERROR assets: ${item}`);
if (assetIssues.length > 0) process.exit(1);
const {safeArea, textLayout} = checkVisualInput(storyboard);
for (const item of safeArea.issues) console[item.severity === 'error' ? 'error' : 'warn'](`${item.severity.toUpperCase()} scene ${item.sceneId}, layer ${item.layerId}: ${item.message}`);
for (const item of textLayout) console[item.severity === 'error' ? 'error' : 'warn'](`${item.severity.toUpperCase()} scene ${item.sceneId}, ${item.target}: ${item.message}`);
if ([...safeArea.issues, ...textLayout].some((item) => item.severity === 'error')) process.exit(1);
const audioTiming = audioConfigPath ? checkAudioInput(resolvedInput, audioConfigPath) : undefined;

function parseFile(schema, filePath, label) {
  const result = schema.safeParse(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  if (!result.success) throw new Error(`${label} 无效：${result.error.issues.map((item) => `${item.path.join('.')}: ${item.message}`).join('; ')}`);
  return result.data;
}

function assetMime(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return ({'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml'})[extension] ?? 'application/octet-stream';
}

function hydrateStoryboardAssets(value) {
  const hydrated = structuredClone(value);
  for (const scene of hydrated.scenes) {
    for (const layer of scene.layers) {
      if (!['screenshot', 'object'].includes(layer.type) || !layer.asset) continue;
      const assetPath = path.resolve(path.dirname(resolvedInput), layer.asset);
      layer.assetDataUri = `data:${assetMime(assetPath)};base64,${fs.readFileSync(assetPath).toString('base64')}`;
    }
  }
  return hydrated;
}

const styleDirectory = path.join(styleRoot, storyboard.style.id);
const style = parseFile(StylePackSchema, path.join(styleDirectory, 'style.json'), 'style.json');
const motion = parseFile(MotionPackSchema, path.join(styleDirectory, 'motion.json'), 'motion.json');
const styleTokens = createStyleTokens(style, motion, storyboard.project.width, storyboard.project.height, storyboard.font, storyboard.palette);
const resolvedProduction = resolveProductionLock(storyboard, projectRoot, path.dirname(resolvedInput));
const productionLock = resolvedProduction?.lock;
const hydratedStoryboard = hydrateStoryboardAssets(storyboard);
const audioRuntime = loadAudioRuntime(audioConfigPath, audioTiming);
const hasAudio = Boolean(audioRuntime?.voiceoverDataUri || audioRuntime?.musicDataUri || audioRuntime?.sfx?.length);
if (outputPurpose === 'in-project-video' && !audioRuntime?.voiceoverDataUri) {
  throw new Error('项目内讲解视频必须有旁白音轨；只有配乐或音效不能作为讲解成片。');
}
const handoff = outputPurpose === 'visual-master' ? loadHandoffConfig(path.dirname(resolvedInput)) : undefined;

const font = storyboard.font ? verifyFontAssets(storyboard.font) : undefined;
const entryPoint = path.join(projectRoot, 'src/index.ts');
console.log('Bundling Remotion composition...');
const bundleLocation = await bundle({entryPoint});
const layout = layoutCollector(storyboard);
const inputProps = {storyboard: hydratedStoryboard, styleTokens, audioRuntime, renderProfile: {
  ...(storyboard.layoutPolicy ? {layoutCheckFrames: layout.frames} : {}),
  ...(font ? {font: {id: font.id, version: font.version, faces: font.faces.map(({file, sha256}) => ({file, sha256})), licenseSha256: font.licenseSha256}} : {}),
  ...(productionLock ? {productionLockHash: productionLock.hash, productionLock, resolvedShotPlan: resolvedProduction.plans} : {}),
  purpose: outputPurpose ?? (hasAudio ? 'in-project-video' : 'visual-preview'),
  showReviewMarker: !hasAudio && outputPurpose !== 'visual-master',
  facecamRightFraction: handoff?.facecamRightFraction ?? 0,
  subtitleBottomFraction: handoff?.subtitleBottomFraction ?? 0
}};
const compositions = await getCompositions(bundleLocation, {inputProps});
const composition = compositions.find((item) => item.id === 'StoryboardV2');
if (!composition) throw new Error('找不到 StoryboardV2 composition。');

console.log(`Rendering ${storyboard.project.durationSec}s ${inputProps.renderProfile.purpose}...`);
let lastProgressBucket = -1;
await renderToVerifiedOutput({
  outputPath: resolvedOutput,
  force,
  profile: inputProps.renderProfile,
  render: (stagedVideo) => renderMedia({
    composition, serveUrl: bundleLocation, codec: 'h264', outputLocation: stagedVideo,
    inputProps, audioCodec: hasAudio ? 'aac' : null, muted: !hasAudio, enforceAudioTrack: hasAudio,
    onBrowserLog: layout.onBrowserLog,
    logLevel: 'error',
    onProgress: ({progress, renderedFrames, encodedFrames}) => {
      const bucket = Math.floor(progress * 10);
      if (bucket <= lastProgressBucket) return;
      lastProgressBucket = bucket;
      console.log(`RENDER PROGRESS ${Math.min(bucket * 10, 100)}% rendered=${renderedFrames}/${composition.durationInFrames} encoded=${encodedFrames}`);
    }
  }),
  verify: (stagedVideo) => {
    const layoutQa = layout.finish();
    if (layoutQa) inputProps.renderProfile.layoutQa = layoutQa;
    inspectOutput(stagedVideo, storyboard, {expectAudio: hasAudio});
    if (productionLock && resolveProductionLock(storyboard, projectRoot, path.dirname(resolvedInput)).lock.hash !== productionLock.hash) throw new Error('输入或渲染实现已在渲染期间变化，未发布候选视频。');
  }
});
if (productionLock) writeProductionLock(storyboard, productionDirectory(resolvedOutput), resolvedProduction);
console.log(`Rendered: ${resolvedOutput}`);
