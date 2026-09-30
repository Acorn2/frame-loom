import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StoryboardSchema } from '../src/schemas/storyboard';
import { TtsConfigSchema } from '../src/schemas/tts-config';
import { analyzeSceneAudioAlignment } from '../src/audio/timing';
import { splitCaptionText } from '../src/audio/captions';
import { hashNarration } from '../src/audio/text-hash';
import { proposeAudioTiming } from '../src/audio/retime';
import { shouldRenderReviewMarker } from '../src/compositions/DataDrivenVideo';
import { validateContentMapping } from '../src/validation/mapping-validator';
import { getSceneTimeline } from '../src/timeline/scene-timeline';
import { cachedSpeech, voiceCacheKey } from '../scripts/lib/voice-cache.mjs';
import { resolveManualCues } from '../scripts/lib/caption-cues.mjs';
import { selectReviewFrames } from '../scripts/extract-review-frames.mjs';
import { inspectCleanNarratedRender, writeRenderReceipt } from '../scripts/lib/render-receipt.mjs';
import fixture from '../examples/quality-production/storyboard.json' with { type: 'json' };
const directories = [];
const temp = () => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-loom-quality-')); directories.push(dir); return dir; };
afterEach(() => { vi.unstubAllEnvs(); for (const dir of directories.splice(0))
    fs.rmSync(dir, { recursive: true, force: true }); });
