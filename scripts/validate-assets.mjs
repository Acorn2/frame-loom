import {compareAssetIssues} from './lib/compare-assets.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {AssetManifestSchema} from '../src/schemas/asset-manifest.ts';
import {ProjectInputSchema} from '../src/schemas/project-input.ts';
import {StoryboardSchema} from '../src/schemas/storyboard.ts';

function isInsideDirectory(directory, candidate) {
  const relative = path.relative(directory, candidate);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

export function validateAssets(storyboardPath, manifestPath) {
  const resolvedStoryboard = path.resolve(storyboardPath);
  const resolvedManifest = path.resolve(manifestPath ?? path.join(path.dirname(resolvedStoryboard), 'asset-manifest.json'));
  const issues = [];
  let storyboard;
  let manifest;
  let projectInput;
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
  const inputPath = path.join(path.dirname(resolvedStoryboard), 'project-input.json');
  if (fs.existsSync(inputPath)) {
    try {
      const parsed = ProjectInputSchema.safeParse(JSON.parse(fs.readFileSync(inputPath, 'utf8')));
      if (!parsed.success) return parsed.error.issues.map((item) => `project-input.${item.path.join('.')}: ${item.message}`);
      projectInput = parsed.data;
    } catch (error) {
      return [`project-input: ${error instanceof Error ? error.message : String(error)}`];
    }
  }

  const mediaLayers = storyboard.scenes.flatMap((scene) => scene.layers.filter((layer) => ['screenshot', 'object'].includes(layer.type)));
  const visibleMediaLayers = storyboard.scenes.flatMap((scene) => {
    if (storyboard.schemaVersion === '2.2' && scene.purpose !== 'media') return [];
    return scene.layers.filter((layer) => ['screenshot', 'object'].includes(layer.type));
  });
  if (projectInput?.inputMode === 'document') {
    if (mediaLayers.length > 0 || manifest.assets.some((asset) => ['image', 'screenshot'].includes(asset.type))) {
      issues.push('project-input.inputMode 为 document：不能使用图片或截图；如需使用，请由用户选择 document-images。');
    }
  } else if (projectInput?.inputMode === 'document-images' && visibleMediaLayers.length === 0) {
    issues.push('project-input.inputMode 为 document-images：分镜至少需要一个可见的图片或截图镜头；Storyboard 2.2 请使用 media purpose。');
  }

  const ids = new Set();
  const assetsByPath = new Map();
  const manifestDirectory = path.dirname(resolvedManifest);
  const realManifestDirectory = fs.realpathSync(manifestDirectory);
  for (const asset of manifest.assets) {
    if (ids.has(asset.id)) issues.push(`重复 asset id：${asset.id}`);
    ids.add(asset.id);
    const isRelative = !path.isAbsolute(asset.path);
    const normalized = path.normalize(!isRelative
      ? path.resolve(asset.path)
      : path.resolve(manifestDirectory, asset.path));
    if (assetsByPath.has(normalized)) issues.push(`重复 asset path：${asset.path}`);
    assetsByPath.set(normalized, asset);
    if (isRelative && !isInsideDirectory(manifestDirectory, normalized)) {
      issues.push(`manifest asset 相对路径不能逃出项目目录：${asset.path}`);
      continue;
    }
    try {
      if (isRelative && !isInsideDirectory(realManifestDirectory, fs.realpathSync(normalized))) {
        issues.push(`manifest asset 相对路径不能逃出项目目录：${asset.path}`);
        continue;
      }
      const stat = fs.statSync(normalized);
      if (!stat.isFile() || stat.size === 0) issues.push(`manifest asset 不存在或为空：${asset.path}`);
    } catch {
      issues.push(`manifest asset 不存在或为空：${asset.path}`);
    }
  }
  for (const scene of storyboard.scenes) {
    issues.push(...compareAssetIssues(scene, path.dirname(resolvedStoryboard)));
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
