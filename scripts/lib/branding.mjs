import fs from 'node:fs';
import {Buffer} from 'node:buffer';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {BrandConfigSchema, hasBrandStyle} from '../../src/branding/config.ts';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function resolveBrand(style, {root = defaultRoot, projectPath} = {}) {
  if (!hasBrandStyle(style)) return undefined;
  const override = projectPath && path.join(projectPath, 'config.json');
  const file = override && fs.existsSync(override) ? override : path.join(root, 'config.json');
  const bytes = fs.readFileSync(file);
  const {brand} = BrandConfigSchema.parse(JSON.parse(bytes));
  const {logo, ...runtime} = brand;
  const evidence = {config: brand, configHash: hash(bytes), scope: file === override ? 'project' : 'repository'};
  if (logo && brand.watermark.enabled) {
    if (/^[a-z]+:\/\//iu.test(logo.path) || logo.path.startsWith('data:')) throw new Error('品牌 Logo 必须是本地 PNG，不能在渲染时访问网址。');
    const logoPath = path.resolve(path.dirname(file), logo.path);
    const png = fs.readFileSync(logoPath);
    if (!png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('品牌 Logo 必须是 PNG。');
    const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'json', '-i', 'pipe:0'], {input: png, encoding: 'utf8'});
    const image = probe.status === 0 && JSON.parse(probe.stdout).streams[0];
    if (!image?.width || !image?.height) throw new Error('品牌 Logo 无法解码。');
    runtime.logoDataUri = `data:image/png;base64,${png.toString('base64')}`;
    runtime.logoAspect = image.width / image.height;
    evidence.logoHash = hash(png);
  }
  return {runtime: brand.watermark.enabled ? runtime : null, evidence};
}
