import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Buffer} from 'node:buffer';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {TtsConfigSchema} from '../src/schemas/tts-config.ts';
import {synthesizeSpeech} from '../scripts/lib/tts-provider.mjs';
import aliyunPreset from '../examples/tts-profiles/aliyun.json' with {type: 'json'};
import doubaoPreset from '../examples/tts-profiles/doubao.json' with {type: 'json'};
import elevenlabsPreset from '../examples/tts-profiles/elevenlabs.json' with {type: 'json'};
import openaiPreset from '../examples/tts-profiles/openai.json' with {type: 'json'};

let outputDir;

beforeEach(() => {
  outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-loom-tts-providers-'));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fs.rmSync(outputDir, {recursive: true});
});

function audioResponse(type = 'audio/mpeg') {
  return new globalThis.Response(Uint8Array.from([1, 2, 3]), {headers: {'content-type': type}});
}

describe('built-in TTS provider requests', () => {
  it('sends OpenAI speech fields and stores the returned audio', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-token');
    const fetch = vi.fn(async () => audioResponse());
    vi.stubGlobal('fetch', fetch);
    const config = TtsConfigSchema.parse({...openaiPreset, enabled: true});
    const outputPath = path.join(outputDir, 'openai.mp3');
    await synthesizeSpeech({text: '你好，世界。', config, outputPath});
    expect(fetch.mock.calls[0][0]).toBe('https://api.openai.com/v1/audio/speech');
    expect(fetch.mock.calls[0][1].headers.authorization).toBe('Bearer test-openai-token');
    expect(fetch.mock.calls[0][1].redirect).toBe('error');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({model: 'gpt-4o-mini-tts', input: '你好，世界。', voice: 'alloy', response_format: 'mp3', speed: 1});
    expect(fs.readFileSync(outputPath)).toEqual(Buffer.from([1, 2, 3]));
  });

  it('uses the ElevenLabs voice path and mp3 output format', async () => {
    vi.stubEnv('ELEVENLABS_API_KEY', 'test-elevenlabs-token');
    const fetch = vi.fn(async () => audioResponse());
    vi.stubGlobal('fetch', fetch);
    const config = TtsConfigSchema.parse({...elevenlabsPreset, enabled: true});
    await synthesizeSpeech({text: '你好，世界。', config, outputPath: path.join(outputDir, 'elevenlabs.mp3')});
    expect(String(fetch.mock.calls[0][0])).toBe(`https://api.elevenlabs.io/v1/text-to-speech/${elevenlabsPreset.voiceType}?output_format=mp3_44100_128`);
    expect(fetch.mock.calls[0][1].headers['xi-api-key']).toBe('test-elevenlabs-token');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({text: '你好，世界。', model_id: 'eleven_multilingual_v2'});
  });

  it('downloads the temporary Aliyun audio URL into the project output', async () => {
    vi.stubEnv('DASHSCOPE_API_KEY', 'test-dashscope-token');
    const audioUrl = 'http://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/test.wav?Expires=123&Signature=abc';
    const fetch = vi.fn()
      .mockResolvedValueOnce(globalThis.Response.json({output: {audio: {url: audioUrl}}}))
      .mockResolvedValueOnce(audioResponse('audio/wav'));
    vi.stubGlobal('fetch', fetch);
    const config = TtsConfigSchema.parse({...aliyunPreset, enabled: true});
    const outputPath = path.join(outputDir, 'aliyun.wav');
    await synthesizeSpeech({text: '你好，世界。', config, outputPath});
    expect(fetch.mock.calls[0][0]).toBe('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation');
    expect(fetch.mock.calls[0][1].headers.authorization).toBe('Bearer test-dashscope-token');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({model: 'qwen3-tts-flash', input: {text: '你好，世界。', voice: 'Cherry'}});
    expect(String(fetch.mock.calls[1][0])).toBe(audioUrl.replace('http:', 'https:'));
    expect(fetch.mock.calls[1][1].redirect).toBe('error');
    expect(fs.readFileSync(outputPath)).toEqual(Buffer.from([1, 2, 3]));
  });

  it('uses the three VOLC settings and joins every Doubao v3 audio chunk', async () => {
    vi.stubEnv('VOLC_TTS_API_KEY', 'test-volc-token');
    vi.stubEnv('VOLC_TTS_RESOURCE_ID', 'seed-tts-2.0');
    vi.stubEnv('VOLC_TTS_SPEAKER', 'zh_male_dayi_uranus_bigtts');
    vi.stubEnv('DOUBAO_TTS_APP_ID', 'stale-app-id');
    vi.stubEnv('DOUBAO_TTS_ACCESS_TOKEN', 'stale-access-token');
    const payload = [
      `data: ${JSON.stringify({code: 0, data: Buffer.from([1, 2]).toString('base64')})}`,
      `data: ${JSON.stringify({code: 0, data: Buffer.from([3]).toString('base64')})}`,
      'data: {"code":20000000,"message":"ok"}',
      ''
    ].join('\n');
    const fetch = vi.fn(async () => new globalThis.Response(payload, {headers: {'content-type': 'text/event-stream'}}));
    vi.stubGlobal('fetch', fetch);
    const config = TtsConfigSchema.parse({...doubaoPreset, enabled: true});
    const outputPath = path.join(outputDir, 'doubao.mp3');
    await synthesizeSpeech({text: '你好，世界。', config, outputPath});
    expect(fetch.mock.calls[0][1].headers['X-Api-Key']).toBe('test-volc-token');
    expect(fetch.mock.calls[0][1].headers['X-Api-Resource-Id']).toBe('seed-tts-2.0');
    expect(fetch.mock.calls[0][1].headers).not.toHaveProperty('X-Api-App-Id');
    expect(fetch.mock.calls[0][1].headers).not.toHaveProperty('X-Api-Access-Key');
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body).toMatchObject({req_params: {text: '你好，世界。', speaker: 'zh_male_dayi_uranus_bigtts', audio_params: {format: 'mp3', sample_rate: 24000, speech_rate: 0}}});
    expect(body.req_params).not.toHaveProperty('sample_rate');
    expect(fs.readFileSync(outputPath)).toEqual(Buffer.from([1, 2, 3]));
  });

  it('accepts a Doubao success frame with code 3000 when it contains audio', async () => {
    vi.stubEnv('VOLC_TTS_API_KEY', 'test-volc-token');
    vi.stubEnv('VOLC_TTS_RESOURCE_ID', 'seed-tts-2.0');
    vi.stubEnv('VOLC_TTS_SPEAKER', 'zh_male_dayi_uranus_bigtts');
    vi.stubGlobal('fetch', vi.fn(async () => globalThis.Response.json({code: 3000, message: 'Success', data: Buffer.from([1, 2, 3]).toString('base64')})));
    const config = TtsConfigSchema.parse({...doubaoPreset, enabled: true});
    const outputPath = path.join(outputDir, 'doubao-code-3000.mp3');
    await synthesizeSpeech({text: '测试', config, outputPath});
    expect(fs.readFileSync(outputPath)).toEqual(Buffer.from([1, 2, 3]));
  });

  it('does not use an unrelated Doubao alias when the preset names a missing VOLC key', async () => {
    vi.stubEnv('VOLC_TTS_API_KEY', '');
    vi.stubEnv('VOLC_TTS_RESOURCE_ID', 'seed-tts-2.0');
    vi.stubEnv('VOLC_TTS_SPEAKER', 'zh_male_dayi_uranus_bigtts');
    vi.stubEnv('DOUBAO_TTS_API_KEY', 'unrelated-token');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const config = TtsConfigSchema.parse({...doubaoPreset, enabled: true});
    await expect(synthesizeSpeech({text: '测试', config, outputPath: path.join(outputDir, 'blocked.mp3')})).rejects.toThrow(/API key 和 resource id/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects a Doubao v3 error event without writing audio', async () => {
    vi.stubEnv('DOUBAO_TTS_API_KEY', 'test-doubao-token');
    vi.stubEnv('DOUBAO_TTS_RESOURCE_ID', 'seed-tts-2.0');
    vi.stubGlobal('fetch', vi.fn(async () => new globalThis.Response('data: {"code":3000,"message":"invalid voice"}\n', {headers: {'content-type': 'text/event-stream'}})));
    const config = TtsConfigSchema.parse({schemaVersion: '1.0', enabled: true, provider: 'doubao', apiVersion: 'v3', voiceType: 'missing', format: 'mp3', endpoint: 'https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse'});
    const outputPath = path.join(outputDir, 'invalid-doubao.mp3');
    await expect(synthesizeSpeech({text: '测试', config, outputPath})).rejects.toThrow(/code: 3000/);
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it('rejects a missing key before sending a request', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const config = TtsConfigSchema.parse({schemaVersion: '1.0', enabled: true, provider: 'openai', voiceType: 'alloy'});
    await expect(synthesizeSpeech({text: '测试', config, outputPath: path.join(outputDir, 'missing.mp3')})).rejects.toThrow(/OPENAI_API_KEY/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not write an audio file when a provider returns JSON instead of audio', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-token');
    vi.stubGlobal('fetch', vi.fn(async () => globalThis.Response.json({error: 'unexpected payload'})));
    const config = TtsConfigSchema.parse({schemaVersion: '1.0', enabled: true, provider: 'openai', voiceType: 'alloy', format: 'mp3'});
    const outputPath = path.join(outputDir, 'invalid.mp3');
    await expect(synthesizeSpeech({text: '测试', config, outputPath})).rejects.toThrow(/未返回音频/);
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it.each([
    ['openai', 'mp3'],
    ['elevenlabs', 'mp3'],
    ['aliyun', 'wav'],
    ['doubao', 'mp3']
  ])('rejects a %s endpoint outside the official HTTPS host before any request', async (provider, format) => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const config = TtsConfigSchema.parse({schemaVersion: '1.0', enabled: true, provider, voiceType: 'test', format, endpoint: 'https://example.org/collect'});
    await expect(synthesizeSpeech({text: '测试', config, outputPath: path.join(outputDir, 'blocked.mp3')})).rejects.toThrow(/官方 HTTPS 域名/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects an Alibaba audio URL outside Alibaba Cloud before downloading it', async () => {
    vi.stubEnv('DASHSCOPE_API_KEY', 'test-dashscope-token');
    const fetch = vi.fn().mockResolvedValueOnce(globalThis.Response.json({output: {audio: {url: 'https://example.org/audio.wav'}}}));
    vi.stubGlobal('fetch', fetch);
    const config = TtsConfigSchema.parse({schemaVersion: '1.0', enabled: true, provider: 'aliyun', voiceType: 'Cherry', format: 'wav'});
    await expect(synthesizeSpeech({text: '测试', config, outputPath: path.join(outputDir, 'blocked.wav')})).rejects.toThrow(/阿里云 OSS 域名/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
