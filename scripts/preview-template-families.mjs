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
const args = process.argv.slice(2);
const outputOption = args.indexOf('--output');
const stylesOption = args.indexOf('--styles');
const stillsOnly = args.includes('--stills-only');
const portrait = args.includes('--portrait');
const force = args.includes('--force');
const valueOptions = new Set(['--output', '--styles']);
const knownFlags = new Set(['--output', '--styles', '--portrait', '--stills-only', '--force']);
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (!knownFlags.has(arg)) {
    console.error(`未知参数：${arg}`);
    process.exit(1);
  }
  if (valueOptions.has(arg) && !args[index + 1]) {
    console.error(`${arg} 需要一个值。`);
    process.exit(1);
  }
  if (valueOptions.has(arg)) index += 1;
}

const defaultStyleIds = ['retro-zine', 'signal', 'scatterbrain'];
const styleIds = (stylesOption >= 0 ? args[stylesOption + 1].split(',') : defaultStyleIds)
  .map((id) => id.trim())
  .filter(Boolean);
if (styleIds.length === 0 || new Set(styleIds).size !== styleIds.length) {
  console.error('--styles 至少需要一个不重复的 Style Pack id。');
  process.exit(1);
}
if (args.some((arg) => arg === '--styles' && stylesOption < 0)) {
  console.error('无法解析 --styles。');
  process.exit(1);
}
if (outputOption >= 0 && !args[outputOption + 1]) {
  console.error('--output 需要一个目录。');
  process.exit(1);
}
if (stylesOption >= 0 && !args[stylesOption + 1]) {
  console.error('--styles 需要逗号分隔的 Style Pack id。');
  process.exit(1);
}
if (styleIds.some((id) => !fs.existsSync(path.join(projectRoot, 'styles', id, 'style.json')))) {
  console.error(`未知 Style Pack：${styleIds.find((id) => !fs.existsSync(path.join(projectRoot, 'styles', id, 'style.json')))}`);
  process.exit(1);
}

