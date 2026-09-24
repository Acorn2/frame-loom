import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {AssetManifestSchema} from '../src/schemas/asset-manifest.ts';
import {StoryboardSchema} from '../src/schemas/storyboard.ts';

export function validateAssets(storyboardPath, manifestPath) {
  const resolvedStoryboard = path.resolve(storyboardPath);
  const resolvedManifest = path.resolve(manifestPath ?? path.join(path.dirname(resolvedStoryboard), 'asset-manifest.json'));
  const issues = [];
  let storyboard;
  let manifest;
  try {
    const parsed = StoryboardSchema.safeParse(JSON.parse(fs.readFileSync(resolvedStoryboard, 'utf8')));
    if (!parsed.success) return parsed.error.issues.map((item) => `storyboard.${item.path.join('.')}: ${item.message}`);
    storyboard = parsed.data;
  } catch (error) {
    return [`storyboard: ${error instanceof Error ? error.message : String(error)}`];
  }
  try {
    const parsed = AssetManifestSchema.safeParse(JSON.parse(fs.readFileSync(resolvedManifest, 'utf8')));
    if (!parsed.success) return parsed.error.issues.map((item) => `asset-manifest.${item.path.join('.')}: ${item.message}`);
    manifest = parsed.data;
  } catch (error) {
    return [`asset-manifest: ${error instanceof Error ? error.message : String(error)}`];
  }

  const ids = new Set();
  const assetsByPath = new Map();
  for (const asset of manifest.assets) {
    if (ids.has(asset.id)) issues.push(`重复 asset id：${asset.id}`);
    ids.add(asset.id);
    const normalized = path.normalize(path.isAbsolute(asset.path)
      ? path.resolve(asset.path)
      : path.resolve(path.dirname(resolvedManifest), asset.path));
    if (assetsByPath.has(normalized)) issues.push(`重复 asset path：${asset.path}`);
    assetsByPath.set(normalized, asset);
    if (!path.isAbsolute(asset.path) && !normalized.startsWith(`${path.dirname(resolvedManifest)}${path.sep}`)) {
      issues.push(`manifest asset 相对路径不能逃出项目目录：${asset.path}`);
    }
    const assetPath = normalized;
    if (!fs.existsSync(assetPath) || !fs.statSync(assetPath).isFile() || fs.statSync(assetPath).size === 0) {
      issues.push(`manifest asset 不存在或为空：${asset.path}`);
    }
  }
  for (const scene of storyboard.scenes) {
    for (const layer of scene.layers) {
      if (!['screenshot', 'object'].includes(layer.type) || !layer.asset) continue;
      const layerAssetPath = path.resolve(path.dirname(resolvedStoryboard), layer.asset);
      const asset = assetsByPath.get(path.normalize(layerAssetPath));
      if (!asset) {
        issues.push(`scene ${scene.id}, layer ${layer.id}: ${layer.type} 未登记在 asset-manifest.json：${layer.asset}`);
      } else if (layer.type === 'screenshot' && asset.type !== 'screenshot') {
        issues.push(`scene ${scene.id}, layer ${layer.id}: screenshot 在 asset-manifest.json 中登记为 ${asset.type}：${asset.path}`);
      } else if (layer.type === 'object' && asset.type !== 'image') {
        issues.push(`scene ${scene.id}, layer ${layer.id}: object 在 asset-manifest.json 中必须登记为 image：${asset.path}`);
      }
    }
  }
  return issues;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  const [storyboardPath, manifestPath] = process.argv.slice(2);
  if (!storyboardPath) {
    console.error('Usage: npm run validate:assets -- <storyboard.json> [asset-manifest.json]');
    process.exit(1);
  }
  const issues = validateAssets(storyboardPath, manifestPath);
  if (issues.length > 0) {
    for (const item of issues) console.error(`ERROR ${item}`);
    process.exit(1);
  }
  console.log(`VALID ASSETS ${path.resolve(storyboardPath)}`);
}
