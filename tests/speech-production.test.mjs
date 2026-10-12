import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Buffer} from 'node:buffer';
import {spawnSync} from 'node:child_process';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {speechCaptions, speechWindows, validateSpeechWords} from '../src/audio/speech-timing.ts';
import {SpeechCuesSchema} from '../src/audio/whiteboard-timing.ts';
import {proposeAudioTiming} from '../src/audio/retime.ts';
import {hashNarration} from '../src/audio/text-hash.ts';
import {StoryboardSchema} from '../src/schemas/storyboard.ts';
import {LAYOUT_LOG_PREFIX} from '../src/layout/diagnostics.ts';
import {TtsConfigSchema} from '../src/schemas/tts-config.ts';
import {cachedSpeech, voiceCacheKey} from '../scripts/lib/voice-cache.mjs';
import {synthesizeSpeech} from '../scripts/lib/tts-provider.mjs';
import {main as synthesizeVoiceover} from '../scripts/synthesize-voiceover.mjs';
import {sceneCacheKey, renderWithSceneCache} from '../scripts/lib/scene-cache.mjs';
import fixture from '../examples/whiteboard-reference/storyboard.json' with {type: 'json'};

const directories = [];
const temp = () => {const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-loom-speech-')); directories.push(directory); return directory;};
afterEach(() => {vi.unstubAllEnvs(); vi.unstubAllGlobals(); for (const directory of directories.splice(0)) fs.rmSync(directory, {recursive: true, force: true});});
const text = '先懂道理，再做改变。';
const words = [...text.replace(/[，。]/gu, '')].map((char, i) => ({text: char, startSec: i < 4 ? i * .4 : 3 + (i - 4) * .4, endSec: i < 4 ? (i + 1) * .4 : 3 + (i - 3) * .4}));
function board() {
  const value = structuredClone(fixture), scene = value.scenes[0];
  scene.id = 'intro'; scene.title = '道理'; scene.narration = text;
  scene.layers = [{id: 'heading', type: 'node', label: '道理'}, {id: 'result', type: 'node', label: '改变'}];
  scene.shot.slots.items = ['heading', 'result'];
  scene.shot.elements = {heading: {kind: 'text', x: 80, y: 80, width: 800, height: 100, fontSize: 80}, result: {kind: 'text', x: 80, y: 400, width: 800, height: 100, fontSize: 60}};
  scene.shot.routes = {}; scene.connections = [];
  scene.beats = [{id: 'write-heading', target: 'heading', action: 'reveal', start: 0, duration: 30}, {id: 'write-result', target: 'result', action: 'reveal', start: 80, duration: 30}];
  scene.captions = [];
  scene.durationFrames = 185; value.project.durationFrames = 185; value.project.durationSec = 185 / 30;
  return StoryboardSchema.parse(value);
}
const cues = () => SpeechCuesSchema.parse({schemaVersion: '1.0', scenes: [{sceneId: 'intro', textHash: hashNarration(text), groups: [{text: '先懂道理，', targets: ['heading']}, {text: '再做改变。', targets: ['result']}]}]});

describe('speech timing evidence and whiteboard proposals', () => {
  it('uses word times across a real pause and preserves source punctuation for display rules', () => {
    expect(speechWindows(text, ['先懂道理，', '再做改变。'], words, 6)).toEqual([{text: '先懂道理，', start: 0, end: 1.6}, {text: '再做改变。', start: 3, end: 4.6}]);
    expect(speechCaptions(text, 10, 6, words)).toMatchObject({source: 'provider', cues: [{start: 10, end: 14.6, text: '先懂道理，再做改变'}]});
  });
  it.each([words.slice(1), [...words].reverse(), [{text, startSec: 0, endSec: 99}], [{text: '换了讲稿', startSec: 0, endSec: 1}]])('marks invalid evidence as estimated', invalid => {
    expect(validateSpeechWords(text, invalid, 6)).toBe(false);
    expect(speechCaptions(text, 0, 6, invalid).source).toBe('estimated');
  });
  it('does not claim an interpolated cut inside a supplier word as measured', () => {
    expect(speechWindows(text, ['先懂道理，', '再做改变。'], [{text, startSec: 0, endSec: 6}], 6)).toBeUndefined();
  });
  it('does not remove meaning-bearing math symbols when checking text coverage', () => {
    expect(validateSpeechWords('理解≠行动', [{text: '理解行动', startSec: 0, endSec: 2}], 2)).toBe(false);
  });
  it.each([24, 30, 60])('schedules one pen at %i fps without editing its source', fps => {
    const source = board(); source.project.fps = fps;
    const before = JSON.stringify(source);
    const proposal = proposeAudioTiming(source, [{sceneId: 'intro', durationSec: 6, speechWords: words}], cues());
    expect(proposal.scenes[0].beats[1].start).toBe(3 * fps);
    expect(proposal.scenes[0].beats[0].start + proposal.scenes[0].beats[0].duration).toBeLessThan(proposal.scenes[0].beats[1].start);
    expect(proposal.project.status).toBe('generated');
    expect(proposal.project.durationSec - 6).toBeLessThan(.5);
    expect(JSON.stringify(source)).toBe(before);
  });
  it('records estimated groups separately from provider-aligned groups', () => {
    const measured = [], estimated = [], original = [];
    proposeAudioTiming(board(), [{sceneId: 'intro', durationSec: 6, speechWords: words}], cues(), evidence => measured.push(evidence));
    proposeAudioTiming(board(), [{sceneId: 'intro', durationSec: 6}], cues(), evidence => estimated.push(evidence));
    proposeAudioTiming(board(), [{sceneId: 'intro', durationSec: 6}], undefined, evidence => original.push(evidence));
    expect(measured[0].timingSource).toBe('provider'); expect(estimated[0].timingSource).toBe('estimated'); expect(original[0].timingSource).toBe('original-beats');
  });
  it('retimes the complete reference whiteboard with stickers, shapes and arrows', () => {
    const source = StoryboardSchema.parse(fixture), before = JSON.stringify(source);
    const proposal = proposeAudioTiming(source, [{sceneId: 'know', durationSec: 24}]);
    const beats = [...proposal.scenes[0].beats].sort((a, b) => a.start - b.start);
    expect(beats).toHaveLength(10);
    for (let i = 1; i < beats.length; i++) expect(beats[i].start).toBeGreaterThanOrEqual(beats[i - 1].start + beats[i - 1].duration);
    expect(beats.at(-1).start + beats.at(-1).duration + 36).toBeLessThanOrEqual(proposal.scenes[0].durationFrames);
    expect(proposal.font).toEqual(source.font);
    expect(JSON.stringify(source)).toBe(before);
  });
  it('rejects stale semantics, unknown targets and unreadably short speech', () => {
    const stale = cues(); stale.scenes[0].textHash = 'a'.repeat(64);
    expect(() => proposeAudioTiming(board(), [{sceneId: 'intro', durationSec: 6}], stale)).toThrow(/旁白不一致/);
    const unknown = cues(); unknown.scenes[0].groups[1].targets = ['missing'];
    expect(() => proposeAudioTiming(board(), [{sceneId: 'intro', durationSec: 6}], unknown)).toThrow(/所有绘制目标/);
    expect(() => proposeAudioTiming(board(), [{sceneId: 'intro', durationSec: .6}], cues())).toThrow(/窗口不足/);
  });
  it('preserves late provider words through the audio cache and synthesis manifest', async () => {
    const projectPath = temp(), audioPath = path.join(projectPath, 'fixture.wav');
    await synthesizeSpeech({text: '六秒', config: {provider: 'mock', format: 'wav', sampleRate: 24000, speedRatio: .1}, outputPath: audioPath});
    const audio = fs.readFileSync(audioPath);
    vi.stubEnv('SPEECH_TEST_KEY', 'fixture');
    vi.stubEnv('VOLC_TTS_RESOURCE_ID', 'seed-tts-2.0');
    const config = TtsConfigSchema.parse({schemaVersion: '1.0', provider: 'doubao', enabled: true, apiVersion: 'v3', endpoint: 'https://openspeech.bytedance.com/api/v3/tts/unidirectional', apiKeyEnv: 'SPEECH_TEST_KEY', voiceType: 'test', format: 'wav', requestBody: {req_params: {audio_params: {enable_subtitle: true}}}});
    const response = () => new globalThis.Response([
      JSON.stringify({code: 0, data: audio.toString('base64')}),
      JSON.stringify({code: 0, sentence: {words: words.map(word => ({word: word.text, startTime: word.startSec, endTime: word.endSec}))}}),
      JSON.stringify({code: 20000000})
    ].join('\n'), {headers: {'content-type': 'text/event-stream'}});
    const fetch = vi.fn(async () => response()); vi.stubGlobal('fetch', fetch);
    const outputPath = path.join(projectPath, 'take.wav');
    const first = await cachedSpeech({projectPath, text, config, outputPath});
    expect(first.speechWords).toEqual(words);
    expect((await cachedSpeech({projectPath, text, config, outputPath})).reused).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    const metadata = path.join(projectPath, '.cache', 'tts', `${voiceCacheKey(text, config)}.wav.json`);
    const record = JSON.parse(fs.readFileSync(metadata)); record.speechWords[0].startSec = .1; fs.writeFileSync(metadata, JSON.stringify(record));
    expect((await cachedSpeech({projectPath, text, config, outputPath})).reused).toBe(false);
    fs.mkdirSync(path.join(projectPath, 'audio'));
    const value = board(); value.scenes[0].durationFrames = 1800; value.project.durationFrames = 1800; value.project.durationSec = 60;
    fs.writeFileSync(path.join(projectPath, 'storyboard.json'), JSON.stringify(value));
    fs.writeFileSync(path.join(projectPath, 'audio', 'tts-config.json'), JSON.stringify(config));
    const result = await synthesizeVoiceover({projectPath});
    expect(result.manifest.captionTimingSource).toBe('provider');
    expect(result.manifest.segments[0].speechWords).toEqual(words);
    const cueFile = path.join(projectPath, 'speech-cues.json'); fs.writeFileSync(cueFile, JSON.stringify(cues()));
    const proposalFile = path.join(projectPath, 'storyboard.timing.json');
    const sourceBefore = fs.readFileSync(path.join(projectPath, 'storyboard.json'), 'utf8');
    await synthesizeVoiceover({projectPath, timingOutput: proposalFile, speechCuesPath: cueFile});
    expect(JSON.parse(fs.readFileSync(`${proposalFile}.timing.json`)).whiteboard[0].timingSource).toBe('provider');
    expect(fs.readFileSync(path.join(projectPath, 'storyboard.json'), 'utf8')).toBe(sourceBefore);
    await expect(synthesizeVoiceover({projectPath, timingOutput: proposalFile, speechCuesPath: cueFile})).rejects.toThrow(/新的输出路径/);
    expect(fs.readFileSync(path.join(projectPath, result.manifest.captionsPath), 'utf8')).toContain('00:00:04,600');
    fs.writeFileSync(path.join(projectPath, 'audio', 'caption-cues.json'), JSON.stringify({schemaVersion: '1.0', scenes: [{sceneId: 'intro', textHash: hashNarration(text), cues: [{startSec: 0, endSec: 4.7, text}]}]}));
    const manual = await synthesizeVoiceover({projectPath, force: true});
    expect(manual.manifest.captionTimingSource).toBe('manual');
    expect(fs.readFileSync(path.join(projectPath, manual.manifest.captionsPath), 'utf8')).toContain('00:00:04,700');
  });
});

describe('scene cache dependency boundaries', () => {
  it('verifies real clip bytes and regenerates only edited or corrupt cache entries', async () => {
    const projectPath = temp(), storyboard = board(); delete storyboard.layoutPolicy;
    storyboard.project.width = 320; storyboard.project.height = 180;
    storyboard.scenes.push({...structuredClone(storyboard.scenes[0]), id: 'later'});
    storyboard.project.durationFrames *= 2; storyboard.project.durationSec *= 2;
    const inputProps = {storyboard, renderProfile: {purpose: 'visual-preview', productionLock: {rendererBuildHash: 'fixture'}}};
    const encode = async ({outputLocation, frameRange}) => {
      const frames = frameRange[1] - frameRange[0] + 1;
      const encoded = spawnSync('ffmpeg', ['-v', 'error', '-nostdin', '-f', 'lavfi', '-i', 'color=c=white:s=320x180:r=30', '-frames:v', String(frames), '-an', '-c:v', 'libx264', outputLocation]);
      if (encoded.status !== 0) throw new Error(encoded.stderr.toString());
    };
    const renderMedia = vi.fn(encode);
    const args = {projectPath, inputProps, composition: {width: 320, height: 180, fps: 30, durationInFrames: 370}, serveUrl: 'fixture', renderMedia, layout: {frames: [], onBrowserLog() {}}, hasAudio: false};
    const first = await renderWithSceneCache({...args, outputPath: path.join(projectPath, 'first.mp4')});
    expect(first.scenes.map(scene => scene.reused)).toEqual([false, false]);
    const second = await renderWithSceneCache({...args, outputPath: path.join(projectPath, 'second.mp4')});
    expect(second.scenes.map(scene => scene.reused)).toEqual([true, true]);
    expect(renderMedia).toHaveBeenCalledTimes(2);
    storyboard.scenes[1].layers[1].label = '改变内容';
    const edited = await renderWithSceneCache({...args, outputPath: path.join(projectPath, 'edited.mp4')});
    expect(edited.scenes.map(scene => scene.reused)).toEqual([true, false]);
    const cachePath = path.join(projectPath, '.cache', 'scenes', `${first.scenes[0].key}.mp4`);
    fs.writeFileSync(cachePath, 'corrupt fixture bytes');
    const repaired = await renderWithSceneCache({...args, outputPath: path.join(projectPath, 'repaired.mp4')});
    expect(repaired.scenes.map(scene => scene.reused)).toEqual([false, true]);
    expect(renderMedia).toHaveBeenCalledTimes(4);
    renderMedia.mockImplementationOnce(async options => {
      await encode(options);
      options.onBrowserLog({text: `${LAYOUT_LOG_PREFIX}${JSON.stringify({frame: 0, checks: [{sceneId: 'wrong-scene', frame: 0, issues: []}]})}`});
    });
    await expect(renderWithSceneCache({...args, layout: {frames: [0], onBrowserLog() {}}, outputPath: path.join(projectPath, 'invalid-layout.mp4')})).rejects.toThrow(/布局实测/);
  });
  it('invalidates changed visuals and current captions while reusing unaffected scene content', () => {
    const storyboard = board(); storyboard.scenes.push({...structuredClone(storyboard.scenes[0]), id: 'later'});
    const inputProps = {storyboard, styleTokens: {ink: '#000'}, renderProfile: {purpose: 'visual-preview', productionLock: {hash: 'global', storyboardHash: 'global', planHash: 'global', rendererBuildHash: 'renderer'}}};
    const timing = {scene: storyboard.scenes[0], startFrame: 0, endFrame: 185};
    const args = {inputProps, composition: {width: 1920, height: 1080, fps: 30, durationInFrames: 370}, timing, layoutFrames: [0, 184]};
    const key = sceneCacheKey(args);
    storyboard.scenes[1].narration = '只修改下一场'; inputProps.renderProfile.productionLock.storyboardHash = 'changed';
    expect(sceneCacheKey(args)).toBe(key);
    storyboard.scenes[0].layers[1].label = '变化'; expect(sceneCacheKey(args)).not.toBe(key);
    storyboard.scenes[0].layers[1].label = '改变';
    inputProps.audioRuntime = {captions: [{startSec: 0, endSec: 1, text: '字幕'}]}; expect(sceneCacheKey(args)).not.toBe(key);
    inputProps.renderProfile.productionLock.rendererBuildHash = 'new renderer'; expect(sceneCacheKey(args)).not.toBe(key);
  });
  it('uses the full render path for overlapped scenes before touching a cache', async () => {
    const storyboard = board(); storyboard.scenes.push({...structuredClone(storyboard.scenes[0]), id: 'later', transitionIn: {type: 'fade', durationFrames: 5}});
    const renderMedia = vi.fn();
    expect(await renderWithSceneCache({inputProps: {storyboard, renderProfile: {productionLock: {}}}, renderMedia})).toMatchObject({used: false});
    expect(renderMedia).not.toHaveBeenCalled();
  });
});
