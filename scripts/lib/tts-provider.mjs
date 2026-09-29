import fs from 'node:fs';
import {Buffer} from 'node:buffer';
import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import {URL} from 'node:url';
import {resolveTtsVoiceType} from './tts-profiles.mjs';

const PROVIDER_HOSTS = {
  openai: new Set(['api.openai.com']),
  elevenlabs: new Set(['api.elevenlabs.io']),
  aliyun: new Set(['dashscope.aliyuncs.com', 'dashscope-intl.aliyuncs.com']),
  doubao: new Set(['openspeech.bytedance.com'])
};

function assertTrustedUrl(value, allowedHosts, label) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !allowedHosts.has(url.hostname)) {
    throw new Error(`${label} 必须使用服务商官方 HTTPS 域名，不允许自定义主机或端口。`);
  }
  return url;
}

function assertProviderEndpoint(value, provider) {
  return assertTrustedUrl(value, PROVIDER_HOSTS[provider], `${provider} TTS endpoint`);
}

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

function requireApiKey(config, defaultEnv, provider) {
  const envName = config.apiKeyEnv ?? defaultEnv;
  const apiKey = process.env[envName];
  if (!apiKey) throw new Error(`${provider} TTS 缺少 API key：请设置环境变量 ${envName}。`);
  return apiKey;
}

async function readBinaryAudio(response, provider) {
  if (!response.ok) throw new Error(`${provider} TTS 请求失败（HTTP ${response.status}）。`);
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.startsWith('audio/') && !contentType.startsWith('application/octet-stream')) {
    throw new Error(`${provider} TTS 未返回音频（content-type: ${contentType || 'missing'}）。`);
  }
  const audio = Buffer.from(await response.arrayBuffer());
  if (audio.length === 0) throw new Error(`${provider} TTS 返回空音频。`);
  return {audio};
}

async function requestOpenAi(text, config) {
  const endpoint = assertProviderEndpoint(config.endpoint ?? 'https://api.openai.com/v1/audio/speech', 'openai');
  const apiKey = requireApiKey(config, 'OPENAI_API_KEY', 'OpenAI');
  const response = await globalThis.fetch(endpoint.href, {
    method: 'POST',
    redirect: 'error',
    headers: {authorization: `Bearer ${apiKey}`, 'content-type': 'application/json'},
    body: JSON.stringify({
      ...config.requestBody,
      model: config.model ?? 'gpt-4o-mini-tts',
      input: text,
      voice: config.voiceType,
      response_format: config.format,
      speed: config.speedRatio
    }),
    signal: globalThis.AbortSignal.timeout(config.timeoutMs)
  });
  return readBinaryAudio(response, 'OpenAI');
}

async function requestElevenLabs(text, config) {
  if (config.format !== 'mp3') throw new Error('ElevenLabs TTS 当前配置只支持 mp3。');
  const baseEndpoint = assertProviderEndpoint(config.endpoint ?? 'https://api.elevenlabs.io/v1/text-to-speech', 'elevenlabs');
  const apiKey = requireApiKey(config, 'ELEVENLABS_API_KEY', 'ElevenLabs');
  const endpoint = new URL(`${baseEndpoint.href.replace(/\/$/u, '')}/${encodeURIComponent(config.voiceType)}`);
  endpoint.searchParams.set('output_format', 'mp3_44100_128');
  const response = await globalThis.fetch(endpoint, {
    method: 'POST',
    redirect: 'error',
    headers: {'xi-api-key': apiKey, 'content-type': 'application/json'},
    body: JSON.stringify({...config.requestBody, text, model_id: config.model ?? 'eleven_multilingual_v2'}),
    signal: globalThis.AbortSignal.timeout(config.timeoutMs)
  });
  return readBinaryAudio(response, 'ElevenLabs');
}

async function requestAliyun(text, config) {
  if (config.format !== 'wav') throw new Error('阿里百炼 Qwen TTS 当前配置只支持 wav。');
  const endpoint = assertProviderEndpoint(config.endpoint ?? 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', 'aliyun');
  const apiKey = requireApiKey(config, 'DASHSCOPE_API_KEY', '阿里百炼');
  const response = await globalThis.fetch(endpoint.href, {
    method: 'POST',
    redirect: 'error',
    headers: {authorization: `Bearer ${apiKey}`, 'content-type': 'application/json'},
    body: JSON.stringify({
      ...config.requestBody,
      model: config.model ?? 'qwen3-tts-flash',
      input: {...config.requestBody?.input, text, voice: config.voiceType}
    }),
    signal: globalThis.AbortSignal.timeout(config.timeoutMs)
  });
  if (!response.ok) throw new Error(`阿里百炼 TTS 请求失败（HTTP ${response.status}）。`);
  let result;
  try { result = await response.json(); } catch { throw new Error('阿里百炼 TTS 返回不是可解析 JSON。'); }
  const audioUrl = result?.output?.audio?.url;
  if (result?.code || !audioUrl) throw new Error(`阿里百炼 TTS 未返回音频地址${result?.code ? `（${result.code}）` : ''}。`);
  const parsedUrl = new URL(audioUrl);
  if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password || (parsedUrl.port && parsedUrl.port !== '443') || !parsedUrl.hostname.endsWith('.aliyuncs.com')) {
    throw new Error('阿里百炼 TTS 返回的音频地址必须是阿里云 OSS 域名，且不能使用自定义端口。');
  }
  // DashScope may return an HTTP signed OSS URL; use TLS for the same host and signature.
  parsedUrl.protocol = 'https:';
  const audioResponse = await globalThis.fetch(parsedUrl, {redirect: 'error', signal: globalThis.AbortSignal.timeout(config.timeoutMs)});
  return readBinaryAudio(audioResponse, '阿里百炼');
}

