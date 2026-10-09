import fs from 'node:fs';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {getCompositions, openBrowser, renderMedia, renderStill} from '@remotion/renderer';
import {projectRoot} from './lib/style-catalog.mjs';
import {fontPreviewRoot, fontPreviewFixture, fontPreviewCombinations, fontPreviewFingerprint} from './lib/font-previews.mjs';
import {FONT_CATALOG} from '../src/fonts/catalog.ts';
import {verifyAllFonts} from '../src/fonts/assets.ts';
import {createStyleTokens} from '../src/styles/style-loader.ts';
import {checkStoryboardInput, checkVisualInput} from './lib/preflight.mjs';

if (process.argv.length > 2) throw new Error('Usage: npm run preview:fonts');
verifyAllFonts();
fs.mkdirSync(fontPreviewRoot, {recursive: true});
const fingerprint = fontPreviewFingerprint();
const manifestPath = path.join(fontPreviewRoot, 'manifest.json');
const previous = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : undefined;
const manifest = {fingerprint, purpose: 'public-font-combinations', samples: previous?.fingerprint === fingerprint ? previous.samples : []};
const combinations = fontPreviewCombinations();
const pending = combinations.filter(item => !manifest.samples.some(sample => sample.id === item.id) || !['png', 'mp4'].every(extension => fs.existsSync(path.join(fontPreviewRoot, `${item.id}.${extension}`))));
if (!pending.length) {console.log(`FONT PREVIEWS current (${combinations.length} combinations)`); process.exit(0);}
const serveUrl = await bundle({entryPoint: path.join(projectRoot, 'src/index.ts'), outDir: path.join(projectRoot, '.tmp/font-selection/bundle')});
const browser = await openBrowser('chrome');
try {
  for (const [index, item] of pending.entries()) {
    const storyboard = JSON.parse(fs.readFileSync(path.join(projectRoot, fontPreviewFixture), 'utf8'));
    storyboard.style.id = item.style;
    const font = FONT_CATALOG.find(font => font.id === item.font);
    storyboard.font = {id: font.id, version: font.version};
    const styleDirectory = path.join(projectRoot, 'styles', item.style);
    const style = JSON.parse(fs.readFileSync(path.join(styleDirectory, 'style.json'), 'utf8'));
    const motion = JSON.parse(fs.readFileSync(path.join(styleDirectory, 'motion.json'), 'utf8'));
    const issues = checkStoryboardInput(storyboard, {styleRoot: path.join(projectRoot, 'styles'), executionMode: 'fast'});
    const visual = checkVisualInput(storyboard);
    const errors = [...issues, ...visual.textLayout, ...visual.safeArea.issues].filter(issue => issue.severity === 'error');
    if (errors.length) throw new Error(`${item.id}: ${errors.map(issue => issue.message).join('；')}`);
    const inputProps = {storyboard, styleTokens: createStyleTokens(style, motion, 1920, 1080, storyboard.font, storyboard.palette), renderProfile: {purpose: 'visual-preview', showReviewMarker: false}};
    const composition = (await getCompositions(serveUrl, {inputProps, puppeteerInstance: browser})).find(item => item.id === 'StoryboardV2');
    console.log(`FONT PREVIEW [${index + 1}/${pending.length}] ${item.id}`);
    const video = path.join(fontPreviewRoot, `${item.id}.pending.mp4`);
    const poster = path.join(fontPreviewRoot, `${item.id}.pending.png`);
    await renderMedia({serveUrl, composition, inputProps, puppeteerInstance: browser, codec: 'h264', muted: true, audioCodec: null, outputLocation: video, scale: .5, concurrency: 2, crf: 24, x264Preset: 'veryfast'});
    await renderStill({serveUrl, composition, inputProps, puppeteerInstance: browser, frame: 135, output: poster, imageFormat: 'png', scale: .5});
    fs.renameSync(video, path.join(fontPreviewRoot, `${item.id}.mp4`));
    fs.renameSync(poster, path.join(fontPreviewRoot, `${item.id}.png`));
    manifest.samples.push({...item, version: font.version, posterFrame: 135, durationSec: 6});
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
} finally {await browser.close({silent: true});}
console.log(`FONT PREVIEWS ${fontPreviewRoot} (${manifest.samples.length} actual renderer combinations)`);
