import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {AssetManifestSchema} from '../../src/schemas/asset-manifest.ts';
import {ProjectPaletteSchema} from '../../src/schemas/project-palette.ts';
import {resolveProjectPalette} from '../../src/styles/project-palette.ts';

export function paletteReferenceAsset(manifest, id, projectPath) {
  const matches = manifest.assets.filter(asset => asset.id === id);
  if (matches.length !== 1) throw new Error(`配色参考素材必须唯一且已登记：${id}`);
  const asset = matches[0];
  if (!['image', 'screenshot'].includes(asset.type) || !['palette-reference', 'both'].includes(asset.usage)) throw new Error(`素材未声明为图片配色参考：${id}`);
  const file = path.resolve(projectPath, asset.path);
  if (!path.isAbsolute(asset.path)) {
    const relative = path.relative(fs.realpathSync(projectPath), fs.realpathSync(file));
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error(`配色参考路径不能逃出项目：${id}`);
  }
  if (!fs.statSync(file).isFile() || fs.statSync(file).size === 0) throw new Error(`配色参考不存在或为空：${id}`);
  return {asset, file};
}

export function resolvePaletteEvidence(paletteInput, projectPath) {
  if (!paletteInput) return undefined;
  const palette = ProjectPaletteSchema.parse(paletteInput);
  let sources = [];
  if (palette.source === 'assets') {
    if (!projectPath) throw new Error('素材配色需要项目路径以核对参考素材字节。');
    const manifest = AssetManifestSchema.parse(JSON.parse(fs.readFileSync(path.join(projectPath, 'asset-manifest.json'), 'utf8')));
    sources = palette.referenceAssets.map(id => {
      const {asset, file} = paletteReferenceAsset(manifest, id, projectPath);
      return {id, path: asset.path, source: asset.source, license: asset.license, intendedUse: asset.intendedUse, usage: asset.usage, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
    });
  }
  return {input: palette, resolved: {light: resolveProjectPalette(palette, false), dark: resolveProjectPalette(palette, true)}, sources};
}
