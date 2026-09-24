import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {getCompositions, renderMedia, renderStill} from '@remotion/renderer';
import {MotionPackSchema, StylePackSchema} from '../src/schemas/style-pack.ts';
import {createStyleTokens} from '../src/styles/style-loader.ts';
import {getSceneTimeline} from '../src/timeline/scene-timeline.ts';
import {checkAssetInput, checkStoryboardInput, checkVisualInput} from './lib/preflight.mjs';
import {runQa} from './qa-storyboard.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(projectRoot, 'examples/template-families');
const styleIds = ['retro-zine', 'signal', 'scatterbrain'];
const args = process.argv.slice(2);
const outputOption = args.indexOf('--output');
const stillsOnly = args.includes('--stills-only');
const portrait = args.includes('--portrait');
if (args.some((arg, index) => arg !== '--stills-only' && arg !== '--portrait' && arg !== '--output' && index !== outputOption + 1)
  || (outputOption >= 0 && !args[outputOption + 1])) {
  console.error('Usage: npm run preview:templates -- [--output <new-directory>] [--portrait] [--stills-only]');
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputRoot = path.resolve((outputOption >= 0 ? args[outputOption + 1] : undefined) ?? path.join(projectRoot, 'projects', `template-family-gallery-${stamp}`));
if (fs.existsSync(outputRoot)) throw new Error(`输出目录已存在，未覆盖：${outputRoot}`);
fs.mkdirSync(path.join(outputRoot, 'assets'), {recursive: true});
fs.copyFileSync(path.join(sourceRoot, 'assets/product-workflow.svg'), path.join(outputRoot, 'assets/product-workflow.svg'));
fs.copyFileSync(path.join(sourceRoot, 'asset-manifest.json'), path.join(outputRoot, 'asset-manifest.json'));

const sourceStoryboard = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'storyboard.json'), 'utf8'));
const styleRoot = path.join(projectRoot, 'styles');
const plans = styleIds.map((id) => {
  const style = StylePackSchema.parse(JSON.parse(fs.readFileSync(path.join(styleRoot, id, 'style.json'), 'utf8')));
  const motion = MotionPackSchema.parse(JSON.parse(fs.readFileSync(path.join(styleRoot, id, 'motion.json'), 'utf8')));
  const storyboard = structuredClone(sourceStoryboard);
  storyboard.style = {id, version: style.version};
  if (portrait) {
    storyboard.project.width = 1080;
    storyboard.project.height = 1920;
  }
  const storyboardPath = path.join(outputRoot, `storyboard.${id}.json`);
  fs.writeFileSync(storyboardPath, `${JSON.stringify(storyboard, null, 2)}\n`);
  const issues = checkStoryboardInput(storyboard, {storyboardPath, styleRoot, executionMode: 'review'});
  const assetIssues = checkAssetInput(storyboardPath).map((message) => ({severity: 'error', message}));
  const visual = checkVisualInput(storyboard);
  const allIssues = [...issues, ...assetIssues, ...visual.safeArea.issues, ...visual.textLayout];
  const errors = allIssues.filter((issue) => issue.severity === 'error');
  if (errors.length > 0) throw new Error(`${id} 输入未通过校验：\n${errors.map((issue) => issue.message).join('\n')}`);
  const hydrated = structuredClone(storyboard);
  for (const scene of hydrated.scenes) {
    for (const layer of scene.layers) {
      if (!layer.asset) continue;
      const assetPath = path.resolve(outputRoot, layer.asset);
      layer.assetDataUri = `data:image/svg+xml;base64,${fs.readFileSync(assetPath).toString('base64')}`;
    }
  }
  const styleTokens = createStyleTokens(style, motion, storyboard.project.width, storyboard.project.height);
  return {id, storyboard, storyboardPath, inputProps: {storyboard: hydrated, styleTokens}};
});

