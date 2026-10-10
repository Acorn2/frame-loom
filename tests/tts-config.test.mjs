import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {TtsConfigSchema, ttsConfigJsonSchema} from '../src/schemas/tts-config.ts';
import {inspectTtsProfiles, selectTtsProfile} from '../scripts/lib/tts-profiles.mjs';
import {synthesizeSpeech} from '../scripts/lib/tts-provider.mjs';
import {withSceneContext} from '../scripts/synthesize-voiceover.mjs';
import {voiceCacheKey} from '../scripts/lib/voice-cache.mjs';
import {parsePreviewArgs, previewTts} from '../scripts/preview-tts.mjs';
import {fingerprintTtsConfig, fingerprintFiles} from '../scripts/lib/input-fingerprint.mjs';

const base = {schemaVersion: '1.0', enabled: true, voiceType: 'demo'};
let project;
beforeEach(() => {
  project = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-loom-tts-config-'));
  fs.mkdirSync(path.join(project, 'audio'));
  vi.stubEnv('FRAMELOOM_TEST_KEY', '');
  vi.stubEnv('FRAMELOOM_TEST_VOICE', '');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  fs.rmSync(project, {recursive: true, force: true});
});
const writeProfile = (name, config) => fs.writeFileSync(path.join(project, 'audio', name), JSON.stringify(config));

