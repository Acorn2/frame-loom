import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolveFont, FONT_CATALOG, type FontRef} from './catalog';

export const fontProjectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export function fontAssetFiles(ref: FontRef, root = fontProjectRoot): string[] {
  const font = resolveFont(ref);
  return [path.join(root, 'fonts/font-index.json'), ...[font.licenseFile, ...font.faces.map(face => face.file)].map(file => path.join(root, 'public', file))];
}

export function verifyFontAssets(ref: FontRef, root = fontProjectRoot) {
  const font = resolveFont(ref);
  const assets = [{file: font.licenseFile, sha256: font.licenseSha256}, ...font.faces];
  for (const asset of assets) {
    const file = path.join(root, 'public', asset.file);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`缺少项目字体文件：${asset.file}`);
    if (createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== asset.sha256) throw new Error(`字体文件校验失败：${asset.file}；请恢复清单记录的官方版本。`);
  }
  return font;
}

export function verifyAllFonts(root = fontProjectRoot) {
  return FONT_CATALOG.map(font => verifyFontAssets({id: font.id as FontRef['id'], version: font.version}, root));
}
