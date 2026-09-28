import fs from 'node:fs';
import {Buffer} from 'node:buffer';
import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';

function envValue(name, fallback) {
  return name ? process.env[name] ?? fallback : fallback;
}

function createWav(durationSec, sampleRate = 24000) {
  const samples = Math.max(1, Math.round(durationSec * sampleRate));
  const data = Buffer.alloc(samples * 2);
  // A test tone keeps mock TTS measurable by the same audio QA as real providers.
  for (let index = 0; index < samples; index += 1) {
    const fade = Math.min(1, index / (sampleRate * 0.01), (samples - index - 1) / (sampleRate * 0.01));
    data.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 440 * index / sampleRate) * 32767 * 0.08 * fade), index * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

function estimateMockDuration(text, speedRatio) {
  const characters = [...text.trim()].length;
  return Math.max(0.45, characters / (4.2 * Math.max(0.1, speedRatio)));
}

function readAudioPayload(value) {
  if (!value) return undefined;
  if (Buffer.isBuffer(value)) return value;
  if (typeof value === 'string') {
    const match = value.match(/^data:audio\/[^;]+;base64,(.+)$/);
    return Buffer.from(match ? match[1] : value, 'base64');
  }
  return undefined;
}

function findAudioInJson(value) {
  if (!value || typeof value !== 'object') return undefined;
  for (const key of ['audio', 'audio_data', 'audioData', 'data', 'result']) {
    const candidate = value[key];
    const payload = readAudioPayload(candidate);
    if (payload) return payload;
    if (candidate && typeof candidate === 'object') {
      const nested = findAudioInJson(candidate);
      if (nested) return nested;
    }
  }
  return undefined;
}

async function requestDoubao(text, config) {
  const endpoint = config.endpoint ?? envValue('DOUBAO_TTS_ENDPOINT');
  if (!endpoint) {
    throw new Error('豆包 TTS 缺少 endpoint：请在 tts-config.json 配置 endpoint，或设置 DOUBAO_TTS_ENDPOINT。');
  }
  const headers = {'content-type': 'application/json'};
  const apiKey = envValue(config.apiKeyEnv, undefined) ?? process.env.DOUBAO_TTS_API_KEY;
  const accessToken = envValue(config.accessTokenEnv, undefined) ?? process.env.DOUBAO_TTS_ACCESS_TOKEN;
  const appId = envValue(config.appIdEnv, undefined) ?? process.env.DOUBAO_TTS_APP_ID;
  const resourceId = envValue(config.resourceIdEnv, undefined) ?? process.env.DOUBAO_TTS_RESOURCE_ID;
  if (config.apiVersion === 'v3') {
    if (!apiKey || !resourceId) {
      throw new Error('豆包 TTS v3 需要 API key 和 resource id；请配置 apiKeyEnv/resourceIdEnv 并设置对应环境变量。');
    }
    headers['X-Api-Key'] = apiKey;
    headers['X-Api-Resource-Id'] = resourceId;
    if (appId) headers['X-Api-App-Id'] = appId;
    if (accessToken) headers['X-Api-Access-Key'] = accessToken;
    headers['X-Api-Connect-Id'] = crypto.randomUUID();
  } else {
    if (apiKey) headers.authorization = `Bearer ${apiKey}`;
    if (accessToken) headers['x-access-token'] = accessToken;
    if (appId) headers['x-app-id'] = appId;
  }
  const body = config.apiVersion === 'v3'
    ? {
      ...config.requestBody,
      user: {uid: config.userId ?? 'frame-loom'},
      req_params: {
        ...(config.requestBody?.req_params ?? {}),
        text,
        speaker: config.voiceType,
        audio_params: {
          ...(config.requestBody?.req_params?.audio_params ?? {}),
          format: config.format,
          sample_rate: config.sampleRate,
          speed_ratio: config.speedRatio,
          volume_ratio: config.volumeRatio,
          pitch_ratio: config.pitchRatio
        }
      }
    }
    : {
      ...config.requestBody,
      text,
      model: config.model,
      voice_type: config.voiceType,
      audio_format: config.format,
      sample_rate: config.sampleRate,
      speed_ratio: config.speedRatio,
      volume_ratio: config.volumeRatio,
      pitch_ratio: config.pitchRatio
    };
  const response = await globalThis.fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: globalThis.AbortSignal.timeout(config.timeoutMs)
  });
  const contentType = response.headers.get('content-type') ?? '';
  const responseBuffer = Buffer.from(await response.arrayBuffer());
  if (!response.ok) {
    throw new Error(`豆包 TTS 请求失败（HTTP ${response.status}）：${responseBuffer.toString('utf8').slice(0, 500)}`);
  }
  if (contentType.includes('audio/')) return {audio: responseBuffer};
  let parsed;
  try { parsed = JSON.parse(responseBuffer.toString('utf8')); } catch {
    throw new Error('豆包 TTS 返回既不是音频，也不是可解析 JSON。');
  }
  const audio = findAudioInJson(parsed);
  if (!audio) throw new Error('豆包 TTS 返回中没有找到音频数据；请检查 endpoint、鉴权和 response 格式。');
  return {audio};
}

export async function synthesizeSpeech({text, config, outputPath}) {
  if (config.provider === 'mock') {
    if (config.format !== 'wav') throw new Error('mock provider 目前只支持 wav。');
    fs.writeFileSync(outputPath, createWav(estimateMockDuration(text, config.speedRatio), config.sampleRate));
    return {durationHintSec: estimateMockDuration(text, config.speedRatio)};
  }
  const result = await requestDoubao(text, config);
  fs.writeFileSync(outputPath, result.audio);
  return {};
}

export function probeAudioDuration(filePath) {
  const result = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath], {encoding: 'utf8'});
  if (result.error?.code === 'ENOENT') throw new Error('找不到 ffprobe。请安装 FFmpeg，并确保 ffprobe 在 PATH 中。');
  if (result.status !== 0) throw new Error(`ffprobe 无法读取音频：${filePath}`);
  const durationSec = Number(result.stdout.trim());
  if (!Number.isFinite(durationSec) || durationSec <= 0) throw new Error(`无法获得有效音频时长：${filePath}`);
  return durationSec;
}

export function combineAudioSegments(segments, outputPath, durationSec) {
  if (segments.length === 0) throw new Error('没有可合并的旁白片段。');
  const args = ['-hide_banner', '-loglevel', 'error', '-y'];
  const filters = [];
  for (const [index, segment] of segments.entries()) {
    args.push('-i', segment.absolutePath);
    const delayMs = Math.max(0, Math.round(segment.startSec * 1000));
    filters.push(`[${index}:a]adelay=${delayMs}|${delayMs},apad,atrim=duration=${durationSec.toFixed(3)}[a${index}]`);
  }
  args.push('-filter_complex', `${filters.join(';')};${segments.map((_, index) => `[a${index}]`).join('')}amix=inputs=${segments.length}:duration=longest:dropout_transition=0,atrim=duration=${durationSec.toFixed(3)}`, '-ac', '1', '-ar', '24000', outputPath);
  const result = spawnSync('ffmpeg', args, {encoding: 'utf8'});
  if (result.error?.code === 'ENOENT') throw new Error('找不到 ffmpeg。请安装 FFmpeg，并确保 ffmpeg 在 PATH 中。');
  if (result.status !== 0) throw new Error(`ffmpeg 合并旁白失败：${result.stderr.trim()}`);
}

export function resolveEnv(name) {
  return name ? process.env[name] : undefined;
}
