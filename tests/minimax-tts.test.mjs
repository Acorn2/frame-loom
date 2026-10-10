import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Buffer} from 'node:buffer';
import {spawnSync} from 'node:child_process';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {TtsConfigSchema} from '../src/schemas/tts-config.ts';
import {synthesizeSpeech} from '../scripts/lib/tts-provider.mjs';
import {inspectTtsProfiles, selectTtsProfile} from '../scripts/lib/tts-profiles.mjs';
import {voiceCacheKey} from '../scripts/lib/voice-cache.mjs';
import {previewTts} from '../scripts/preview-tts.mjs';
import preset from '../examples/tts-profiles/minimax.json' with {type: 'json'};

let project;
const config = (fields = {}) => TtsConfigSchema.parse({...preset, enabled: true, ...fields});
const response = (fields = {}) => globalThis.Response.json({base_resp: {status_code: 0}, data: {status: 2, audio: '01abFF'}, ...fields});
beforeEach(() => {
  project = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-loom-minimax-'));
  fs.mkdirSync(path.join(project, 'audio'));
  vi.stubEnv('MINIMAX_API_KEY', 'test-minimax-token');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  fs.rmSync(project, {recursive: true, force: true});
});

describe('MiniMax TTS', () => {
  it('maps voice controls and decodes hex audio, rather than treating it as base64', async () => {
    const fetch = vi.fn(async () => response());
    vi.stubGlobal('fetch', fetch);
    const settings = config({speedRatio: 0.9, volumeRatio: 1.2, pitchSemitones: -2, emotion: 'calm',
      language: 'Chinese', bitrate: 256000, pronunciationHints: ['处理/(chu3)(li3)', 'FrameLoom/Frame Loom'], textNormalization: 'quality'});
    const outputPath = path.join(project, 'speech.mp3');
    await synthesizeSpeech({text: '处理 FrameLoom 配音。', config: settings, outputPath});
    expect(fetch.mock.calls[0][0]).toBe('https://api.minimax.cn/v1/t2a_v2');
    const options = fetch.mock.calls[0][1];
    expect(options).toMatchObject({method: 'POST', redirect: 'error', headers: {authorization: 'Bearer test-minimax-token', 'content-type': 'application/json'}});
    expect(JSON.parse(options.body)).toEqual({model: 'speech-2.8-hd', text: '处理 FrameLoom 配音。', stream: false,
      output_format: 'hex', language_boost: 'Chinese',
      voice_setting: {voice_id: 'male-qn-qingse', speed: 0.9, vol: 1.2, pitch: -2, emotion: 'calm'},
      audio_setting: {sample_rate: 32000, format: 'mp3', channel: 1, bitrate: 256000},
      pronunciation_dict: {tone: settings.pronunciationHints}, text_normalization_mode: 'quality'});
    expect(fs.readFileSync(outputPath)).toEqual(Buffer.from([1, 171, 255]));
  });

  it('uses the international endpoint and an environment voice without sending MP3-only bitrate for WAV', async () => {
    vi.stubEnv('FRAMELOOM_MINIMAX_KEY', 'custom-test-token');
    vi.stubEnv('FRAMELOOM_MINIMAX_VOICE', 'custom-voice');
    const fetch = vi.fn(async () => response());
    vi.stubGlobal('fetch', fetch);
    await synthesizeSpeech({text: 'Hello', config: config({endpoint: 'https://api.minimax.io/v1/t2a_v2',
      apiKeyEnv: 'FRAMELOOM_MINIMAX_KEY', voiceTypeEnv: 'FRAMELOOM_MINIMAX_VOICE', format: 'wav'}), outputPath: path.join(project, 'speech.wav')});
    expect(fetch.mock.calls[0][0]).toBe('https://api.minimax.io/v1/t2a_v2');
    expect(fetch.mock.calls[0][1].headers.authorization).toBe('Bearer custom-test-token');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({voice_setting: {voice_id: 'custom-voice', pitch: 0},
      language_boost: 'auto', audio_setting: {sample_rate: 32000, format: 'wav', channel: 1}});
    expect(JSON.parse(fetch.mock.calls[0][1].body).audio_setting).not.toHaveProperty('bitrate');
  });

  it.each([
    {speedRatio: 0.49}, {speedRatio: 2.01}, {volumeRatio: 0}, {volumeRatio: 10.1},
    {pitchRatio: 1.1}, {pitchSemitones: -13}, {pitchSemitones: 0.5}, {pitchSemitones: 13},
    {sampleRate: 48000}, {format: 'flac'}, {format: 'wav', bitrate: 128000}, {bitrate: 96000},
    {model: 'unknown'}, {apiVersion: 'v3'}, {instructions: '沉稳'}, {language: 'zh'},
    {emotion: 'whisper'}, {emotion: 'fluent'}, {emotion: 'excited'}, {pronunciationHints: ['invalid']},
    {pronunciationHints: ['原文/']}, {pronunciationHints: []}, {textNormalization: 'on'},
    {model: 'speech-02-hd', language: 'Persian'}, {model: 'speech-01-hd', textNormalization: 'quality'},
    {requestBody: {stream: true}}, {requestBody: {output_format: 'url'}},
    {requestBody: {voice_setting: {voice_id: 'override'}}}, {requestBody: {unknown: true}},
    {endpoint: 'https://example.com/v1/t2a_v2'}, {endpoint: 'http://api.minimax.cn/v1/t2a_v2'},
    {endpoint: 'https://token@api.minimax.cn/v1/t2a_v2'}, {endpoint: 'https://api.minimax.cn:8443/v1/t2a_v2'}
  ])('rejects unsupported settings before a network request: %j', async fields => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(synthesizeSpeech({text: '测试', config: {...preset, enabled: true, ...fields}, outputPath: path.join(project, 'unused')})).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('accepts documented limits and restricts MiniMax-specific controls to MiniMax', () => {
    expect(config({speedRatio: 0.5, volumeRatio: 0.01, pitchSemitones: -12, sampleRate: 8000}).speedRatio).toBe(0.5);
    expect(config({speedRatio: 2, volumeRatio: 10, pitchSemitones: 12, sampleRate: 44100}).pitchSemitones).toBe(12);
    expect(config({model: 'speech-2.6-turbo', emotion: 'whisper'}).emotion).toBe('whisper');
    for (const provider of ['openai', 'elevenlabs', 'aliyun', 'doubao', 'mock']) {
      for (const field of [{emotion: 'calm'}, {pitchSemitones: 0}, {pronunciationHints: ['词/发音']}, {bitrate: 128000}]) {
        expect(TtsConfigSchema.safeParse({schemaVersion: '1.0', enabled: true, provider, voiceType: 'demo', ...field}).success).toBe(false);
      }
    }
  });

  it.each([
    [() => response({base_resp: {status_code: 1004, status_msg: 'private-token private-narration'}}), 'code: 1004'],
    [() => response({base_resp: null}), '业务状态码'],
    [() => response({data: null}), '完整'],
    [() => response({data: {status: 1, audio: 'aabb'}}), '完整'],
    ...['', 'aab', 'aabbGG', 'https://example.com/audio.mp3', 'AQID', null].map(audio => [() => response({data: {status: 2, audio}}), '十六进制']),
    [() => new globalThis.Response('private-token private-narration', {status: 401}), 'HTTP 401'],
    [() => new globalThis.Response('invalid JSON private-token'), 'JSON']
  ])('fails on malformed or unsuccessful responses without publishing an audio file', async (makeResponse, message) => {
    vi.stubGlobal('fetch', vi.fn(async () => makeResponse()));
    const outputPath = path.join(project, 'failure.mp3');
    const failure = await synthesizeSpeech({text: 'private-narration', config: config(), outputPath}).catch(error => error);
    expect(failure).toBeInstanceOf(Error);
    expect(failure.message).toContain(message);
    expect(failure.message).not.toMatch(/private-token|private-narration/u);
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it('reports disabled and missing-environment profiles locally without fetching', async () => {
    const filePath = path.join(project, 'audio', 'tts-config.minimax.json');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    fs.writeFileSync(filePath, JSON.stringify(preset));
    expect(inspectTtsProfiles(project)[0]).toMatchObject({provider: 'minimax', status: 'disabled', model: 'speech-2.8-hd'});
    vi.stubEnv('MINIMAX_API_KEY', '');
    fs.writeFileSync(filePath, JSON.stringify({...preset, enabled: true}));
    expect(inspectTtsProfiles(project)[0]).toMatchObject({status: 'needs-environment', issues: ['缺少环境变量 MINIMAX_API_KEY。']});
    expect(() => selectTtsProfile(project)).toThrow('没有可用');
    await expect(synthesizeSpeech({text: '测试', config: config(), outputPath: path.join(project, 'unused')})).rejects.toThrow('MINIMAX_API_KEY');
    vi.stubEnv('MINIMAX_API_KEY', 'test-token');
    expect(selectTtsProfile(project)).toMatchObject({provider: 'minimax', status: 'ready'});
    expect(fetch).not.toHaveBeenCalled();
  });

  it('enforces the Unicode character limit before fetching', async () => {
    const fetch = vi.fn(async () => response());
    vi.stubGlobal('fetch', fetch);
    for (const text of ['中'.repeat(10000), '😀'.repeat(10000)]) {
      await expect(synthesizeSpeech({text, config: config(), outputPath: path.join(project, 'unused')})).rejects.toThrow('10000');
    }
    expect(fetch).not.toHaveBeenCalled();
    await synthesizeSpeech({text: '😀'.repeat(9999), config: config(), outputPath: path.join(project, 'valid.mp3')});
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('invalidates cached speech when any MiniMax voice control changes', () => {
    const original = config();
    const key = voiceCacheKey('测试', original);
    for (const fields of [{pitchSemitones: 2}, {emotion: 'calm'}, {pronunciationHints: ['测/(ce4)']},
      {textNormalization: 'quality'}, {bitrate: 256000}, {language: 'Chinese'}, {volumeRatio: 1.1}]) {
      expect(voiceCacheKey('测试', config(fields))).not.toBe(key);
    }
    expect(voiceCacheKey('测试', {...original, outputSampleRate: 48000})).toBe(key);
  });

  it.each(['wav', 'mp3'])('produces measured %s preview and CLI audio packages from mocked HTTP hex audio', async format => {
    const tonePath = path.join(project, 'tone.wav');
    await synthesizeSpeech({text: '测试。', config: {provider: 'mock', format: 'wav', sampleRate: 32000, speedRatio: 1}, outputPath: tonePath});
    const fixturePath = format === 'wav' ? tonePath : path.join(project, 'tone.mp3');
    if (format === 'mp3') {
      const conversion = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', tonePath, fixturePath], {encoding: 'utf8'});
      expect(conversion.status, conversion.stderr).toBe(0);
    }
    const hex = fs.readFileSync(fixturePath).toString('hex');
    const filePath = path.join(project, 'audio', 'tts-config.json');
    fs.writeFileSync(filePath, JSON.stringify(config({format, outputSampleRate: 48000})));
    vi.stubGlobal('fetch', vi.fn(async () => response({data: {status: 2, audio: hex}})));
    const preview = await previewTts({projectPath: project, text: '试听'});
    expect(preview).toMatchObject({provider: 'minimax', model: 'speech-2.8-hd'});
    expect(preview.durationSec).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(project, 'audio', 'audio-manifest.json'))).toBe(false);

    const storyboard = JSON.parse(fs.readFileSync('examples/creator-production-pilot/storyboard.json', 'utf8'));
    storyboard.scenes = [storyboard.scenes[0]];
    storyboard.scenes[0].narration = '测试。';
    storyboard.scenes[0].durationFrames = Math.ceil(preview.durationSec * storyboard.project.fps) + 6;
    storyboard.project.durationFrames = storyboard.scenes[0].durationFrames;
    storyboard.project.durationSec = storyboard.project.durationFrames / storyboard.project.fps;
    fs.writeFileSync(path.join(project, 'storyboard.json'), JSON.stringify(storyboard));
    const preload = path.join(project, 'mock-http.mjs');
    fs.writeFileSync(preload, `import fs from 'node:fs'; globalThis.fetch = async () => Response.json({base_resp:{status_code:0},data:{status:2,audio:fs.readFileSync(${JSON.stringify(fixturePath)}).toString('hex')}});`);
    const run = (...args) => spawnSync(process.execPath, ['--import', 'tsx/esm', '--import', preload, 'scripts/synthesize-voiceover.mjs', project, ...args], {encoding: 'utf8'});
    const production = run();
    expect(production.status, production.stderr).toBe(0);
    const manifest = JSON.parse(fs.readFileSync(path.join(project, 'audio', 'audio-manifest.json'), 'utf8'));
    expect(manifest).toMatchObject({provider: 'minimax', textSource: 'scene.narration'});
    expect(manifest.segments[0].durationSec).toBeGreaterThan(0);
    expect(fs.readFileSync(path.resolve(project, manifest.captionsPath), 'utf8')).toContain('测试');
    const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=sample_rate', '-of', 'default=noprint_wrappers=1:nokey=1', path.resolve(project, manifest.fullAudioPath)], {encoding: 'utf8'});
    expect(probe.status).toBe(0);
    expect(probe.stdout.trim()).toBe('48000');
    const reused = run('--reuse');
    expect(reused.status, reused.stderr).toBe(0);
    expect(reused.stdout).toContain('VOICEOVER REUSED');
    fs.writeFileSync(filePath, JSON.stringify(config({format, outputSampleRate: 48000, pitchSemitones: 1})));
    const stale = run('--reuse');
    expect(stale.status).toBe(1);
    expect(stale.stderr).toContain('配置不一致');
  }, 20000);
});
