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
if (args.some(a => !/^--(revision=v\d+|phase=(stills|video|all)|only=(annotated|narrative))$/u.test(a))) throw new Error('Use --revision=v1 [--phase=stills|video|all] [--only=annotated|narrative]');
const option = (name, fallback) => args.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const revision = option('revision', 'v1'), phase = option('phase', 'all'), only = option('only', null), output = path.join(here, 'output', revision);
const sha = data => createHash('sha256').update(data).digest('hex');
const read = file => JSON.parse(fs.readFileSync(path.join(here, file), 'utf8'));
const plan = read('scene-plan.json'), manifest = read('asset-manifest.json');
for (const [group, ids] of Object.entries(plan.capabilities)) if (ids.some(id => !CAPABILITY_MANIFEST[group]?.includes(id))) throw new Error(`Undeclared design capability: ${group}`);
if (plan.scenes.length !== 5 || plan.scenes.some(s => s.seconds !== 6 || s.captions.length !== 2) || plan.audio !== 'silent-by-creator-choice') throw new Error('Shared comparison timeline changed');
const font = JSON.parse(fs.readFileSync(path.join(root, 'fonts/font-index.json'))).fonts.find(f => f.id === plan.font.id && f.version === plan.font.version);
if (!font) throw new Error('Missing registered study font');
for (const face of font.faces) if (sha(fs.readFileSync(path.join(root, 'public', face.file))) !== face.sha256) throw new Error('Study font bytes mismatch');
const assets = Object.fromEntries(manifest.assets.map(item => {
  const bytes = fs.readFileSync(path.join(here, item.path));
  if (sha(bytes) !== item.sha256) throw new Error(`Asset changed after inspection: ${item.id}`);
  return [item.id, `data:image/png;base64,${bytes.toString('base64')}`];
}));
const inputFiles = ['index.tsx', 'study.tsx', 'scene-plan.json', 'render.mjs', 'asset-manifest.json', 'asset-prompts.json', 'asset-followups.json'];
const inputHash = sha(Buffer.concat(inputFiles.map(name => fs.readFileSync(path.join(here, name)))));
fs.mkdirSync(output, {recursive: true});
const checksPath = path.join(output, 'study-checks.json');
const checks = fs.existsSync(checksPath) ? JSON.parse(fs.readFileSync(checksPath, 'utf8')) : {
  purpose: 'isolated-illustration-design-study', revision, inputHash, productionQa: false, creatorApproval: false,
  audio: 'silent-by-creator-choice', scriptHash: sha(Buffer.from(plan.scenes.map(s => s.narration).join('\n'))), font: plan.font, films: []
};
if (checks.inputHash !== inputHash) throw new Error(`Design inputs changed; use a new revision instead of overwriting ${revision}`);
const save = () => fs.writeFileSync(checksPath, `${JSON.stringify(checks, null, 2)}\n`);
const points = plan.scenes.flatMap((s, index) => [18, 45, 75, 105, 135, 165, 178].map(localFrame => ({scene: s.id, localFrame, frame: index * 180 + localFrame})));
const serveUrl = await bundle({entryPoint: path.join(here, 'index.tsx'), publicDir: path.join(root, 'public'), outDir: path.join(root, '.tmp/illustration-directions-pilot/bundle')});
const browser = await openBrowser('chrome');
try {
  for (const kind of ['annotated', 'narrative'].filter(kind => !only || kind === only)) {
    const inputProps = {kind, assets};
    const composition = (await getCompositions(serveUrl, {inputProps, puppeteerInstance: browser})).find(c => c.id === (kind === 'annotated' ? 'AnnotatedIllustrationStudy' : 'SceneNarrativeStudy'));
    if (!composition || composition.durationInFrames !== 900) throw new Error('Invalid isolated composition');
    let record = checks.films.find(f => f.kind === kind);
    if (!record) {record = {kind, width: 1920, height: 1080, fps: 30, seconds: 30, scriptHash: checks.scriptHash}; checks.films.push(record);}
    const samples = new Map();
    const onBrowserLog = log => {
      if (log.type === 'error') console.error(log.text);
      if (log.text.startsWith('ILLUSTRATION_LAYOUT ')) {
        const sample = JSON.parse(log.text.slice('ILLUSTRATION_LAYOUT '.length));
        if (points.some(p => p.frame === sample.frame)) samples.set(sample.frame, sample);
      }
    };
    if (phase !== 'video') {
      const frames = path.join(output, `${kind}-frames`); fs.mkdirSync(frames, {recursive: true});
      for (const point of points) {
        const image = path.join(frames, `${String(point.frame).padStart(4, '0')}-${point.scene}.jpg`);
        if (fs.existsSync(image)) throw new Error(`Frame exists; use a new revision: ${image}`);
        await renderStill({serveUrl, composition, inputProps, puppeteerInstance: browser, frame: point.frame, output: image, imageFormat: 'jpeg', jpegQuality: 90, onBrowserLog, logLevel: 'error'});
        console.log(`CHECK ${kind} ${point.scene} @ ${point.localFrame}`);
      }
      const missing = points.filter(p => !samples.has(p.frame)), issues = [...samples.values()].flatMap(sample => sample.issues.map(issue => ({frame: sample.frame, ...issue})));
      record.layout = {scope: 'Generated text bounds, text overlap, branding and caption reserves at named frames; picture semantics and motion require visual review', points, samples: [...samples.values()], missing, issues}; save();
      if (missing.length || issues.length) throw new Error(`Study text layout failed: ${JSON.stringify({missing, issues})}`);
      execFileSync('ffmpeg', ['-v', 'error', '-framerate', '1', '-pattern_type', 'glob', '-i', `${frames}/*.jpg`, '-vf', 'scale=480:270,tile=5x7:padding=8:margin=8:color=0xe6eae7', '-frames:v', '1', path.join(output, `${kind}-contact.jpg`)]);
    }
    if (phase !== 'stills') {
      if (!record.layout || record.layout.missing.length || record.layout.issues.length) throw new Error('Run still checks for this exact input first');
      const video = path.join(output, `${kind}.mp4`);
      if (fs.existsSync(video)) throw new Error(`Video exists; use a new revision: ${video}`);
      let last = -1;
      await renderMedia({serveUrl, composition, inputProps, puppeteerInstance: browser, outputLocation: video, codec: 'h264', muted: true, audioCodec: null, pixelFormat: 'yuv420p', crf: 19, x264Preset: 'fast', concurrency: 2, logLevel: 'error', onBrowserLog,
        onProgress: ({progress}) => {const step = Math.floor(progress * 10); if (step > last) {last = step; console.log(`RENDER ${kind} ${step * 10}%`);}}});
      const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', video], {encoding: 'utf8'}));
      const stream = probe.streams.find(s => s.codec_type === 'video');
      if (stream.width !== 1920 || stream.height !== 1080 || stream.avg_frame_rate !== '30/1' || Math.abs(Number(probe.format.duration) - 30) > .04 || probe.streams.some(s => s.codec_type === 'audio')) throw new Error('Unexpected silent study metadata');
      execFileSync('ffmpeg', ['-v', 'error', '-i', video, '-f', 'null', '-']);
      execFileSync('ffmpeg', ['-v', 'error', '-ss', '4.5', '-i', video, '-frames:v', '1', path.join(output, `${kind}-poster.jpg`)]);
      record.video = {file: `${kind}.mp4`, sha256: sha(fs.readFileSync(video)), bytes: fs.statSync(video).size, durationSec: Number(probe.format.duration), width: stream.width, height: stream.height, fps: stream.avg_frame_rate, silent: true, fullDecode: 'passed', sameSourcePoster: `${kind}-poster.jpg`}; save();
    }
  }
} finally {await browser.close({silent: true});}
save();
console.log(`ILLUSTRATION STUDIES READY ${output}; creator effect review remains pending`);
