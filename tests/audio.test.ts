import {describe, expect, it} from 'vitest';
import {getCaptionOverlayLayout} from '../src/audio/CaptionOverlay';
import {parseCaptions} from '../src/audio/captions';
import {getMusicVolumeAtFrame} from '../src/audio/ducking';
import {analyzeAudioTiming} from '../src/audio/timing';
import {shouldRenderSceneCaptions} from '../src/compositions/DataDrivenVideo';

describe('audio timing', () => {
  it('ducks music under voiceover with attack and release ramps', () => {
    const ducking = {enabled: true, volume: 0.2, attackSec: 0.5, releaseSec: 0.5};
    expect(getMusicVolumeAtFrame({frame: 0, fps: 30, baseVolume: 0.5, voiceoverDurationSec: 10, ducking})).toBeCloseTo(0.5);
    expect(getMusicVolumeAtFrame({frame: 15, fps: 30, baseVolume: 0.5, voiceoverDurationSec: 10, ducking})).toBeCloseTo(0.1);
    expect(getMusicVolumeAtFrame({frame: 285, fps: 30, baseVolume: 0.5, voiceoverDurationSec: 10, ducking})).toBeCloseTo(0.1);
    expect(getMusicVolumeAtFrame({frame: 300, fps: 30, baseVolume: 0.5, voiceoverDurationSec: 10, ducking})).toBeCloseTo(0.5);
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
