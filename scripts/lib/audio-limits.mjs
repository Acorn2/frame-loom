import fs from 'node:fs';
import path from 'node:path';

export const AUDIO_LIMITS = Object.freeze({fileBytes: 256 * 1024 * 1024, totalBytes: 512 * 1024 * 1024,
  captionBytes: 4 * 1024 * 1024, tracks: 64, durationSec: 3600, probeMs: 10000, loudnessMs: 120000});

export function assertAudioFile(file, limit = AUDIO_LIMITS.fileBytes) {
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size === 0 || stat.size > limit) throw new Error(`音频或字幕必须是非空普通文件且不超过 ${limit} 字节：${file}`);
  return stat.size;
}

export function assertAudioBudget(config, directory) {
  const tracks = [config.voiceover, config.music, ...(config.sfx ?? [])].filter(item => item?.enabled);
  if (tracks.length > AUDIO_LIMITS.tracks) throw new Error(`启用音轨不能超过 ${AUDIO_LIMITS.tracks} 条。`);
  // Count each use: the runtime currently embeds each occurrence separately.
  const bytes = tracks.reduce((total, item) => total + assertAudioFile(path.resolve(directory, item.path)), 0);
  if (bytes > AUDIO_LIMITS.totalBytes) throw new Error('音频载入总量超过 512 MiB，请压缩或拆分项目。');
  if (config.captions?.enabled) assertAudioFile(path.resolve(directory, config.captions.path), AUDIO_LIMITS.captionBytes);
}

export function assertAudioDuration(durationSec) {
  if (!Number.isFinite(durationSec) || durationSec <= 0 || durationSec > AUDIO_LIMITS.durationSec) throw new Error('音频时长必须大于 0 且不超过 3600 秒，请裁剪或拆分。');
}
