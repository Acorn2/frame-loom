import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {buildLibraryCatalog} from './lib/library-catalog.mjs';
import {projectRoot} from './lib/style-catalog.mjs';
import {publicTtsPresets} from './lib/library-tts-catalog.mjs';
import {verifyAllFonts} from '../src/fonts/assets.ts';

function mediaEntries(catalog) {
  const recipes = [...catalog.recipes, ...catalog.recipes.flatMap(item => item.previewVariants ?? [])];
  return [...catalog.styles, ...(catalog.fontPreviews ?? []), ...recipes, ...recipes.flatMap(item => item.stylePreviews ?? [])];
}
export function assertLibraryPreviews(catalog) {
  const missing = [];
  for (const entry of mediaEntries(catalog).filter(entry => entry.kind !== 'font-combination')) {
    for (const type of ['poster', 'video']) {
      const source = entry[`${type}Source`];
      const file = source && path.join(projectRoot, source);
      if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile() || fs.statSync(file).size === 0) missing.push(`${entry.id}/${type}`);
    }
  }
  if (missing.length) throw new Error(`发布构建需要完整、当前有效的公开预览：${missing.join(', ')}。请先运行 npm run preview:library。`);
}

export function buildLibrary(output = path.join(projectRoot, 'dist/library'), {requirePreviews = false} = {}) {
  const catalog = {...buildLibraryCatalog(), ttsPresets: publicTtsPresets()};
  verifyAllFonts();
  const covers = JSON.parse(fs.readFileSync(path.join(projectRoot, 'library/style-covers/manifest.json'), 'utf8')).covers;
  for (const style of catalog.styles) {
    const cover = covers.find(item => item.id === style.id);
    const video = fs.readFileSync(path.join(projectRoot, style.videoSource));
    if (!cover || cover.source !== style.videoSource || cover.sourceSha256 !== createHash('sha256').update(video).digest('hex')) throw new Error(`风格封面已失效：${style.id}；运行 node scripts/prepare-style-covers.mjs。`);
    style.posterSource = `library/style-covers/${style.id}.png`;
    const tokens = JSON.parse(fs.readFileSync(path.join(projectRoot, 'styles', style.id, 'style.json'), 'utf8')).tokens;
    style.displayColors = ['background', 'ink', 'accent'].map((key, index) => ({role: ['背景', '文字', '强调'][index], color: tokens[key]}));
  }
  if (requirePreviews) assertLibraryPreviews(catalog);
  fs.mkdirSync(output, {recursive: true});
  for (const name of ['index.html', 'shots.html', 'selection.html', 'library.css', 'app.mjs', 'selection.mjs', 'dropdown.mjs', 'presentation.mjs', 'detail.mjs', 'recipe-copy.mjs', 'style-cards.mjs', 'font-picker.mjs']) {
    fs.copyFileSync(path.join(projectRoot, 'library', name), path.join(output, name));
  }
  for (const font of catalog.fonts) {
    for (const file of [font.licenseFile, ...font.faces.map(face => face.file)]) {
      const target = path.join(output, file);
      fs.mkdirSync(path.dirname(target), {recursive: true});
      fs.copyFileSync(path.join(projectRoot, 'public', file), target);
    }
  }
  for (const entry of mediaEntries(catalog)) {
    for (const type of ['poster', 'video']) {
      const source = entry[`${type}Source`];
      if (!source || !fs.existsSync(path.join(projectRoot, source))) {entry[type] = null; continue;}
      const relative = `media/${entry.kind ?? 'style'}-${entry.id}${path.extname(source)}`;
      fs.mkdirSync(path.join(output, 'media'), {recursive: true});
      fs.copyFileSync(path.join(projectRoot, source), path.join(output, relative));
      entry[type] = relative;
    }
    delete entry.posterSource; delete entry.videoSource;
  }
  fs.writeFileSync(path.join(output, 'catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`);
  fs.writeFileSync(path.join(output, '.nojekyll'), '');
  console.log(`LIBRARY BUILT ${output} (${catalog.styles.length} styles, ${catalog.recipes.filter(item => item.kind === 'scene').length} scene recipes)`);
  return output;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--require-previews') || args.length > 1) throw new Error('Usage: npm run build:library -- [--require-previews]');
  buildLibrary(undefined, {requirePreviews: args.includes('--require-previews')});
}
