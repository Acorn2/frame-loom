import {describe, expect, it} from 'vitest';
import storyboard from '../examples/semantic-visuals/storyboard.json' with {type: 'json'};
import type {StoryboardScene} from '../src/schemas/storyboard';
import {getAttentionOpacity, getAttentionTarget} from '../src/timeline/attention';

describe('sequential attention', () => {
  it('highlights the newest subject and dims earlier subjects after a short handoff', () => {
    const scene = structuredClone(storyboard.scenes[1]) as unknown as StoryboardScene;
    scene.layers = [
      {id: 'first', type: 'node', text: 'first'},
      {id: 'second', type: 'node', text: 'second'}
    ];
    scene.beats = [
      {id: 'first-in', target: 'first', action: 'enter', start: 5, duration: 18},
      {id: 'second-in', target: 'second', action: 'enter', start: 45, duration: 18},
      {id: 'second-focus', target: 'second', action: 'focus', start: 70, duration: 18}
    ];
    expect(getAttentionTarget(scene, 20)).toBe('first');
    expect(getAttentionOpacity(scene, 'first', 20)).toBe(1);
    expect(getAttentionTarget(scene, 50)).toBe('second');
    expect(getAttentionOpacity(scene, 'first', 50)).toBeLessThan(1);
    expect(getAttentionOpacity(scene, 'second', 57)).toBe(1);
    expect(getAttentionOpacity(scene, 'first', 57)).toBeCloseTo(0.72);
    expect(getAttentionOpacity(scene, 'first', 70)).toBeCloseTo(0.72);
    expect(getAttentionOpacity(scene, 'second', 70)).toBe(1);
  });
});