console.log('Bundling Remotion composition...');
const bundleLocation = await bundle({entryPoint: path.join(projectRoot, 'src/index.ts')});
for (const plan of plans) {
  console.log(`Rendering ${plan.id}...`);
  const compositions = await getCompositions(bundleLocation, {inputProps: plan.inputProps});
  const composition = compositions.find((item) => item.id === 'StoryboardV2');
  if (!composition) throw new Error('找不到 StoryboardV2 composition。');
  const timeline = getSceneTimeline(plan.storyboard);
  const frames = [];
  for (const timing of timeline) {
    const frame = timing.startFrame + Math.min(timing.scene.durationFrames - 1, 66);
    const fileName = `${plan.id}-${timing.scene.id}.png`;
    await renderStill({composition, serveUrl: bundleLocation, inputProps: plan.inputProps, frame, output: path.join(outputRoot, fileName), imageFormat: 'png'});
    frames.push({purpose: timing.scene.purpose, title: timing.scene.title, fileName});
  }
  plan.frames = frames;
  if (!stillsOnly) {
    plan.videoName = `${plan.id}.mp4`;
    const videoPath = path.join(outputRoot, plan.videoName);
    await renderMedia({composition, serveUrl: bundleLocation, inputProps: plan.inputProps, codec: 'h264', outputLocation: videoPath, audioCodec: null, muted: true});
    const qa = runQa({storyboardPath: plan.storyboardPath, videoPath, reviewDir: path.join(outputRoot, `${plan.id}-review`)});
    if (!qa.report.automatedPassed) throw new Error(`${plan.id} 的自动 QA 未通过：${qa.reportPath}`);
    plan.qaPath = path.relative(outputRoot, qa.reportPath);
  }
}

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

const sections = plans.map((plan) => `
  <section>
    <header><h2>${escapeHtml(plan.id)}</h2><a href="${escapeHtml(path.basename(plan.storyboardPath))}">storyboard.json</a></header>
    <div class="frames">${plan.frames.map((frame) => `<figure><img src="${frame.fileName}" alt="${escapeHtml(plan.id)} ${escapeHtml(frame.purpose)}"><figcaption><b>${escapeHtml(frame.purpose)}</b> ${escapeHtml(frame.title)}</figcaption></figure>`).join('')}</div>
    ${plan.videoName ? `<video controls muted playsinline preload="metadata" poster="${plan.frames[0].fileName}" src="${plan.videoName}"></video><p><a href="${plan.qaPath}">自动 QA 报告</a> · 仍需人工完整播放复核</p>` : '<p>本次使用了 --stills-only，没有生成视频。</p>'}
  </section>`).join('');
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FrameLoom 真实模板对比</title><style>
*{box-sizing:border-box}body{margin:0;background:#141717;color:#f1f0ea;font:16px/1.5 system-ui,sans-serif}main{max-width:1500px;margin:auto;padding:40px 24px}h1{font-size:clamp(28px,4vw,52px);margin:0}p{color:#b8c2be}section{margin-top:45px;padding:24px;background:#202525;border:1px solid #3a4844;border-radius:18px}header{display:flex;align-items:center;justify-content:space-between;gap:16px}h2{margin:0 0 18px;text-transform:capitalize}a{color:#9de4d3}.frames{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}figure{margin:0}img{display:block;width:100%;aspect-ratio:${portrait ? '9/16' : '16/9'};object-fit:contain;background:#000}figcaption{padding:9px 0;color:#d0d8d5}figcaption b{color:#9de4d3;margin-right:8px}video{display:block;width:min(100%,760px);margin-top:20px}@media(max-width:600px){main{padding:24px 12px}section{padding:14px}header{align-items:start;flex-direction:column}}
  </style></head><body><main><h1>三套模板，来自同一份分镜</h1><p>以下图片和静音短视频由 FrameLoom 的 Remotion renderer 输出。示例截图来源见 asset-manifest.json。视频尚不包含旁白或配乐。</p>${sections}</main></body></html>`;
fs.writeFileSync(path.join(outputRoot, 'index.html'), html);
console.log(`TEMPLATE GALLERY ${path.join(outputRoot, 'index.html')}`);
