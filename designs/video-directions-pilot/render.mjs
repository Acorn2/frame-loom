import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {bundle} from '@remotion/bundler';
import {getCompositions, openBrowser, renderMedia, renderStill} from '@remotion/renderer';
import {CAPABILITY_MANIFEST} from '../../src/renderer/capability-manifest.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const args = process.argv.slice(2);
if (args.some(a => !/^--(phase=(stills|video|all)|revision=v\d+|only=(mechanism|product))$/.test(a))) {
  throw new Error('Usage: node --import tsx/esm designs/video-directions-pilot/render.mjs [--phase=stills|video|all] [--revision=v1] [--only=mechanism|product]');
}
const option = (name, fallback) => args.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const phase = option('phase', 'all'), revision = option('revision', 'v1'), only = option('only', null);
const output = path.join(here, 'output', revision);
const plan = JSON.parse(fs.readFileSync(path.join(here, 'scene-plan.json'), 'utf8'));
for (const [family, values] of Object.entries(plan.capabilities)) {
  if (values.some(id => !CAPABILITY_MANIFEST[family]?.includes(id))) throw new Error(`Prototype uses an undeclared capability: ${family}`);
}
const sha = buffer => createHash('sha256').update(buffer).digest('hex');
const sourcesFile = revision === 'v1' || revision === 'v2' ? 'assets/sources.json' : 'assets/sources-3x.json';
const sources = JSON.parse(fs.readFileSync(path.join(here, sourcesFile), 'utf8'));
const assets = Object.fromEntries(sources.files.map(item => {
  const data = fs.readFileSync(path.join(here, 'assets', item.file));
  if (sha(data) !== item.sha256) throw new Error(`Screenshot fingerprint changed: ${item.file}`);
  return [item.alias ?? item.file, `data:image/png;base64,${data.toString('base64')}`];
}));
const fonts = JSON.parse(fs.readFileSync(path.join(root, 'fonts/font-index.json'), 'utf8'));
const font = fonts.fonts.find(f => f.id === plan.font.id && f.version === plan.font.version);
if (!font) throw new Error('Unregistered study font');
for (const face of font.faces) if (sha(fs.readFileSync(path.join(root, 'public', face.file))) !== face.sha256) throw new Error('Study font fingerprint mismatch');
for (const film of plan.films) {
  if (film.scenes.some(s => !Number.isInteger(s.seconds * plan.fps) || s.seconds <= 0)) throw new Error('Invalid scene duration');
}
fs.mkdirSync(output, {recursive: true});
const checksPath = path.join(output, 'study-checks.json');
const checks = fs.existsSync(checksPath) ? JSON.parse(fs.readFileSync(checksPath, 'utf8')) : {
  purpose: 'isolated-design-study', status: 'creator-review-pending', revision,
  fullPlaybackApproval: false, productionQa: false, audio: 'silent',
  inputHash: sha(Buffer.concat(['index.tsx', 'study.tsx', 'scene-plan.json', sourcesFile].map(p => fs.readFileSync(path.join(here, p))))),
  font: plan.font, sourceImages: sources.files, films: []
};
const currentHash = sha(Buffer.concat(['index.tsx', 'study.tsx', 'scene-plan.json', sourcesFile].map(p => fs.readFileSync(path.join(here, p)))));
if (checks.inputHash !== currentHash) throw new Error(`Inputs changed; use a new --revision instead of replacing ${revision}`);
const save = () => fs.writeFileSync(checksPath, `${JSON.stringify(checks, null, 2)}\n`);
console.log('Bundling isolated studies; production catalogs are not changed.');
const serveUrl = await bundle({entryPoint: path.join(here, 'index.tsx'), publicDir: path.join(root, 'public'), outDir: path.join(root, '.tmp/video-directions-pilot/bundle')});
const browser = await openBrowser('chrome');
try {
  for (const film of plan.films.filter(f => !only || f.slug === only)) {
    const inputProps = {kind: film.slug, assets};
    const composition = (await getCompositions(serveUrl, {inputProps, puppeteerInstance: browser})).find(c => c.id === film.id);
    if (!composition) throw new Error(`Missing ${film.id}`);
    let cursor = 0;
    const checkpoints = film.scenes.flatMap(s => {
      const start = cursor, frames = s.seconds * plan.fps;
      cursor += frames;
      return [
        {scene: s.id, name: 'entry', frame: start + 18},
        {scene: s.id, name: 'middle', frame: start + Math.floor(frames / 2)},
        {scene: s.id, name: 'complete', frame: start + frames - 20},
        {scene: s.id, name: 'exit', frame: start + frames - 6}
      ];
    });
    const samples = new Map();
    const onBrowserLog = log => {
      if (log.type === 'error') console.error(log.text);
      if (log.text.startsWith('STUDY_LAYOUT ')) {
        const sample = JSON.parse(log.text.slice('STUDY_LAYOUT '.length));
        if (checkpoints.some(c => c.frame === sample.frame)) samples.set(sample.frame, sample);
      }
    };
    let record = checks.films.find(f => f.id === film.id);
    if (!record) {record = {id: film.id, name: film.name, seconds: composition.durationInFrames / plan.fps, width: composition.width, height: composition.height, fps: composition.fps}; checks.films.push(record);}
    if (phase !== 'video') {
      const frameDir = path.join(output, `${film.slug}-frames`);
      fs.mkdirSync(frameDir, {recursive: true});
      for (const point of checkpoints) {
        console.log(`${film.slug} ${point.scene} / ${point.name} @ ${point.frame}`);
        const image = path.join(frameDir, `${String(point.frame).padStart(4, '0')}-${point.scene}-${point.name}.jpg`);
        if (fs.existsSync(image)) throw new Error(`Frame already exists; use a new revision: ${image}`);
        await renderStill({serveUrl, composition, inputProps, puppeteerInstance: browser, output: image, frame: point.frame, imageFormat: 'jpeg', jpegQuality: 88, onBrowserLog, logLevel: 'error'});
      }
      const missing = checkpoints.filter(c => !samples.has(c.frame));
      const issues = [...samples.values()].flatMap(s => s.issues.map(i => ({frame: s.frame, ...i})));
      record.frameChecks = checkpoints;
      record.layout = {scope: 'generated text bounds only; screenshot text and diagram semantics require visual review', samples: [...samples.values()], missing, issues};
      save();
      if (missing.length || issues.length) throw new Error(`Measured study bounds failed: ${JSON.stringify({missing, issues})}`);
      const posterFrame = film.slug === 'mechanism' ? 110 : 110;
      await renderStill({serveUrl, composition, inputProps, puppeteerInstance: browser, output: path.join(output, `${film.slug}-poster.jpg`), frame: posterFrame, imageFormat: 'jpeg', jpegQuality: 93, logLevel: 'error'});
      execFileSync('ffmpeg', ['-v', 'error', '-framerate', '1', '-pattern_type', 'glob', '-i', `${frameDir}/*.jpg`, '-vf', 'scale=480:270,tile=4x5:padding=8:margin=8:color=0x28313b', '-frames:v', '1', path.join(output, `${film.slug}-contact.jpg`)]);
    }
    if (phase !== 'stills') {
      const video = path.join(output, `${film.slug}.mp4`);
      if (fs.existsSync(video)) throw new Error(`Video already exists; use a new revision: ${video}`);
      console.log(`Rendering ${film.slug}: ${record.seconds}s / ${record.width}×${record.height}`);
      let last = -1;
      await renderMedia({serveUrl, composition, inputProps, puppeteerInstance: browser, outputLocation: video, codec: 'h264', muted: true, audioCodec: null, pixelFormat: 'yuv420p', crf: 20, x264Preset: 'fast', concurrency: 2, onBrowserLog, logLevel: 'error', onProgress: progress => {
        const part = Math.floor(progress.progress * 10);
        if (part > last) {last = part; console.log(`${film.slug} ${Math.min(100, part * 10)}%`);}
      }});
      const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', video], {encoding: 'utf8'}));
      const stream = probe.streams.find(s => s.codec_type === 'video');
      if (stream.width !== plan.width || stream.height !== plan.height || stream.avg_frame_rate !== '30/1' || probe.streams.some(s => s.codec_type === 'audio') || Math.abs(Number(probe.format.duration) - record.seconds) > .04) throw new Error('Unexpected MP4 metadata');
      execFileSync('ffmpeg', ['-v', 'error', '-i', video, '-f', 'null', '-'], {stdio: 'pipe'});
      record.video = {file: `${film.slug}.mp4`, sha256: sha(fs.readFileSync(video)), bytes: fs.statSync(video).size, duration: Number(probe.format.duration), codec: stream.codec_name, pixelFormat: stream.pix_fmt, silent: true, fullDecode: 'passed'};
      save();
    }
  }
} finally {await browser.close({silent: true});}
save();
console.log(`STUDIES READY ${output}; creator visual approval remains pending.`);
