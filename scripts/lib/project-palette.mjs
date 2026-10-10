import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {AssetManifestSchema} from '../../src/schemas/asset-manifest.ts';
import {ProjectPaletteSchema} from '../../src/schemas/project-palette.ts';
import {resolveProjectPalette} from '../../src/styles/project-palette.ts';
import {paletteReferenceAsset, samplePalette} from './palette-sampling.mjs';
export {paletteReferenceAsset} from './palette-sampling.mjs';

function verifyRoleEvidence(palette, projectPath) {
  if (palette.schemaVersion !== '1.1' || palette.source !== 'assets') return undefined;
  const samples = new Map();
  const roles = Object.keys(palette.colors);
  const coreRegions = new Set();
  for (const role of ['accent', 'lightBackground', 'ink']) {
    if (!('assetId' in palette.evidence[role])) throw new Error(`palette.evidence.${role} 必须直接采样；只有按钮颜色不足以代表全片配色。`);
    const item = palette.evidence[role];
    const region = JSON.stringify([item.assetId, item.region]);
    if (coreRegions.has(region)) throw new Error('背景、正文、强调色须分别选择语义区域，不能复用同一个按钮采样区域。');
    coreRegions.add(region);
  }
  for (const role of roles) {
    const visited = new Set();
    let current = role;
    while ('derivedFrom' in palette.evidence[current]) {
      if (visited.has(current)) throw new Error(`palette.evidence.${role} 存在循环推导。`);
      visited.add(current);
      current = palette.evidence[current].derivedFrom;
    }
    const item = palette.evidence[role];
    if (!('assetId' in item)) continue;
    if (!palette.referenceAssets.includes(item.assetId)) throw new Error(`palette.evidence.${role} 引用了非配色参考素材。`);
    const key = JSON.stringify([item.assetId, item.region]);
    if (!samples.has(key)) samples.set(key, samplePalette(projectPath, item.assetId, item.region));
    const sample = samples.get(key);
    if (!sample.candidates.some(candidate => candidate.color.toLowerCase() === item.sampledColor.toLowerCase())) throw new Error(`palette.evidence.${role} sampledColor 与原图区域采样候选不匹配。`);
    if (palette.colors[role].toLowerCase() !== item.sampledColor.toLowerCase() && !item.reason) throw new Error(`palette.evidence.${role} 采用色不同于采样色，必须记录调整原因。`);
  }
  return {roles, samples: [...samples.values()]};
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
  const evidence = verifyRoleEvidence(palette, projectPath);
  return {input: palette, resolved: {light: resolveProjectPalette(palette, false), dark: resolveProjectPalette(palette, true)}, sources, ...(evidence ? {evidence} : {})};
}
