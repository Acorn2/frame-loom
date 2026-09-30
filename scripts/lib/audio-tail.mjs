import {spawnSync} from 'node:child_process';

export function parseTrailingSilence(log, analyzedDurationSec) {
  const endings = [...log.matchAll(/silence_end:\s*([\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)/g)];
  const last = endings.at(-1);
  if (!last || Number(last[1]) < analyzedDurationSec - 0.15) return 0;
  return Number(last[2]);
}

export function inspectTrailingSilence(videoPath, durationSec) {
  const analyzedDurationSec = Math.min(8, durationSec);
  const seekSec = Math.max(0, durationSec - analyzedDurationSec);
  const result = spawnSync('ffmpeg', [
    '-hide_banner', '-nostats', '-ss', String(seekSec), '-i', videoPath,
    '-vn', '-af', 'silencedetect=noise=-40dB:d=0.5', '-f', 'null', '-'
  ], {encoding: 'utf8'});
  if (result.error?.code === 'ENOENT') throw new Error('找不到 ffmpeg，无法检查片尾静音。');
  if (result.status !== 0) throw new Error(`片尾静音检测失败：${result.stderr.trim()}`);
  return {
    durationSec: parseTrailingSilence(result.stderr, analyzedDurationSec),
    noiseThresholdDb: -40,
    reviewedTailSec: analyzedDurationSec
  };
}
