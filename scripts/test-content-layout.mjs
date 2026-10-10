import fs from 'node:fs';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {getCompositions, openBrowser, renderStill} from '@remotion/renderer';
import {libraryPreviewFixtures, libraryStyleIds} from './lib/library-catalog.mjs';
import {hydrateLibraryAssets} from './lib/library-assets.mjs';
import {layoutCollector} from './lib/layout-qa.mjs';
import {createStyleTokens} from '../src/styles/style-loader.ts';
import {FONT_CATALOG} from '../src/fonts/catalog.ts';

const all = process.argv.includes('--all');
const onlyIndex = process.argv.indexOf('--only');
const only = onlyIndex >= 0 ? process.argv[onlyIndex + 1]?.split(',') : undefined;
if (process.argv.slice(2).filter((_arg, i) => onlyIndex < 0 || i + 2 !== onlyIndex && i + 2 !== onlyIndex + 1).some(arg => arg !== '--all') || onlyIndex >= 0 && !only) throw new Error('Usage: npm run test:content-layout [-- --all] [--only id,id]');
const root = path.resolve('.tmp/content-layout-regression');
fs.mkdirSync(root, {recursive: true});
const candidates = [...libraryPreviewFixtures(), ...libraryStyleIds.flatMap(styleId => [
  {id: `semantic-kinds--${styleId}`, source: 'examples/content-layout/storyboard.json', recipeId: 'semantic-default', styleId, canvas: 'landscape'},
  {id: `semantic-kinds--${styleId}--portrait`, source: 'examples/content-layout/storyboard.json', recipeId: 'semantic-default', styleId, canvas: 'portrait', portrait: true}
]), ...FONT_CATALOG.filter(font => font.id !== 'lxgw-wenkai').map(font => ({id: `semantic-font--${font.id}`, source: 'examples/content-layout/storyboard.json', recipeId: 'semantic-default', styleId: 'retro-zine', canvas: 'landscape', fontId: font.id}))];
const fixtures = candidates.filter(item => (all || item.styleId === 'retro-zine' || ['semantic-default', 'network-expand', 'compare-reveal'].includes(item.recipeId) || item.canvas === 'portrait') && (!only || only.includes(item.id)));
if (!fixtures.length) throw new Error('没有匹配的实际布局样例。');
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts'), outDir: path.join(root, 'bundle')});
const browser = await openBrowser('chrome');
const results = [];
try {
  for (const [i, fixture] of fixtures.entries()) {
    const storyboardPath = path.resolve(fixture.source), board = JSON.parse(fs.readFileSync(storyboardPath, 'utf8'));
    board.style.id = fixture.styleId; delete board.videoTemplate; board.layoutPolicy = 'content-first-v1';
    if (fixture.portrait) {board.project.width = 1080; board.project.height = 1920;}
    if (fixture.fontId) {
      const font = FONT_CATALOG.find(font => font.id === fixture.fontId);
      board.font = {id: font.id, version: font.version};
    }
    const collector = layoutCollector(board), frames = collector.frames;
    const style = JSON.parse(fs.readFileSync(`styles/${board.style.id}/style.json`)), motion = JSON.parse(fs.readFileSync(`styles/${board.style.id}/motion.json`));
    const inputProps = {storyboard: hydrateLibraryAssets(board, storyboardPath), styleTokens: createStyleTokens(style, motion, board.project.width, board.project.height, board.font), renderProfile: {purpose: 'visual-preview', showReviewMarker: false, layoutCheckFrames: frames}};
    const composition = (await getCompositions(serveUrl, {inputProps, puppeteerInstance: browser})).find(item => item.id === 'StoryboardV2');
    for (const frame of frames) await renderStill({serveUrl, composition, inputProps, frame, output: path.join(root, `${fixture.id}-${frame}.png`), imageFormat: 'png', scale: .5, puppeteerInstance: browser, onBrowserLog: collector.onBrowserLog, logLevel: 'error'});
    let report;
    try {report = collector.finish(); results.push({id: fixture.id, passed: true, ...report});}
    catch (error) {results.push({id: fixture.id, passed: false, error: error.message});}
    console.log(`LAYOUT REGRESSION ${i + 1}/${fixtures.length} ${fixture.id} ${results.at(-1).passed ? 'PASS' : results.at(-1).error}`);
  }
} finally {await browser.close({silent: true});}
fs.writeFileSync(path.join(root, 'report.json'), `${JSON.stringify({all, results}, null, 2)}\n`);
const failed = results.filter(item => !item.passed);
if (failed.length) throw new Error(`${failed.length} 个实际渲染场景未通过；详见 ${root}/report.json`);
console.log(`CONTENT LAYOUT PASS ${fixtures.length} fixtures; evidence: ${root}/report.json`);
