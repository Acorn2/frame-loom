import fs from 'node:fs';
import path from 'node:path';
import {parseCaptions} from '../../src/audio/captions.ts';
import {AudioConfigSchema} from '../../src/schemas/audio-config.ts';
import {AudioManifestSchema} from '../../src/schemas/audio-manifest.ts';

function mediaMime(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return ({'.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.ogg': 'audio/ogg'})[extension] ?? 'application/octet-stream';
}

function fileDataUri(filePath, mimeResolver) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile() || fs.statSync(filePath).size === 0) {
    throw new Error(`音频或字幕文件不存在或为空：${filePath}`);
  }
  return `data:${mimeResolver(filePath)};base64,${fs.readFileSync(filePath).toString('base64')}`;
}

export function loadAudioRuntime(configPath, audioTiming) {
  if (!configPath) return undefined;
  const resolvedConfig = path.resolve(process.cwd(), configPath);
  const config = AudioConfigSchema.parse(JSON.parse(fs.readFileSync(resolvedConfig, 'utf8')));
  const directory = path.dirname(resolvedConfig);
  const runtime = {sfx: []};
  if (config.voiceover?.enabled) {
    runtime.voiceoverDataUri = fileDataUri(path.resolve(directory, config.voiceover.path), mediaMime);
    runtime.voiceoverVolume = config.voiceover.volume;
  }
  if (config.music?.enabled) {
    runtime.musicDataUri = fileDataUri(path.resolve(directory, config.music.path), mediaMime);
    runtime.musicVolume = config.music.volume;
    runtime.musicDucking = config.music.ducking;
    runtime.musicFadeInSec = config.music.fadeInSec;
    runtime.musicFadeOutSec = config.music.fadeOutSec;
  }
  runtime.voiceoverDurationSec = audioTiming?.tracks.find((track) => track.kind === 'voiceover')?.durationSec;
  const manifestPath = path.join(directory, 'audio-manifest.json');
  if (config.voiceover?.enabled && fs.existsSync(manifestPath)) {
    const parsedManifest = AudioManifestSchema.safeParse(JSON.parse(fs.readFileSync(manifestPath, 'utf8')));
    if (parsedManifest.success) {
      const manifest = parsedManifest.data;
      const projectRoot = path.dirname(directory);
      if (path.resolve(projectRoot, manifest.audioConfigPath) === resolvedConfig
        && path.resolve(projectRoot, manifest.fullAudioPath) === path.resolve(directory, config.voiceover.path)) {
        const lastSpeechEnd = Math.max(0, ...manifest.segments.map((segment) => segment.endSec));
        if (lastSpeechEnd > 0) runtime.voiceoverDurationSec = lastSpeechEnd;
      }
    }
  }
  if (config.captions?.enabled) {
    const captionPath = path.resolve(directory, config.captions.path);
    if (!fs.existsSync(captionPath)) throw new Error(`字幕文件不存在：${captionPath}`);
    runtime.captions = parseCaptions(fs.readFileSync(captionPath, 'utf8'));
  }
  for (const item of config.sfx ?? []) {
    if (!item.enabled) continue;
    runtime.sfx.push({
      dataUri: fileDataUri(path.resolve(directory, item.path), mediaMime),
      volume: item.volume,
      startSec: item.startSec ?? 0
    });
  }
  return runtime;
}
