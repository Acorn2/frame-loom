import fs from 'node:fs';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {resolveTtsVoiceType} from './tts-profiles.mjs';
import {probeAudioDuration, synthesizeSpeech} from './tts-provider.mjs';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

export function voiceCacheKey(text, config) {
  const settings = {...config, voiceType: resolveTtsVoiceType(config)};
  for (const key of ['enabled', 'outputDirectory', 'timeoutMs', 'apiKeyEnv', 'accessTokenEnv', 'appIdEnv', 'voiceTypeEnv', 'resourceIdEnv']) delete settings[key];
  settings.resourceId = config.resourceIdEnv ? process.env[config.resourceIdEnv] : undefined;
  return createHash('sha256').update(JSON.stringify(canonical({version: 1, text, settings}))).digest('hex');
}

const bytesHash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

export async function cachedSpeech({projectPath, text, config, outputPath, refresh = false}) {
  // Keep unused cached takes outside production audio fingerprints.
  const directory = path.join(projectPath, '.cache', 'tts');
  for (const folder of [path.join(projectPath, '.cache'), directory]) {
    if (fs.existsSync(folder) && fs.lstatSync(folder).isSymbolicLink()) throw new Error('语音缓存目录不能是符号链接。');
    fs.mkdirSync(folder, {recursive: true});
  }
  const key = voiceCacheKey(text, config);
  const cachedPath = path.join(directory, `${key}.${config.format}`);
  const metadataPath = `${cachedPath}.json`;
  let durationSec;
  if (!refresh && fs.existsSync(cachedPath) && fs.existsSync(metadataPath)) {
    try {
      if (fs.lstatSync(cachedPath).isSymbolicLink() || fs.lstatSync(metadataPath).isSymbolicLink()) throw new Error('symlink');
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      if (metadata.hash !== bytesHash(cachedPath)) throw new Error('hash');
      durationSec = probeAudioDuration(cachedPath);
      fs.copyFileSync(cachedPath, outputPath);
      return {durationSec, cacheKey: key, reused: true};
    } catch {
      // Corrupt entries are never reused; generate a new immutable take.
    }
  }
  await synthesizeSpeech({text, config, outputPath});
  durationSec = probeAudioDuration(outputPath);
  const temporary = path.join(directory, `${key}-${randomUUID()}.tmp`);
  fs.copyFileSync(outputPath, temporary);
  fs.renameSync(temporary, cachedPath);
  const temporaryMetadata = `${temporary}.json`;
  fs.writeFileSync(temporaryMetadata, JSON.stringify({hash: bytesHash(cachedPath)}), {flag: 'wx'});
  fs.renameSync(temporaryMetadata, metadataPath);
  return {durationSec, cacheKey: key, reused: false};
}