describe('quality production contracts', () => {
    it('keeps clean narrated candidates separate from review markers', () => {
        expect(shouldRenderReviewMarker({ purpose: 'in-project-video' })).toBe(false);
        expect(shouldRenderReviewMarker({ purpose: 'visual-preview' })).toBe(true);
        expect(shouldRenderReviewMarker({ purpose: 'visual-master', showReviewMarker: true })).toBe(false);
        const file = path.join(temp(), 'candidate.mp4');
        fs.writeFileSync(file, 'fixture bytes');
        expect(() => inspectCleanNarratedRender(file)).toThrow(/缺少/);
        writeRenderReceipt(file, { purpose: 'in-project-video', showReviewMarker: true });
        expect(() => inspectCleanNarratedRender(file)).toThrow(/不带审片标记/);
        writeRenderReceipt(file, { purpose: 'in-project-video', showReviewMarker: false });
        expect(inspectCleanNarratedRender(file).passed).toBe(true);
        fs.appendFileSync(file, 'changed');
        expect(() => inspectCleanNarratedRender(file)).toThrow(/不一致/);
    });
    it('detects adjacent speech overlap independently of captions', () => {
        const scenes = [{ sceneId: 'a', startSec: 0, endSec: 10 }, { sceneId: 'b', startSec: 9.5, endSec: 19.5 }];
        const segments = [{ sceneId: 'a', startSec: 0, endSec: 9.8 }, { sceneId: 'b', startSec: 9.5, endSec: 19.2 }];
        expect(analyzeSceneAudioAlignment(scenes, segments).issues.join()).toContain('重叠 0.300');
        scenes[1].startSec = 10;
        segments[1].startSec = 10;
        expect(analyzeSceneAudioAlignment(scenes, segments).passed).toBe(true);
    });
    it('protects words, decimal numbers and versions and rejects an unreadable word', () => {
        const chunks = splitCaptionText('这是一段较长的中文说明用于验证 OpenAI v4.1.11 和 12.35 的显示');
        for (const term of ['OpenAI', 'v4.1.11', '12.35'])
            expect(chunks.some((chunk) => chunk.includes(term))).toBe(true);
        expect(() => splitCaptionText('OpenAICompatibleEndpointConfiguration')).toThrow(/完整词/);
    });
    it('reuses measured speech independently of placement and regenerates corrupt entries', async () => {
        const projectPath = temp();
        const config = TtsConfigSchema.parse({ schemaVersion: '1.0', enabled: true, provider: 'mock', voiceType: 'test' });
        const outputPath = path.join(projectPath, 'voice.wav');
        const first = await cachedSpeech({ projectPath, text: '测试语音', config, outputPath });
        expect(first.reused).toBe(false);
        expect((await cachedSpeech({ projectPath, text: '测试语音', config: { ...config, timeoutMs: 1000, outputDirectory: 'audio/other' }, outputPath })).reused).toBe(true);
        expect((await cachedSpeech({ projectPath, text: '修改语音', config, outputPath })).reused).toBe(false);
        fs.appendFileSync(path.join(projectPath, '.cache', 'tts', `${first.cacheKey}.wav`), 'corrupt');
        expect((await cachedSpeech({ projectPath, text: '测试语音', config, outputPath })).reused).toBe(false);
        expect((await cachedSpeech({ projectPath, text: '测试语音', config, outputPath, refresh: true })).reused).toBe(false);
        vi.stubEnv('QUALITY_VOICE', 'one');
        const key = voiceCacheKey('测试', { ...config, voiceTypeEnv: 'QUALITY_VOICE' });
        vi.stubEnv('QUALITY_VOICE', 'two');
        expect(voiceCacheKey('测试', { ...config, voiceTypeEnv: 'QUALITY_VOICE' })).not.toBe(key);
    });
    it.each([24, 30, 60])('proposes measured timing at %i fps without modifying or approving source', (fps) => {
        const source = StoryboardSchema.parse(fixture);
        source.project.fps = fps;
        source.project.status = 'approved';
        source.scenes[1].transitionIn = { type: 'overlap-fade', durationFrames: 15 };
        const before = JSON.stringify(source);
        const result = proposeAudioTiming(source, source.scenes.map((scene) => ({ sceneId: scene.id, durationSec: 7.321 })));
        expect(JSON.stringify(source)).toBe(before);
        expect(result.project.status).toBe('generated');
        const timeline = getSceneTimeline(result);
        const alignment = analyzeSceneAudioAlignment(timeline.map(({ scene, startFrame, endFrame }) => ({ sceneId: scene.id, startSec: startFrame / fps, endSec: endFrame / fps })), timeline.map(({ scene, startFrame }) => ({ sceneId: scene.id, startSec: startFrame / fps, endSec: startFrame / fps + 7.321 })));
        expect(alignment.passed).toBe(true);
        expect(StoryboardSchema.safeParse(result).success).toBe(true);
    });
    it('accepts reviewed local cues only for unchanged narration and nonoverlapping speech', () => {
        const text = '先看文字，再看证据。';
        const segment = { sceneId: 'a', text, textHash: hashNarration(text), startSec: 10, durationSec: 4 };
        const input = { schemaVersion: '1.0', scenes: [{ sceneId: 'a', textHash: segment.textHash, cues: [{ startSec: 0, endSec: 1.5, text: '先看文字' }, { startSec: 1.8, endSec: 4, text: '再看证据' }] }] };
        expect(resolveManualCues(input, [segment])[1].start).toBe(11.8);
        input.scenes[0].cues[1].startSec = 1;
        expect(() => resolveManualCues(input, [segment])).toThrow(/重叠/);
        input.scenes[0].textHash = 'stale';
        expect(() => resolveManualCues(input, [segment])).toThrow(/指纹/);
    });
    it('validates direction, state identity and focus bounds for both public examples', () => {
        for (const file of ['storyboard.json', 'storyboard.research.json']) {
            const source = StoryboardSchema.parse(JSON.parse(fs.readFileSync(`examples/quality-production/${file}`, 'utf8')));
            expect(validateContentMapping(source)).toEqual([]);
            source.scenes[0].connections[0].from = 'script';
            expect(validateContentMapping(source).some((issue) => issue.severity === 'error')).toBe(true);
        }
        const invalid = structuredClone(fixture);
        invalid.scenes[2].visual.mediaFocus.x = 0.9;
        expect(StoryboardSchema.safeParse(invalid).success).toBe(false);
    });
    it('keeps every scene complete and pre-cut frame in a long production', () => {
        const source = StoryboardSchema.parse(fixture);
        source.scenes = Array.from({ length: 35 }, (_, index) => ({ ...structuredClone(source.scenes[index % 3]), id: `scene-${index}` }));
        source.project.durationFrames = 35 * 240;
        const frames = selectReviewFrames(source);
        for (const scene of source.scenes) {
            expect(frames.some((frame) => frame.label === `${scene.id}-complete`)).toBe(true);
            expect(frames.some((frame) => frame.label === `${scene.id}-before-handoff`)).toBe(true);
        }
    });
});
