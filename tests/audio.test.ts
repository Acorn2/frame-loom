import {describe, expect, it} from 'vitest';
import {getCaptionOverlayLayout} from '../src/audio/CaptionOverlay';
import {displayCaptionText, parseCaptions, splitCaptionCues, splitCaptionText} from '../src/audio/captions';
import {getMusicVolumeAtFrame} from '../src/audio/ducking';
import {analyzeAudioTiming, analyzeSceneAudioAlignment} from '../src/audio/timing';
import {shouldRenderSceneCaptions} from '../src/compositions/DataDrivenVideo';

describe('audio timing', () => {
  it('ducks music under voiceover with attack and release ramps', () => {
    const ducking = {enabled: true, volume: 0.2, attackSec: 0.5, releaseSec: 0.5};
    expect(getMusicVolumeAtFrame({frame: 0, fps: 30, baseVolume: 0.5, voiceoverDurationSec: 10, ducking})).toBeCloseTo(0.5);
    expect(getMusicVolumeAtFrame({frame: 15, fps: 30, baseVolume: 0.5, voiceoverDurationSec: 10, ducking})).toBeCloseTo(0.1);
    expect(getMusicVolumeAtFrame({frame: 285, fps: 30, baseVolume: 0.5, voiceoverDurationSec: 10, ducking})).toBeCloseTo(0.1);
    expect(getMusicVolumeAtFrame({frame: 300, fps: 30, baseVolume: 0.5, voiceoverDurationSec: 10, ducking})).toBeCloseTo(0.1);
    expect(getMusicVolumeAtFrame({frame: 315, fps: 30, baseVolume: 0.5, voiceoverDurationSec: 10, ducking})).toBeCloseTo(0.5);
  });

  it('keeps music volume unchanged when ducking is disabled or voiceover is absent', () => {
    expect(getMusicVolumeAtFrame({frame: 120, fps: 30, baseVolume: 0.5})).toBe(0.5);
    expect(getMusicVolumeAtFrame({
      frame: 120,
      fps: 30,
      baseVolume: 0.5,
      voiceoverDurationSec: 10,
      ducking: {enabled: false, volume: 0.2, attackSec: 0, releaseSec: 0}
    })).toBe(0.5);
  });

  it('fades optional music at both ends while keeping voiceover ducking', () => {
    const settings = {
      fps: 30, baseVolume: 0.2, videoDurationSec: 10, voiceoverDurationSec: 8,
      ducking: {enabled: true, volume: 0.5, attackSec: 0.4, releaseSec: 0.4}
    };
    expect(getMusicVolumeAtFrame({...settings, frame: 0})).toBe(0);
    expect(getMusicVolumeAtFrame({...settings, frame: 15})).toBeCloseTo(0.05);
    expect(getMusicVolumeAtFrame({...settings, frame: 30})).toBeCloseTo(0.1);
    expect(getMusicVolumeAtFrame({...settings, frame: 240})).toBeCloseTo(0.1);
    expect(getMusicVolumeAtFrame({...settings, frame: 255})).toBeCloseTo(0.15);
    expect(getMusicVolumeAtFrame({...settings, frame: 300})).toBe(0);
    expect(getMusicVolumeAtFrame({...settings, frame: 0, fadeInSec: 0, fadeOutSec: 0})).toBeCloseTo(0.2);
  });

  it('places captions inside the selected orientation safe area', () => {
    const landscape = getCaptionOverlayLayout({
      width: 1920,
      height: 1080,
      safeArea: {top: 100, right: 120, bottom: 100, left: 120}
    });
    const portrait = getCaptionOverlayLayout({
      width: 1080,
      height: 1920,
      safeArea: {top: 132, right: 72, bottom: 144, left: 72}
    });
    expect(landscape.left).toBe(120);
    expect(landscape.right).toBe(120);
    expect(landscape.bottom).toBe(116);
    expect(landscape.maxWidth).toBe(1180);
    expect(portrait.left).toBe(72);
    expect(portrait.right).toBe(72);
    expect(portrait.bottom).toBe(164);
    expect(portrait.maxWidth).toBe(860);
  });

  it('uses external captions as the only caption layer when available', () => {
    expect(shouldRenderSceneCaptions()).toBe(true);
    expect(shouldRenderSceneCaptions({captions: []})).toBe(true);
    expect(shouldRenderSceneCaptions({captions: [{startSec: 0, endSec: 1, text: 'external'}]})).toBe(false);
  });

  it('parses SRT and WebVTT cues', () => {
    const srt = parseCaptions('1\n00:00:00,500 --> 00:00:02,000\n第一句\n\n2\n00:00:02,200 --> 00:00:03,500\n第二句');
    const vtt = parseCaptions('WEBVTT\n\n00:00.000 --> 00:01.250 align:center\nHello');
    expect(srt).toEqual([
      {startSec: 0.5, endSec: 2, text: '第一句'},
      {startSec: 2.2, endSec: 3.5, text: '第二句'}
    ]);
    expect(vtt).toEqual([{startSec: 0, endSec: 1.25, text: 'Hello'}]);
  });

  it('preserves multiline caption cues for deliberate wrapping', () => {
    const captions = parseCaptions('1\n00:00:00,000 --> 00:00:02,000\n第一行\n第二行');
    expect(captions).toEqual([{startSec: 0, endSec: 2, text: '第一行\n第二行'}]);
  });

  it('turns a scene-long narration cue into short, continuous single-line cues', () => {
    const text = '我做通辽宇宙知识库，是想给零散内容一个回查入口，不用再盲翻视频标题，还能沿着线索接着找。';
    const chunks = splitCaptionText(text);
    const cues = splitCaptionCues([{startSec: 9.5, endSec: 16.748, text}]);
    expect(chunks.join('')).toBe(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 20 && !chunk.includes('\n'))).toBe(true);
    expect(cues[0]?.startSec).toBe(9.5);
    expect(cues.at(-1)?.endSec).toBe(16.748);
    for (let index = 1; index < cues.length; index += 1) {
      expect(cues[index]?.startSec).toBeCloseTo(cues[index - 1]?.endSec ?? 0);
    }
    expect(cues.every((cue) => !/^[，。；：、,.!?;:]|[，。；：、,.;:]$/u.test(cue.text))).toBe(true);
  });

  it('removes pause punctuation only at caption boundaries', () => {
    expect(displayCaptionText('，这轮更新，我重点补上内容间的断点。')).toBe('这轮更新，我重点补上内容间的断点');
    expect(displayCaptionText('你会回来吗？')).toBe('你会回来吗？');
    expect(displayCaptionText('太好了！')).toBe('太好了！');
    expect(splitCaptionCues([{startSec: 0, endSec: 3, text: '这轮更新，我重点补上内容间的断点。'}])[0]?.text).toBe('这轮更新，我重点补上内容间的断点');
  });

  it('accepts aligned narration, music and captions', () => {
    const report = analyzeAudioTiming(
      10,
      [
        {id: 'voiceover', kind: 'voiceover', startSec: 0, durationSec: 9.5},
        {id: 'music', kind: 'music', startSec: 0, durationSec: 12}
      ],
      [{startSec: 0.2, endSec: 9.4, text: 'caption'}]
    );
    expect(report.needsRetiming).toBe(false);
    expect(report.maxContentEndSec).toBe(9.5);
  });

  it('flags a static scene tail after narration ends', () => {
    const scenes = [{sceneId: 'search-change', startSec: 9.5, endSec: 19.5}];
    const loose = analyzeSceneAudioAlignment(scenes, [{sceneId: 'search-change', startSec: 9.5, endSec: 16.748}]);
    const aligned = analyzeSceneAudioAlignment(scenes, [{sceneId: 'search-change', startSec: 9.5, endSec: 19.36}]);
    expect(loose.passed).toBe(false);
    expect(loose.measurements[0]?.trailingGapSec).toBeCloseTo(2.752);
    expect(aligned.passed).toBe(true);
  });

  it('flags overflowing audio and overlapping captions', () => {
    const report = analyzeAudioTiming(
      10,
      [{id: 'voiceover', kind: 'voiceover', startSec: 0, durationSec: 10.5}],
      [
        {startSec: 1, endSec: 4, text: 'one'},
        {startSec: 3.5, endSec: 11, text: 'two'}
      ]
    );
    expect(report.needsRetiming).toBe(true);
    expect(report.issues.filter((item) => item.severity === 'error')).toHaveLength(3);
  });
});
