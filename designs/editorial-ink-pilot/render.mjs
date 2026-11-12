import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {bundle} from '@remotion/bundler';
import {getCompositions, openBrowser, renderMedia, renderStill} from '@remotion/renderer';
import {CAPABILITY_MANIFEST} from '../../src/renderer/capability-manifest.ts';

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../..');
const args = process.argv.slice(2);
if (args.some(a => !/^--(revision=v\d+|phase=(stills|video|all))$/.test(a))) throw new Error('Use --revision=v1 [--phase=stills|video|all]');
const option = (key, fallback) => args.find(a => a.startsWith(`--${key}=`))?.split('=')[1] ?? fallback;
const revision = option('revision', 'v1'), phase = option('phase', 'all'), out = path.join(here, 'output', revision);
const plan = JSON.parse(fs.readFileSync(path.join(here, 'scene-plan.json'))), sha = bytes => createHash('sha256').update(bytes).digest('hex');
for (const [family, values] of Object.entries(plan.capabilities)) if (values.some(id => !CAPABILITY_MANIFEST[family]?.includes(id))) throw new Error(`Undeclared capability: ${family}`);
if (plan.data.A !== 90 || plan.data.B !== 100 || plan.data.truncatedOrigin !== 80 || plan.data.maximum <= 100 || plan.data.kind !== 'illustrative-not-observed') throw new Error('Study data does not match its source disclosure');
const font = JSON.parse(fs.readFileSync(path.join(root, 'fonts/font-index.json'))).fonts.find(f => f.id === plan.font.id && f.version === plan.font.version);
if (!font) throw new Error('Unregistered study font');
for (const face of font.faces) if (sha(fs.readFileSync(path.join(root, 'public', face.file))) !== face.sha256) throw new Error('Study font fingerprint mismatch');
fs.mkdirSync(out, {recursive: true});
const inputHash = sha(Buffer.concat(['study.tsx', 'index.tsx', 'scene-plan.json', 'render.mjs'].map(file => fs.readFileSync(path.join(here, file)))));
const checksPath = path.join(out, 'study-checks.json');
const checks = fs.existsSync(checksPath) ? JSON.parse(fs.readFileSync(checksPath)) : {purpose: 'isolated-design-study', revision, inputHash, font: plan.font, data: plan.data, status: 'creator-review-pending', productionQa: false, fullPlaybackApproval: false};
if (checks.inputHash !== inputHash) throw new Error('Study input changed. Use a new revision.');
const save = () => fs.writeFileSync(checksPath, `${JSON.stringify(checks, null, 2)}\n`);
let cursor = 0;
const checkpoints = plan.scenes.flatMap(scene => {
  const start = cursor, frames = scene.seconds * plan.fps; cursor += frames;
  const points = [18, Math.round(frames / 3), Math.round(frames / 2), frames - 35, frames - 3];
  return [...new Set(points)].map(frame => ({scene: scene.id, localFrame: frame, frame: start + frame}));
});
const samples = new Map();
const onBrowserLog = log => {
  if (log.type === 'error') console.error(log.text);
  if (log.text.startsWith('EDITORIAL_LAYOUT ')) {
    const sample = JSON.parse(log.text.slice('EDITORIAL_LAYOUT '.length));
    if (checkpoints.some(c => c.frame === sample.frame)) samples.set(sample.frame, sample);
  }
};
const serveUrl = await bundle({entryPoint: path.join(here, 'index.tsx'), publicDir: path.join(root, 'public'), outDir: path.join(root, '.tmp/editorial-ink-pilot/bundle')});
const browser = await openBrowser('chrome');
try {
  const composition = (await getCompositions(serveUrl, {puppeteerInstance: browser})).find(c => c.id === 'EditorialInkStudy');
  if (!composition || composition.durationInFrames !== cursor) throw new Error('Invalid study composition');
  if (phase !== 'video') {
    const frames = path.join(out, 'frames'); fs.mkdirSync(frames, {recursive: true});
    for (const point of checkpoints) {
      const file = path.join(frames, `${String(point.frame).padStart(4, '0')}-${point.scene}.jpg`);
      if (fs.existsSync(file)) throw new Error('Frames already exist. Use a new revision.');
      await renderStill({serveUrl, composition, puppeteerInstance: browser, output: file, frame: point.frame, imageFormat: 'jpeg', jpegQuality: 90, onBrowserLog, logLevel: 'error'});
      console.log(`CHECK ${point.scene} @ ${point.frame}`);
    }
    const missing = checkpoints.filter(p => !samples.has(p.frame)), issues = [...samples.values()].flatMap(s => s.issues.map(i => ({frame: s.frame, ...i})));
    checks.layout = {points: checkpoints, samples: [...samples.values()], missing, issues, scope: 'Generated text bounds and overlap at named events. Semantic and full-motion review remains separate.'}; save();
    if (missing.length || issues.length) throw new Error(`Measured study bounds failed: ${JSON.stringify({missing, issues})}`);
    execFileSync('ffmpeg', ['-v', 'error', '-framerate', '1', '-pattern_type', 'glob', '-i', `${frames}/*.jpg`, '-vf', 'scale=480:270,tile=5x5:padding=8:margin=8:color=0xe2e4e1', '-frames:v', '1', path.join(out, 'editorial-contact.jpg')]);
  }
  if (phase !== 'stills') {
    if (!checks.layout || checks.layout.missing.length || checks.layout.issues.length) throw new Error('Run the still checks for this input before encoding');
    const video = path.join(out, 'editorial.mp4');
    if (fs.existsSync(video)) throw new Error('Video already exists. Use a new revision.');
    let last = -1;
    await renderMedia({serveUrl, composition, puppeteerInstance: browser, outputLocation: video, codec: 'h264', muted: true, audioCodec: null, pixelFormat: 'yuv420p', crf: 19, x264Preset: 'fast', concurrency: 2, logLevel: 'error', onProgress: ({progress}) => {
      const bucket = Math.floor(progress * 10); if (last !== bucket) {last = bucket; console.log(`EDITORIAL ${bucket * 10}%`);}
    }});
    const info = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', video], {encoding: 'utf8'}));
    const stream = info.streams.find(s => s.codec_type === 'video');
    if (stream.width !== plan.width || stream.height !== plan.height || stream.avg_frame_rate !== '30/1' || info.streams.some(s => s.codec_type === 'audio') || Math.abs(Number(info.format.duration) - cursor / plan.fps) > .04) throw new Error('Unexpected MP4 metadata');
    execFileSync('ffmpeg', ['-v', 'error', '-i', video, '-f', 'null', '-']);
    execFileSync('ffmpeg', ['-v', 'error', '-ss', String(130 / plan.fps), '-i', video, '-frames:v', '1', path.join(out, 'editorial-poster.jpg')]);
    checks.video = {sha256: sha(fs.readFileSync(video)), bytes: fs.statSync(video).size, duration: Number(info.format.duration), width: stream.width, height: stream.height, fps: stream.avg_frame_rate, silent: true, fullDecode: 'passed', poster: 'editorial-poster.jpg'}; save();
  }
} finally {await browser.close({silent: true});}
console.log(`EDITORIAL STUDY READY ${out}; creator visual approval remains pending.`);