if (args.length > 0 && args[0] === '--help') {
  console.log('Usage: npm run preview:templates -- [--styles id,id] [--output directory] [--portrait] [--stills-only] [--force]');
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputRoot = path.resolve((outputOption >= 0 ? args[outputOption + 1] : undefined) ?? path.join(projectRoot, 'projects', `template-family-gallery-${stamp}`));
if (fs.existsSync(outputRoot) && !force) throw new Error(`输出目录已存在，未覆盖：${outputRoot}；如需重生成请增加 --force。`);
fs.mkdirSync(path.join(outputRoot, 'assets'), {recursive: true});
fs.copyFileSync(path.join(sourceRoot, 'assets/product-workflow.svg'), path.join(outputRoot, 'assets/product-workflow.svg'));
fs.copyFileSync(path.join(sourceRoot, 'asset-manifest.semantic.json'), path.join(outputRoot, 'asset-manifest.json'));
fs.copyFileSync(path.join(sourceRoot, 'project-input.semantic.json'), path.join(outputRoot, 'project-input.json'));

const sourceStoryboard = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'storyboard.semantic.json'), 'utf8'));
const styleRoot = path.join(projectRoot, 'styles');
const styleDescriptions = {
  'retro-zine': {
    name: 'Retro Zine',
    subtitle: '编辑式知识讲解',
    use: '适合观点、报告和资料较多的讲解。',
    motion: '暖纸网格与衬线大字；内容逐项揭示，结尾留出阅读时间。'
  },
  signal: {
    name: 'Signal',
    subtitle: '信息聚焦',
    use: '适合强调因果、节点和单一观看路径。',
    motion: '深色画布与蓝色连线；节点依次聚焦，节奏克制。'
  },
  scatterbrain: {
    name: 'Scatterbrain',
    subtitle: '白板便签推演',
    use: '适合非正式解释、学习和灵感整理。',
    motion: '点阵底纹与手写感标题；信息错时入场后稳定阅读。'
  },
  'archive-grid': {
    name: 'Clean Editorial',
    subtitle: '现代编辑排版',
    use: '适合知识讲解、报告摘要和观点拆解。',
    motion: '浅色画布与荧光绿结构线；关系按步骤展开。'
  },
  'signal-noir': {
    name: 'Blueprint',
    subtitle: '技术蓝图推演',
    use: '适合系统、机制和流程解释。',
    motion: '深蓝工程网格与琥珀色连线；关系逐节点出现。'
  },
  'studio-frame': {
    name: 'Product Frame',
    subtitle: '产品演示界面',
    use: '适合产品页面、截图和工作流说明。',
    motion: '浅灰绿画布与橄榄绿结构线；突出流程顺序。'
  }
};
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
  return {id, storyboard, storyboardPath, inputProps: {storyboard: hydrated, styleTokens, renderProfile: {purpose: 'visual-preview'}}, description: styleDescriptions[id] ?? {name: id, subtitle: 'Style Pack', use: '', motion: ''}};
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
    const lastBeatEnd = Math.max(0, ...timing.scene.beats.map((beat) => beat.start + beat.duration));
    const frame = timing.startFrame + Math.min(timing.scene.durationFrames - 2, Math.max(22, lastBeatEnd + 2));
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
  <section class="template-card">
    <div class="card-heading">
      <div><p class="eyebrow">${escapeHtml(plan.id)} / STYLE PACK</p><h2>${escapeHtml(plan.description.name)}</h2><p class="subtitle">${escapeHtml(plan.description.subtitle)}</p></div>
      <a class="source-link" href="${escapeHtml(path.basename(plan.storyboardPath))}">查看 storyboard</a>
    </div>
    <div class="card-copy"><span>${escapeHtml(plan.description.use)}</span><span>${escapeHtml(plan.description.motion)}</span></div>
    ${plan.videoName ? `<div class="video-shell"><video controls autoplay loop muted playsinline preload="metadata" poster="${plan.frames[0].fileName}" src="${plan.videoName}"></video><div class="video-badge">REMOTION / SILENT MP4</div></div>` : '<div class="video-placeholder">本次使用了 --stills-only，没有生成视频。</div>'}
    <div class="frames-label"><span>关键帧 / ${plan.frames.length} SHOTS</span>${plan.qaPath ? `<a href="${escapeHtml(plan.qaPath)}">自动 QA 报告</a>` : '<span>仅代表帧</span>'}</div>
    <div class="frames">${plan.frames.map((frame, index) => `<figure><div class="frame-index">0${index + 1}</div><img src="${frame.fileName}" alt="${escapeHtml(plan.description.name)} ${escapeHtml(frame.purpose)}"><figcaption><b>${escapeHtml(frame.purpose)}</b>${escapeHtml(frame.title)}</figcaption></figure>`).join('')}</div>
  </section>`).join('');
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FrameLoom · 真实模板视频提案</title><style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#101514;color:#f1f3ee;font:15px/1.55 Inter,system-ui,-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}main{max-width:1540px;margin:auto;padding:48px 28px 80px}h1,h2,p{margin:0}h1{font-size:clamp(32px,5vw,72px);line-height:1.02;letter-spacing:-.02em;max-width:900px}a{color:#b7db3f;text-decoration:none}a:hover{text-decoration:underline}.hero{display:flex;align-items:end;justify-content:space-between;gap:30px;padding-bottom:32px;border-bottom:1px solid #34443d}.hero-copy{display:grid;gap:16px}.hero p{color:#aab9b0;max-width:750px}.hero-meta{display:grid;gap:8px;min-width:180px;color:#93a39a;font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;text-align:right}.template-card{margin-top:48px;padding:26px;background:#1a2320;border:1px solid #34443d;border-radius:8px}.card-heading{display:flex;align-items:start;justify-content:space-between;gap:20px}.eyebrow,.frames-label{color:#9aaa9f;font:11px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase}.card-heading h2{margin-top:7px;font-size:clamp(25px,3vw,44px);line-height:1.05}.subtitle{margin-top:6px;color:#b7db3f}.source-link{font-size:13px;white-space:nowrap}.card-copy{display:flex;gap:24px;flex-wrap:wrap;margin:22px 0;color:#b5c2bb}.card-copy span{max-width:520px}.video-shell{position:relative;background:#080b0a;border:1px solid #42544a;overflow:hidden}.video-shell video{display:block;width:100%;aspect-ratio:${portrait ? '9/16' : '16/9'};object-fit:contain;background:#080b0a}.video-badge{position:absolute;left:16px;bottom:14px;padding:6px 8px;background:#101514d9;color:#dce8df;font:10px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em}.video-placeholder{padding:60px 20px;text-align:center;background:#101514;border:1px dashed #42544a;color:#9aaa9f}.frames-label{display:flex;justify-content:space-between;gap:12px;margin:26px 0 12px}.frames-label a{font:inherit;letter-spacing:0;text-transform:none}.frames{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}figure{position:relative;margin:0;min-width:0}figure img{display:block;width:100%;aspect-ratio:${portrait ? '9/16' : '16/9'};object-fit:contain;background:#080b0a;border:1px solid #34443d}figcaption{padding-top:8px;color:#aebbb4;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}figcaption b{margin-right:7px;color:#e8f0ea}.frame-index{position:absolute;z-index:1;left:8px;top:8px;padding:3px 5px;background:#101514e6;color:#b7db3f;font:10px ui-monospace,SFMono-Regular,Menlo,monospace}@media(max-width:900px){main{padding:28px 14px 52px}.hero{display:grid}.hero-meta{text-align:left}.frames{grid-template-columns:repeat(2,minmax(0,1fr))}.card-heading{display:grid}.source-link{justify-self:start}}@media(max-width:520px){.template-card{padding:16px}.frames{grid-template-columns:1fr}.card-copy{display:grid;gap:8px}}
  </style></head><body><main><header class="hero"><div class="hero-copy"><p class="eyebrow">FRAMELOOM / TEMPLATE STYLE PROPOSALS</p><h1>${plans.length} 套真实视频模板，来自同一份分镜。</h1><p>${stillsOnly ? '页面中的关键帧由 Remotion renderer 实际生成；本次没有生成视频。' : '页面中的视频和关键帧均由 Remotion renderer 实际生成。视频为静音 MP4，不包含旁白或配乐；'}示例素材来源见 asset-manifest.json。</p></div><div class="hero-meta"><span>${plans.length} STYLE PACKS</span><span>${sourceStoryboard.scenes.length} SHOTS / PACK</span><span>${portrait ? '9:16 PORTRAIT' : '16:9 LANDSCAPE'}</span></div></header>${sections}</main></body></html>`;
fs.writeFileSync(path.join(outputRoot, 'index.html'), html);
console.log(`TEMPLATE GALLERY ${path.join(outputRoot, 'index.html')}`);
