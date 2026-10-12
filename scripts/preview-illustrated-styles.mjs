import fs from 'node:fs';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {getCompositions, openBrowser, renderMedia, renderStill} from '@remotion/renderer';
import {loadStyleIndex} from './lib/style-catalog.mjs';
import {ILLUSTRATION_STYLES} from '../src/schemas/illustration.ts';
import {createStyleTokens} from '../src/styles/style-loader.ts';
import {projectRoot} from './lib/style-catalog.mjs';
import {hydrateLibraryAssets} from './lib/library-assets.mjs';
import {checkStoryboardInput, checkAssetInput, checkVisualInput} from './lib/preflight.mjs';
import {layoutCollector} from './lib/layout-qa.mjs';
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--styles')) throw new Error('Usage: npm run preview:illustrated -- [--styles flat-explainer,paper-collage]');
const selected = args.length ? args[1].split(',') : loadStyleIndex().styles.filter(s => s.role === 'primary' && s.status !== 'deprecated').map(s => s.id);
if (selected.some(id => !ILLUSTRATION_STYLES.includes(id)) || new Set(selected).size !== selected.length) throw new Error('请选择已注册且不重复的插画风格。');
const serveUrl = await bundle({entryPoint: path.join(projectRoot, 'src/index.ts'), outDir: path.join(projectRoot, '.tmp/illustrated-styles/bundle')});
const browser = await openBrowser('chrome');
try {
  for (const id of selected) {
    const textLed = ['annotated-reasoning', 'editorial-typography'].includes(id);
    const file = textLed ? path.join(projectRoot, 'examples/text-led-video', id, 'storyboard.json') : id === 'whiteboard' ? path.join(projectRoot, 'examples/whiteboard-original/storyboard.json') : path.join(projectRoot, 'examples/illustrated-video', id, 'curiosity.json');
    const board = JSON.parse(fs.readFileSync(file));
    const visual = checkVisualInput(board);
    const errors = [...checkStoryboardInput(board, {storyboardPath: file, styleRoot: path.join(projectRoot, 'styles'), executionMode: 'fast'}), ...visual.safeArea.issues, ...visual.textLayout].filter(issue => issue.severity === 'error').map(issue => issue.message);
    errors.push(...checkAssetInput(file));
    if (errors.length) throw new Error(`${id}: ${errors.join('；')}`);
    const style = JSON.parse(fs.readFileSync(path.join(projectRoot, 'styles', id, 'style.json'))), motion = JSON.parse(fs.readFileSync(path.join(projectRoot, 'styles', id, 'motion.json')));
    const layout = layoutCollector(board);
    const inputProps = {storyboard: hydrateLibraryAssets(board, file), styleTokens: createStyleTokens(style, motion, 1920, 1080, board.font), renderProfile: {purpose: 'visual-preview', showReviewMarker: false, layoutCheckFrames: layout.frames}};
    const composition = (await getCompositions(serveUrl, {inputProps, puppeteerInstance: browser})).find(item => item.id === 'StoryboardV2');
    const prefix = path.join(projectRoot, 'examples/template-families/previews', `${id}-${id === 'whiteboard' ? 'original' : textLed ? 'text-led' : 'illustrated'}`);
    await renderMedia({serveUrl, composition, inputProps, puppeteerInstance: browser, codec: 'h264', muted: true, audioCodec: null, outputLocation: `${prefix}.pending.mp4`, scale: .5, concurrency: 2, crf: 24, x264Preset: 'veryfast', onBrowserLog: layout.onBrowserLog, logLevel: 'error'});
    const report = layout.finish();
    const coverFrame = id === 'whiteboard' || textLed ? Math.min(board.project.durationFrames - 1, Math.max(...board.scenes[0].beats.map(beat => beat.start + beat.duration)) + Math.ceil(board.project.fps * .5)) : 135;
    await renderStill({serveUrl, composition, inputProps, puppeteerInstance: browser, frame: coverFrame, output: `${prefix}.pending.png`, imageFormat: 'png', scale: .5});
    let offset = 0;
    for (const scene of board.scenes) {
      const complete = Math.max(...scene.beats.map(beat => beat.start + beat.duration));
      await renderStill({serveUrl, composition, inputProps, puppeteerInstance: browser, frame: offset + Math.min(scene.durationFrames - 1, complete + 3), output: `${prefix}-${scene.id}.png`, imageFormat: 'png', scale: .5});
      offset += scene.durationFrames;
    }
    fs.renameSync(`${prefix}.pending.mp4`, `${prefix}.mp4`);
    fs.renameSync(`${prefix}.pending.png`, `${prefix}.png`);
    fs.writeFileSync(`${prefix}.layout-qa.json`, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`STYLE PREVIEW ${id}: ${board.project.durationSec}s, layout warnings ${report.issues.length}`);
  }
} finally {await browser.close({silent: true});}
