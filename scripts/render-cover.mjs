import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {StoryboardSchema} from '../src/schemas/storyboard.ts';
import {getSceneTimeline} from '../src/timeline/scene-timeline.ts';
import {assertProductionLock, resolveProductionLock} from './lib/production-lock.mjs';
import {fingerprintFiles} from './lib/input-fingerprint.mjs';
import {resolveBrand} from './lib/branding.mjs';

export function coverFrame(board, plans, brand) {
  const visibleBrand = brand ? Math.ceil((.1 + brand.watermark.drawInSeconds) * board.project.fps) : 0;
  for (const [index, timing] of getSceneTimeline(board).entries()) {
    const penExit = timing.scene.shot?.id === 'whiteboard-board' ? Math.ceil(.3 * board.project.fps) : 0;
    const frame = Math.max(timing.startFrame + plans[index].completeFrame + penExit + 1, visibleBrand);
    if (frame <= timing.startFrame + plans[index].stableEndFrame && frame < timing.endFrame) return frame;
  }
  throw new Error('没有同时完成图解和品牌显现的封面帧，请调整分镜或品牌画入时间。');
}

export function renderCover(storyboardPath, videoPath, outputPath = `${videoPath}.cover.png`, {force = false} = {}) {
  const board = StoryboardSchema.parse(JSON.parse(fs.readFileSync(storyboardPath)));
  const projectPath = path.dirname(path.resolve(storyboardPath));
  const resolved = resolveProductionLock(board, undefined, projectPath);
  if (!resolved) throw new Error('同源封面需要当前 2.4 生产锁。');
  assertProductionLock(board, videoPath, undefined, projectPath);
  const output = path.resolve(outputPath), video = path.resolve(videoPath);
  if (path.extname(output).toLowerCase() !== '.png') throw new Error('封面输出必须是 PNG。');
  if (!force && (fs.existsSync(output) || fs.existsSync(`${output}.render.json`))) throw new Error('封面或记录已存在，请确认后使用 --force。');
  const brand = resolveBrand(board.style.id, {projectPath});
  const frame = coverFrame(board, resolved.plans, brand?.runtime);
  const videoFingerprint = fingerprintFiles([video], path.dirname(video));
  fs.mkdirSync(path.dirname(output), {recursive: true});
  const temporary = path.join(path.dirname(output), `.cover-${randomUUID()}.png`);
  try {
    const result = spawnSync('ffmpeg', ['-v', 'error', '-nostdin', '-i', video, '-vf', `select=eq(n\\,${frame})`, '-frames:v', '1', temporary], {encoding: 'utf8'});
    if (result.error || result.status !== 0 || !fs.existsSync(temporary)) throw new Error(`封面提取失败：${result.error?.message ?? result.stderr}`);
    assertProductionLock(board, video, undefined, projectPath);
    if (fingerprintFiles([video], path.dirname(video)) !== videoFingerprint) throw new Error('视频在封面提取期间变化，请重试。');
    if (!force && (fs.existsSync(output) || fs.existsSync(`${output}.render.json`))) throw new Error('封面在提取期间出现，未覆盖。');
    const record = {schemaVersion: '1.0', frame, videoFingerprint, productionLockHash: resolved.lock.hash, brand: resolved.lock.brand ?? null, verification: 'exact decoded frame from the verified current video; no separate image generation'};
    fs.renameSync(temporary, output);
    record.coverFingerprint = fingerprintFiles([output], path.dirname(output));
    fs.writeFileSync(`${output}.render.json`, `${JSON.stringify(record, null, 2)}\n`);
    console.log(`COVER READY ${output} frame=${frame}`);
    return {output, record};
  } finally {if (fs.existsSync(temporary)) fs.unlinkSync(temporary);}
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), force = args.includes('--force'), positional = args.filter(arg => arg !== '--force');
  if (positional.length < 2 || positional.length > 3) throw new Error('Usage: npm run render:cover -- <storyboard.json> <video.mp4> [cover.png] [--force]');
  renderCover(positional[0], positional[1], positional[2], {force});
}
