import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {projectRoot, loadStyleIndex} from './style-catalog.mjs';
import {FONT_CATALOG} from '../../src/fonts/catalog.ts';

export const fontPreviewRoot = path.join(projectRoot, 'library/font-previews');
export const fontPreviewFixture = 'examples/font-selection/storyboard.json';
export function fontPreviewFingerprint() {
  function files(directory) {
    return fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
      const file = path.join(directory, entry.name);
      return entry.isDirectory() ? files(file) : [file];
    });
  }
  const hash = createHash('sha256');
  for (const file of [...files(path.join(projectRoot, 'src')), ...files(path.join(projectRoot, 'styles')),
    ...['fonts/font-index.json', fontPreviewFixture, 'scripts/preview-fonts.mjs', 'scripts/lib/font-previews.mjs', 'package-lock.json'].map(name => path.join(projectRoot, name))].sort()) {
    hash.update(path.relative(projectRoot, file)); hash.update(fs.readFileSync(file));
  }
  return hash.digest('hex');
}
export function fontPreviewCombinations() {
  return loadStyleIndex().styles.filter(style => style.status !== 'deprecated').flatMap(style => FONT_CATALOG.map(font => ({
    id: `${style.id}--${font.id}`, style: style.id, font: font.id
  })));
}
export function readFontPreviews() {
  const file = path.join(fontPreviewRoot, 'manifest.json');
  const manifest = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : undefined;
  const fresh = manifest?.fingerprint === fontPreviewFingerprint();
  return fontPreviewCombinations().map(item => {
    const posterSource = `library/font-previews/${item.id}.png`;
    const videoSource = `library/font-previews/${item.id}.mp4`;
    const complete = fresh && manifest.samples.some(sample => sample.id === item.id) && [posterSource, videoSource].every(source => fs.existsSync(path.join(projectRoot, source)) && fs.statSync(path.join(projectRoot, source)).size > 0);
    return {...item, kind: 'font-combination', previewStatus: complete ? 'ready' : manifest ? 'stale' : 'missing', posterSource: complete ? posterSource : null, videoSource: complete ? videoSource : null};
  });
}
