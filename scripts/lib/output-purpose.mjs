import fs from 'node:fs';
import path from 'node:path';

export const OUTPUT_PURPOSES = ['visual-preview', 'visual-master', 'in-project-video'];

export function loadHandoffConfig(projectPath, selectedPath) {
  const configPath = selectedPath ? path.resolve(selectedPath) : path.join(projectPath, 'visual-handoff.json');
  if (!fs.existsSync(configPath)) {
    if (selectedPath) throw new Error(`画面交接配置不存在：${configPath}`);
    return {path: null, facecamRightFraction: 0, subtitleBottomFraction: 0, timelinePolicy: 'picture-locked'};
  }
  const value = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (value?.schemaVersion !== '1.0') throw new Error('visual-handoff.json 的 schemaVersion 必须是 1.0。');
  for (const [key, max] of [['facecamRightFraction', 0.35], ['subtitleBottomFraction', 0.25]]) {
    if (typeof value[key] !== 'number' || value[key] < 0 || value[key] > max) {
      throw new Error(`visual-handoff.json 的 ${key} 必须在 0 到 ${max} 之间。`);
    }
  }
  if (!['picture-locked', 'audio-adjustable'].includes(value.timelinePolicy)) {
    throw new Error('visual-handoff.json 的 timelinePolicy 只能是 picture-locked 或 audio-adjustable。');
  }
  return {path: configPath, ...value};
}

export function resolveOutputPurpose(requested, resolvedAudioMode) {
  if (requested) {
    if (!OUTPUT_PURPOSES.includes(requested)) throw new Error(`--output-purpose 只能是 ${OUTPUT_PURPOSES.join('、')}。`);
    if (requested === 'in-project-video' && resolvedAudioMode === 'silent') {
      throw new Error('明确要求项目内有声视频，但没有可用的 TTS 或外部音频；不会回退为静音预览。');
    }
    if (requested !== 'in-project-video' && resolvedAudioMode !== 'silent') {
      throw new Error(`${requested} 必须使用 --audio-mode silent，不会混入音轨。`);
    }
    return requested;
  }
  return resolvedAudioMode === 'silent' ? 'visual-preview' : 'in-project-video';
}

export function nextMasterOutput(projectPath, force = false) {
  const outputDir = path.join(projectPath, 'output');
  if (force) return path.join(outputDir, 'visual-master-v001.mp4');
  for (let version = 1; version <= 999; version += 1) {
    const candidate = path.join(outputDir, `visual-master-v${String(version).padStart(3, '0')}.mp4`);
    if (!fs.existsSync(candidate)) return candidate;
  }
  throw new Error('画面底片版本已超过 999，请归档项目后重试。');
}
