import {hydrateLibraryAssets} from './lib/library-assets.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {getCompositions, openBrowser, renderMedia, renderStill} from '@remotion/renderer';
import {libraryPreviewFixtures, previewFingerprint, previewRoot} from './lib/library-catalog.mjs';
import {projectRoot} from './lib/style-catalog.mjs';
import {StylePackSchema, MotionPackSchema} from '../src/schemas/style-pack.ts';
import {createStyleTokens} from '../src/styles/style-loader.ts';
import {getSceneTimeline} from '../src/timeline/scene-timeline.ts';
import {checkStoryboardInput, checkAssetInput, checkVisualInput} from './lib/preflight.mjs';

if (process.argv.slice(2).length) throw new Error('Usage: npm run preview:library');
const lockRoot = path.join(projectRoot, '.tmp/library-render');
fs.mkdirSync(lockRoot, {recursive: true});
const lockPath = path.join(lockRoot, 'run.lock');
if (fs.existsSync(lockPath)) {
  const pid = Number(fs.readFileSync(lockPath, 'utf8'));
  if (!Number.isInteger(pid) || pid <= 0) throw new Error('公开样片生成锁无效，请检查 .tmp/library-render/run.lock。');
  let active = true;
  try {process.kill(pid, 0);} catch (error) {if (error.code === 'ESRCH') active = false; else throw error;}
  if (active) throw new Error(`公开样片已经由进程 ${pid} 生成中，请等待该任务完成。`);
  fs.unlinkSync(lockPath);
}
fs.writeFileSync(lockPath, String(process.pid), {flag: 'wx'});
process.on('exit', () => {if (fs.existsSync(lockPath) && fs.readFileSync(lockPath, 'utf8') === String(process.pid)) fs.unlinkSync(lockPath);});
fs.mkdirSync(previewRoot, {recursive: true});
const fingerprint = previewFingerprint();
const manifestPath = path.join(previewRoot, 'manifest.json');
const prior = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : null;
const manifest = {fingerprint, purpose: 'public-recipe-samples', samples: prior?.fingerprint === fingerprint ? prior.samples : []};
const fixtures = libraryPreviewFixtures();
const pending = fixtures.filter(item => !manifest.samples.some(sample => sample.id === item.id) || !fs.existsSync(path.join(previewRoot, `${item.id}.mp4`)) || !fs.existsSync(path.join(previewRoot, `${item.id}.png`)));
if (!pending.length) {console.log(`LIBRARY PREVIEWS current (${fixtures.length} samples)`); process.exit(0);}
console.log(`Preparing ${pending.length} public recipe samples; no user project or TTS involved.`);
const serveUrl = await bundle({entryPoint: path.join(projectRoot, 'src/index.ts'), outDir: path.join(projectRoot, '.tmp/library-render/bundle')});
const queue = [...pending.entries()];
// Each sample worker owns its browser; one frame worker avoids competing tab cycles.
await Promise.all(Array.from({length: 3}, async () => {
  const browser = await openBrowser('chrome');
  try {
  while (queue.length) {
    const [index, fixture] = queue.shift();
    const storyboardPath = path.join(projectRoot, fixture.source);
    const storyboard = JSON.parse(fs.readFileSync(storyboardPath, 'utf8'));
    storyboard.style.id = fixture.styleId;
    // Preview the independent style + shot combination, not the optional preset.
    delete storyboard.videoTemplate;
    const styleRoot = path.join(projectRoot, 'styles');
    const issues = checkStoryboardInput(storyboard, {storyboardPath, styleRoot, executionMode: 'fast'});
    const visual = checkVisualInput(storyboard);
    const errors = [...issues.filter(item => item.severity === 'error').map(item => item.message), ...checkAssetInput(storyboardPath),
      ...visual.safeArea.issues.filter(item => item.severity === 'error').map(item => item.message), ...visual.textLayout.filter(item => item.severity === 'error').map(item => item.message)];
    if (errors.length) throw new Error(`${fixture.id}: ${errors.join('；')}`);
    const style = StylePackSchema.parse(JSON.parse(fs.readFileSync(path.join(styleRoot, storyboard.style.id, 'style.json'), 'utf8')));
    const motion = MotionPackSchema.parse(JSON.parse(fs.readFileSync(path.join(styleRoot, storyboard.style.id, 'motion.json'), 'utf8')));
    const inputProps = {storyboard: hydrateLibraryAssets(storyboard, storyboardPath), styleTokens: createStyleTokens(style, motion, storyboard.project.width, storyboard.project.height, storyboard.font, storyboard.palette), renderProfile: {purpose: 'visual-preview', showReviewMarker: false}};
    const composition = (await getCompositions(serveUrl, {inputProps, puppeteerInstance: browser})).find(item => item.id === 'StoryboardV2');
    if (!composition) throw new Error('缺少 StoryboardV2 composition。');
    console.log(`[${index + 1}/${pending.length}] ${fixture.id}`);
    const pendingVideo = path.join(previewRoot, `${fixture.id}.pending.mp4`);
    const pendingPoster = path.join(previewRoot, `${fixture.id}.pending.png`);
    await renderMedia({serveUrl, composition, inputProps, puppeteerInstance: browser, codec: 'h264', muted: true, audioCodec: null,
      outputLocation: pendingVideo, scale: .5, concurrency: 1, crf: 24, x264Preset: 'veryfast'});
    const timeline = getSceneTimeline(storyboard);
    // The basic recipe demonstrates a diagram and a closing; show the diagram on its card.
    const timing = fixture.recipeId === 'semantic-default' ? timeline[0] : timeline.at(-1);
    const lastBeat = Math.max(0, ...timing.scene.beats.map(beat => beat.start + beat.duration));
    const textEntrance = fixture.recipeId === 'semantic-default' ? Math.round(composition.fps * .6) : 0;
    const frame = Math.min(composition.durationInFrames - 1, timing.startFrame + Math.max(22, lastBeat + textEntrance + 2));
    await renderStill({serveUrl, composition, inputProps, puppeteerInstance: browser, frame, output: pendingPoster, imageFormat: 'png', scale: .5});
    fs.renameSync(pendingVideo, path.join(previewRoot, `${fixture.id}.mp4`));
    fs.renameSync(pendingPoster, path.join(previewRoot, `${fixture.id}.png`));
    manifest.samples = [...manifest.samples.filter(item => item.id !== fixture.id), {id: fixture.id, fixture: fixture.source, style: fixture.styleId, durationSec: composition.durationInFrames / composition.fps, posterFrame: frame}];
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  } finally {await browser.close({silent: true});}
}));
console.log(`LIBRARY PREVIEWS ${previewRoot} (${manifest.samples.length} actual renderer samples)`);
