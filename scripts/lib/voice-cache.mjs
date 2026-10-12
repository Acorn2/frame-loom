import fs from 'node:fs';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {ttsEnvironmentSettings} from './tts-profiles.mjs';
import {probeAudioDuration, synthesizeSpeech} from './tts-provider.mjs';
import {TTS_SYNTHESIS_REVISION} from '../../src/schemas/tts-config.ts';
import {validateSpeechWords} from '../../src/audio/speech-timing.ts';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

export function voiceCacheKey(text, config) {
  const settings = {...config, ...ttsEnvironmentSettings(config)};
  for (const key of ['enabled', 'outputDirectory', 'outputSampleRate', 'timeoutMs', 'apiKeyEnv', 'accessTokenEnv', 'appIdEnv', 'voiceTypeEnv', 'resourceIdEnv']) delete settings[key];
  return createHash('sha256').update(JSON.stringify(canonical({version: TTS_SYNTHESIS_REVISION, ...(config.provider === 'doubao' && config.apiVersion === 'v3' ? {speechEvidenceRevision: 1} : {}), text, settings}))).digest('hex');
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
      if (metadata.speechWords && (!validateSpeechWords(text, metadata.speechWords, durationSec) || metadata.evidenceHash !== evidenceHash(metadata.hash, metadata.speechWords))) throw new Error('speech evidence');
      fs.copyFileSync(cachedPath, outputPath);
      return {durationSec, cacheKey: key, reused: true, ...(metadata.speechWords ? {speechWords: metadata.speechWords} : {})};
    } catch {
      // Corrupt entries are never reused; generate a new immutable take.
    }
  }
  const result = await synthesizeSpeech({text, config, outputPath});
  durationSec = probeAudioDuration(outputPath);
  const speechWords = result.speechWords && validateSpeechWords(text, result.speechWords, durationSec) ? result.speechWords : undefined;
  const temporary = path.join(directory, `${key}-${randomUUID()}.tmp`);
  fs.copyFileSync(outputPath, temporary);
  fs.renameSync(temporary, cachedPath);
  const temporaryMetadata = `${temporary}.json`;
  const hash = bytesHash(cachedPath);
  fs.writeFileSync(temporaryMetadata, JSON.stringify({hash, ...(speechWords ? {speechWords, evidenceHash: evidenceHash(hash, speechWords)} : {})}), {flag: 'wx'});
  fs.renameSync(temporaryMetadata, metadataPath);
  return {durationSec, cacheKey: key, reused: false, ...(speechWords ? {speechWords} : {})};
}

const evidenceHash = (hash, words) => createHash('sha256').update(JSON.stringify(canonical({hash, words}))).digest('hex');
