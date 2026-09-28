import fs from 'node:fs';
import path from 'node:path';
import {TtsConfigSchema} from '../../src/schemas/tts-config.ts';

export function listTtsProfiles(projectPath) {
  const audioDir = path.join(projectPath, 'audio');
  if (!fs.existsSync(audioDir)) return [];
  const paths = fs.readdirSync(audioDir).filter((name) => /^tts-config(?:\.[a-z0-9-]+)?\.json$/u.test(name)).map((name) => path.join(audioDir, name));
  const profileDir = path.join(audioDir, 'tts-profiles');
  if (fs.existsSync(profileDir)) {
    paths.push(...fs.readdirSync(profileDir).filter((name) => name.endsWith('.json')).map((name) => path.join(profileDir, name)));
  }
  return paths.sort().flatMap((filePath) => {
    try {
      const config = TtsConfigSchema.parse(JSON.parse(fs.readFileSync(filePath, 'utf8')));
      if (!config.enabled) return [];
      return [{id: path.relative(audioDir, filePath).replace(/\.json$/u, ''), path: filePath, provider: config.provider, voiceType: config.voiceType, model: config.model ?? null}];
    } catch {
      return [];
    }
  });
}

export function selectTtsProfile(projectPath, selectedPath) {
  if (selectedPath) {
    const filePath = path.resolve(selectedPath);
    const config = TtsConfigSchema.parse(JSON.parse(fs.readFileSync(filePath, 'utf8')));
    if (!config.enabled) throw new Error(`TTS 配置未启用：${filePath}`);
    return {id: path.basename(filePath, '.json'), path: filePath, provider: config.provider, voiceType: config.voiceType, model: config.model ?? null};
  }
  const profiles = listTtsProfiles(projectPath);
  if (profiles.length > 1) throw new Error(`发现多个可用 TTS 配置，请通过 --tts-config 指定一个：${profiles.map((profile) => profile.id).join('、')}`);
  return profiles[0];
}