describe('provider-aware TTS configuration', () => {
  it.each([
    ['openai', {speedRatio: 10}], ['openai', {volumeRatio: 0.8}], ['openai', {sampleRate: 48000}],
    ['elevenlabs', {format: 'wav'}], ['elevenlabs', {speedRatio: 1.3}], ['elevenlabs', {pitchRatio: 1.1}],
    ['aliyun', {format: 'mp3'}], ['aliyun', {speedRatio: 1.2}], ['aliyun', {language: 'zh'}],
    ['doubao', {sampleRate: 12345}], ['doubao', {speedRatio: 2.1}], ['doubao', {apiVersion: 'v3', pitchRatio: 1.1}],
    ['openai', {model: 'tts-1', instructions: '沉稳'}], ['aliyun', {instructions: '沉稳'}],
    ['elevenlabs', {language: 'zh'}], ['openai', {endpoint: 'bad-url'}],
    ['openai', {requestBody: {speed: 2}}], ['openai', {requestBody: {stream_format: 'sse'}}],
    ['elevenlabs', {voiceSettings: {stability: 2}}],
    ['elevenlabs', {requestBody: {voice_settings: {speed: 1.1}}}],
    ['elevenlabs', {useSceneContext: true, requestBody: {previous_text: 'manual'}}]
  ])('rejects unsupported or conflicting %s settings: %j', (provider, fields) => {
    expect(TtsConfigSchema.safeParse({...base, provider, ...fields}).success).toBe(false);
  });

  it('preserves neutral old placeholders and chooses the ElevenLabs format correctly', () => {
    const config = TtsConfigSchema.parse({...base, provider: 'elevenlabs', volumeRatio: 1, pitchRatio: 1, sampleRate: 24000});
    expect(config.format).toBe('mp3');
    expect(TtsConfigSchema.safeParse({...base, provider: 'doubao', apiVersion: 'v3', pitchRatio: 1}).success).toBe(true);
    expect(TtsConfigSchema.safeParse({schemaVersion: '1.0', enabled: true, provider: 'openai'}).success).toBe(false);
    expect(ttsConfigJsonSchema().allOf[0].anyOf).toEqual([{required: ['voiceType']}, {required: ['voiceTypeEnv']}]);
    expect(JSON.parse(fs.readFileSync('schemas/tts-config.schema.json', 'utf8'))).toMatchObject(ttsConfigJsonSchema());
  });

  it('maps ElevenLabs speed, voice controls, normalization and pronunciation dictionaries', async () => {
    vi.stubEnv('FRAMELOOM_TEST_KEY', 'dummy');
    const fetch = vi.fn(async () => new globalThis.Response(new Uint8Array([1, 2]), {headers: {'content-type': 'audio/mpeg'}}));
    vi.stubGlobal('fetch', fetch);
    const config = TtsConfigSchema.parse({...base, provider: 'elevenlabs', apiKeyEnv: 'FRAMELOOM_TEST_KEY', speedRatio: 1.1,
      voiceSettings: {stability: 0.6, similarity_boost: 0.7, style: 0.2, use_speaker_boost: false},
      pronunciationDictionaries: [{pronunciation_dictionary_id: 'dictionary', version_id: 'version'}], textNormalization: 'on'});
    await synthesizeSpeech({text: '品牌名', config, outputPath: path.join(project, 'audio', 'test.mp3')});
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({voice_settings: {...config.voiceSettings, speed: 1.1},
      pronunciation_dictionary_locators: config.pronunciationDictionaries, apply_text_normalization: 'on'});
  });

  it.each(['openai', 'aliyun'])('maps validated %s reading instructions into the correct API field', async (provider) => {
    vi.stubEnv('FRAMELOOM_TEST_KEY', 'dummy');
    const bodies = [];
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => { bodies.push(JSON.parse(options.body)); throw new Error('capture'); }));
    const config = TtsConfigSchema.parse({...base, provider, apiKeyEnv: 'FRAMELOOM_TEST_KEY', instructions: '语气沉稳，吐字清楚。',
      ...(provider === 'aliyun' ? {model: 'qwen3-tts-instruct-flash', language: 'Chinese'} : {})});
    await expect(synthesizeSpeech({text: '测试', config, outputPath: path.join(project, 'unused')})).rejects.toThrow('capture');
    expect(provider === 'aliyun' ? bodies[0].input : bodies[0]).toMatchObject({instructions: config.instructions});
    if (provider === 'aliyun') expect(bodies[0].input.language_type).toBe('Chinese');
  });

  it('keys contextual speech by neighboring text while output resampling reuses the source take', async () => {
    const config = TtsConfigSchema.parse({...base, provider: 'elevenlabs', useSceneContext: true});
    const contextual = withSceneContext(config, ['之前', '现在', '之后'], 1);
    expect(TtsConfigSchema.safeParse(contextual).success).toBe(true);
    expect(contextual.requestBody).toEqual({previous_text: '之前', next_text: '之后'});
    expect(withSceneContext(config, ['现在', '之后'], 0).requestBody).toEqual({next_text: '之后'});
    expect(voiceCacheKey('现在', contextual)).not.toBe(voiceCacheKey('现在', withSceneContext(config, ['改过', '现在', '之后'], 1)));
    expect(voiceCacheKey('现在', {...contextual, outputSampleRate: 48000})).toBe(voiceCacheKey('现在', contextual));
    vi.stubEnv('FRAMELOOM_TEST_KEY', 'dummy');
    const fetch = vi.fn(async () => { throw new Error('capture'); });
    vi.stubGlobal('fetch', fetch);
    await expect(synthesizeSpeech({text: '现在', config: {...contextual, apiKeyEnv: 'FRAMELOOM_TEST_KEY'}, outputPath: 'unused'})).rejects.toThrow('capture');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({previous_text: '之前', next_text: '之后'});
  });

  it('reports every profile without exposing credentials or hiding a good profile behind a bad one', () => {
    writeProfile('tts-config.json', {...base, provider: 'openai', apiKeyEnv: 'FRAMELOOM_TEST_KEY'});
    writeProfile('tts-config.missing.json', {schemaVersion: '1.0', enabled: true, provider: 'openai', voiceTypeEnv: 'FRAMELOOM_TEST_VOICE', apiKeyEnv: 'FRAMELOOM_TEST_KEY'});
    writeProfile('tts-config.disabled.json', {...base, provider: 'openai', enabled: false});
    writeProfile('tts-config.mock.json', {...base, provider: 'mock'});
    fs.writeFileSync(path.join(project, 'audio', 'tts-config.bad.json'), '{"secret":"do-not-print"');
    expect(inspectTtsProfiles(project).find((item) => item.id === 'tts-config.missing').status).toBe('needs-environment');
    expect(inspectTtsProfiles(project).find((item) => item.id === 'tts-config.mock').status).toBe('test-only');
    expect(() => selectTtsProfile(project, path.join(project, 'audio', 'tts-config.json'))).toThrow('FRAMELOOM_TEST_KEY');
    vi.stubEnv('FRAMELOOM_TEST_KEY', 'do-not-print');
    const profiles = inspectTtsProfiles(project);
    expect(profiles.find((item) => item.id === 'tts-config').status).toBe('ready');
    expect(profiles.find((item) => item.id === 'tts-config.bad').status).toBe('invalid');
    expect(profiles.find((item) => item.id === 'tts-config.disabled').status).toBe('disabled');
    expect(selectTtsProfile(project, path.join(project, 'audio', 'tts-config.json')).provider).toBe('openai');
    const cli = spawnSync(process.execPath, ['--import', 'tsx/esm', 'scripts/list-tts-profiles.mjs', project], {encoding: 'utf8'});
    expect(cli.status).toBe(0);
    expect(JSON.parse(cli.stdout)).toHaveLength(5);
    expect(cli.stdout).not.toContain('do-not-print');
  });

  it('selects the only ready profile even if another enabled profile lacks a key', () => {
    vi.stubEnv('FRAMELOOM_TEST_KEY', 'dummy');
    writeProfile('tts-config.json', {...base, provider: 'openai', apiKeyEnv: 'FRAMELOOM_TEST_KEY'});
    writeProfile('tts-config.missing.json', {...base, provider: 'openai', apiKeyEnv: 'FRAMELOOM_TEST_MISSING_KEY'});
    vi.stubEnv('FRAMELOOM_TEST_MISSING_KEY', '');
    expect(selectTtsProfile(project).id).toBe('tts-config');
    writeProfile('tts-config.mock.json', {...base, provider: 'mock'});
    expect(selectTtsProfile(project).id).toBe('tts-config');
    vi.stubEnv('FRAMELOOM_TEST_KEY', '');
    expect(() => selectTtsProfile(project)).toThrow('没有可用');
  });

  it('binds fallback resource and endpoint environment choices to reuse fingerprints', () => {
    const config = TtsConfigSchema.parse({...base, provider: 'doubao', apiVersion: 'v3'});
    vi.stubEnv('VOLC_TTS_RESOURCE_ID', 'resource-a');
    vi.stubEnv('VOLC_TTS_ENDPOINT', 'https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse');
    writeProfile('tts-config.json', config);
    const file = path.join(project, 'audio', 'tts-config.json');
    const fingerprint = fingerprintTtsConfig(file, project);
    const key = voiceCacheKey('测试', config);
    vi.stubEnv('VOLC_TTS_RESOURCE_ID', 'resource-b');
    expect(fingerprintTtsConfig(file, project)).not.toBe(fingerprint);
    expect(voiceCacheKey('测试', config)).not.toBe(key);
    const changed = fingerprintTtsConfig(file, project);
    vi.stubEnv('VOLC_TTS_ENDPOINT', 'https://openspeech.bytedance.com/api/v3/tts/unidirectional');
    expect(fingerprintTtsConfig(file, project)).not.toBe(changed);
  });

  it('does not reuse unchanged JSON or source cache keys from the previous adapter behavior', () => {
    const config = TtsConfigSchema.parse({...base, provider: 'elevenlabs', speedRatio: 1.1});
    writeProfile('tts-config.json', config);
    const file = path.join(project, 'audio', 'tts-config.json');
    expect(fingerprintTtsConfig(file, project)).not.toBe(fingerprintFiles([file], project));
    const settings = {...config};
    for (const key of ['enabled', 'outputDirectory', 'outputSampleRate', 'timeoutMs', 'apiKeyEnv', 'accessTokenEnv', 'appIdEnv', 'voiceTypeEnv', 'resourceIdEnv']) delete settings[key];
    const ordered = Object.fromEntries(Object.entries(settings).sort(([a], [b]) => a.localeCompare(b)));
    const legacyKey = createHash('sha256').update(JSON.stringify({settings: ordered, text: '测试', version: 1})).digest('hex');
    expect(voiceCacheKey('测试', config)).not.toBe(legacyKey);
  });

  it('uses the selected output sample rate in the actual combined voiceover', () => {
    const storyboard = JSON.parse(fs.readFileSync('examples/creator-production-pilot/storyboard.json', 'utf8'));
    storyboard.scenes = [storyboard.scenes[0]];
    storyboard.scenes[0].narration = '测试。';
    storyboard.project.durationFrames = storyboard.scenes[0].durationFrames;
    storyboard.project.durationSec = storyboard.project.durationFrames / storyboard.project.fps;
    fs.writeFileSync(path.join(project, 'storyboard.json'), JSON.stringify(storyboard));
    writeProfile('tts-config.json', {...base, provider: 'mock', outputSampleRate: 48000});
    const synthesis = spawnSync(process.execPath, ['--import', 'tsx/esm', 'scripts/synthesize-voiceover.mjs', project], {encoding: 'utf8'});
    expect(synthesis.status, synthesis.stderr).toBe(0);
    const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=sample_rate', '-of', 'default=noprint_wrappers=1:nokey=1', path.join(project, 'audio', 'generated', 'voiceover.wav')], {encoding: 'utf8'});
    expect(probe.status).toBe(0);
    expect(probe.stdout.trim()).toBe('48000');
  });

  it('previews a real provider into a unique local file without creating a production package', async () => {
    const tonePath = path.join(project, 'tone.wav');
    await synthesizeSpeech({text: '测试', config: {provider: 'mock', format: 'wav', sampleRate: 24000, speedRatio: 1}, outputPath: tonePath});
    vi.stubEnv('FRAMELOOM_TEST_KEY', 'dummy');
    writeProfile('tts-config.json', {...base, provider: 'openai', apiKeyEnv: 'FRAMELOOM_TEST_KEY'});
    vi.stubGlobal('fetch', vi.fn(async () => new globalThis.Response(fs.readFileSync(tonePath), {headers: {'content-type': 'audio/wav'}})));
    const first = await previewTts({projectPath: project, text: '试听'});
    const second = await previewTts({projectPath: project, text: '试听'});
    expect(first.outputPath).not.toBe(second.outputPath);
    expect(first.durationSec).toBeGreaterThan(0);
    expect(fs.existsSync(first.outputPath)).toBe(true);
    expect(fs.existsSync(path.join(project, 'audio', 'audio-manifest.json'))).toBe(false);
    await expect(previewTts({projectPath: project, text: '长'.repeat(501)})).rejects.toThrow('1–500');
    expect(() => parsePreviewArgs([project, '--text'])).toThrow('缺少值');
    expect(() => parsePreviewArgs([project, '--text', '测试', '--text-file', 'file'])).toThrow('只能选一个');
    expect(() => parsePreviewArgs([project, '--unknown', 'x'])).toThrow('参数无效');
    const previousCalls = globalThis.fetch.mock.calls.length;
    writeProfile('tts-config.json', {...base, provider: 'mock'});
    await expect(previewTts({projectPath: project, text: '测试'})).rejects.toThrow('mock');
    expect(globalThis.fetch.mock.calls.length).toBe(previousCalls);
  });
});