async function requestDoubao(text, config) {
  const configuredEndpoint = config.endpoint ?? process.env.VOLC_TTS_ENDPOINT ?? process.env.DOUBAO_TTS_ENDPOINT;
  if (!configuredEndpoint) {
    throw new Error('豆包 TTS 缺少 endpoint：请在 tts-config.json 配置 endpoint，或设置 VOLC_TTS_ENDPOINT。');
  }
  const endpoint = assertProviderEndpoint(configuredEndpoint, 'doubao');
  const headers = {'content-type': 'application/json'};
  const apiKey = config.apiKeyEnv ? process.env[config.apiKeyEnv] : process.env.VOLC_TTS_API_KEY ?? process.env.DOUBAO_TTS_API_KEY;
  const accessToken = envValue(config.accessTokenEnv, undefined) ?? process.env.DOUBAO_TTS_ACCESS_TOKEN;
  const appId = envValue(config.appIdEnv, undefined) ?? process.env.DOUBAO_TTS_APP_ID;
  const resourceId = config.resourceIdEnv ? process.env[config.resourceIdEnv] : process.env.VOLC_TTS_RESOURCE_ID ?? process.env.DOUBAO_TTS_RESOURCE_ID;
  if (config.apiVersion === 'v3') {
    if (!apiKey || !resourceId) {
      throw new Error('豆包 TTS v3 需要 API key 和 resource id；请配置 apiKeyEnv/resourceIdEnv 并设置对应环境变量。');
    }
    headers['X-Api-Key'] = apiKey;
    headers['X-Api-Resource-Id'] = resourceId;
    headers['X-Api-Request-Id'] = crypto.randomUUID();
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
          speech_rate: Math.round((config.speedRatio - 1) * 100),
          loudness_rate: Math.round((config.volumeRatio - 1) * 100)
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
  const response = await globalThis.fetch(endpoint.href, {
    method: 'POST',
    redirect: 'error',
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
  if (config.apiVersion === 'v3') {
    const chunks = [];
    for (const line of responseBuffer.toString('utf8').split(/\r?\n/u)) {
      const value = line.startsWith('data:') ? line.slice(5).trim() : line.trim();
      if (!value || !value.startsWith('{')) continue;
      let event;
      try { event = JSON.parse(value); } catch { throw new Error('豆包 TTS 流式响应包含不可解析的 JSON。'); }
      if (event.code !== undefined && event.code !== 0 && event.code !== 20000000 && !(event.code === 3000 && event.data)) {
        throw new Error(`豆包 TTS 合成失败（code: ${event.code}）：${event.message ?? '未知错误'}`);
      }
      if (event.data) chunks.push(readAudioPayload(event.data));
    }
    const audio = Buffer.concat(chunks.filter(Boolean));
    if (audio.length === 0) throw new Error('豆包 TTS 流式响应中没有音频数据；请检查音色、资源 ID 和服务权限。');
    return {audio};
  }
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
  const providers = {doubao: requestDoubao, openai: requestOpenAi, elevenlabs: requestElevenLabs, aliyun: requestAliyun};
  const request = providers[config.provider];
  if (!request) throw new Error(`不支持的 TTS provider：${config.provider}`);
  const result = await request(text, {...config, voiceType: resolveTtsVoiceType(config)});
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
  args.push('-filter_complex', `${filters.join(';')};${segments.map((_, index) => `[a${index}]`).join('')}amix=inputs=${segments.length}:duration=longest:dropout_transition=0:normalize=0,atrim=duration=${durationSec.toFixed(3)}`, '-ac', '1', '-ar', '24000', outputPath);
  const result = spawnSync('ffmpeg', args, {encoding: 'utf8'});
  if (result.error?.code === 'ENOENT') throw new Error('找不到 ffmpeg。请安装 FFmpeg，并确保 ffmpeg 在 PATH 中。');
  if (result.status !== 0) throw new Error(`ffmpeg 合并旁白失败：${result.stderr.trim()}`);
}

export function resolveEnv(name) {
  return name ? process.env[name] : undefined;
}
