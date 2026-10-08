import {describe, expect, it} from 'vitest';
import sample from '../examples/shot-recipes/paper-title/storyboard.json' with {type: 'json'};
import {checkContentQuality} from '../scripts/lib/content-quality.mjs';
import {checkStoryboardInput} from '../scripts/lib/preflight.mjs';

function titleVideo() {
  const storyboard = structuredClone(sample);
  storyboard.project = {...storyboard.project, durationSec: 40, durationFrames: 1200};
  storyboard.scenes = Array.from({length: 4}, (_, index) => ({...structuredClone(sample.scenes[0]), id: `scene-${index}`, durationFrames: 300}));
  return storyboard;
}

describe('editorial warnings before rendering', () => {
  it('flags the long repeated title-card failure through the shared preflight without blocking', () => {
    const issues = checkStoryboardInput(titleVideo(), {executionMode: 'fast'});
    expect(issues.filter(item => item.severity === 'error')).toEqual([]);
    expect(issues.filter(item => item.path.startsWith('contentQuality.')).map(item => item.path))
      .toEqual(['contentQuality.repetition', 'contentQuality.titleHolds']);
    expect(issues.find(item => item.path === 'contentQuality.titleHolds').message).toContain('字幕变化不等于');
  });
  it('does not impose variety on a short title clip or legacy storyboard', () => {
    expect(checkContentQuality(sample)).toEqual([]);
    expect(checkContentQuality({...titleVideo(), schemaVersion: '2.3'})).toEqual([]);
  });
  it('recognizes different semantic jobs inside the same base recipe', () => {
    const video = titleVideo();
    video.scenes.forEach((scene, index) => {
      scene.shot.id = 'semantic-default';
      scene.visual.kind = ['sequence', 'compare', 'metric', 'network'][index];
    });
    expect(checkContentQuality(video)).toEqual([]);
  });
  it('keeps reading-heavy media and substantive cards out of the title-only warning', () => {
    const video = titleVideo();
    video.scenes.forEach(scene => {scene.layers[0].type = 'card';});
    expect(checkContentQuality(video).some(item => item.path === 'contentQuality.titleHolds')).toBe(false);
  });
  it('does not flag title holds when content cues are spread across the narration', () => {
    const video = titleVideo();
    video.scenes.forEach(scene => {scene.beats.at(-1).start = 220;});
    expect(checkContentQuality(video).some(item => item.path === 'contentQuality.titleHolds')).toBe(false);
  });
  it('lets schema errors stop preflight before editorial inspection', () => {
    expect(checkStoryboardInput({}, {executionMode: 'fast'}).every(item => item.severity === 'error')).toBe(true);
  });
});
