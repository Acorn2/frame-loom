import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {AssetManifestSchema} from '../src/schemas/asset-manifest.ts';
import {paletteReferenceAsset} from './lib/project-palette.mjs';

// The Agent selects a meaningful button/logo/background region; this command
// samples pixels only and never adopts a palette or changes the source image.
export function samplePalette(projectDirectory, assetId, region) {
  const projectPath = path.resolve(projectDirectory);
  const manifest = AssetManifestSchema.parse(JSON.parse(fs.readFileSync(path.join(projectPath, 'asset-manifest.json'), 'utf8')));
  const {file} = paletteReferenceAsset(manifest, assetId, projectPath);
  const inputBytes = fs.readFileSync(file);
  if (!Array.isArray(region) || region.length !== 4 || region.some(value => !Number.isSafeInteger(value) || value < 0) || region[2] < 1 || region[3] < 1) throw new Error('region 必须为原图像素 x,y,width,height；尺寸必须大于零。');
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', 'pipe:0'], {input: inputBytes, encoding: 'utf8', timeout: 10000});
  if (probe.error || probe.status !== 0) throw new Error('无法读取配色参考图片，请检查文件与 ffprobe。');
  const dimensions = JSON.parse(probe.stdout).streams?.[0];
  const [x, y, width, height] = region;
  if (!dimensions || x + width > dimensions.width || y + height > dimensions.height) throw new Error('取色区域超出原图边界。');
  const decoded = spawnSync('ffmpeg', ['-v', 'error', '-i', 'pipe:0', '-vf', `format=rgba,crop=${width}:${height}:${x}:${y},scale=64:64:flags=neighbor`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'], {input: inputBytes, timeout: 10000, maxBuffer: 65536});
  if (decoded.error || decoded.status !== 0 || decoded.stdout.length !== 64 * 64 * 4) throw new Error('配色采样失败，请检查图片与 FFmpeg。');
  const buckets = new Map(); let count = 0;
  for (let i = 0; i < decoded.stdout.length; i += 4) {
    if (decoded.stdout[i + 3] < 240) continue;
    const pixel = [...decoded.stdout.subarray(i, i + 3)];
    const key = pixel.map(channel => channel >> 4).join(',');
    const bucket = buckets.get(key) ?? {count: 0, sum: [0, 0, 0]};
    bucket.count++; pixel.forEach((channel, index) => {bucket.sum[index] += channel;});
    buckets.set(key, bucket); count++;
  }
  if (!count) throw new Error('取色区域没有足够不透明像素。');
  const candidates = [...buckets.values()].sort((a, b) => b.count - a.count).slice(0, 5).map(bucket => ({
    color: `#${bucket.sum.map(value => Math.round(value / bucket.count).toString(16).padStart(2, '0')).join('')}`,
    coverage: Number((bucket.count / count).toFixed(4))
  }));
  return {assetId, sha256: createHash('sha256').update(inputBytes).digest('hex'), region: {x, y, width, height}, candidates, note: '候选颜色仅代表指定区域；由 Agent 结合主体和用途确定最终 storyboard.palette。'};
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const [project, assetFlag, assetId, regionFlag, region, ...rest] = process.argv.slice(2);
    if (!project || assetFlag !== '--asset' || !assetId || regionFlag !== '--region' || !region || rest.length) throw new Error('Usage: npm run sample:palette -- <project-dir> --asset <id> --region <x,y,width,height>');
    console.log(JSON.stringify(samplePalette(project, assetId, region.split(',').map(Number)), null, 2));
  } catch (error) {console.error(error.message); process.exitCode = 1;}
}
