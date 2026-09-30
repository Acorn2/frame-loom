import {describe, expect, it} from 'vitest';
import semanticStoryboard from '../examples/semantic-visuals/storyboard.json' with {type: 'json'};
import type {StoryboardScene} from '../src/schemas/storyboard';
import {transitionStyle} from '../src/templates/semantic/SemanticScene';
import {overlapHandoffOpacity} from '../src/timeline/overlap-handoff';

describe('overlap handoff', () => {
  it('fades old information out before new information fades and slides in', () => {
    const oldScene = structuredClone(semanticStoryboard.scenes[1]) as unknown as StoryboardScene;
    const newScene = structuredClone(semanticStoryboard.scenes[2]) as unknown as StoryboardScene;
    const overlap = 15;
    newScene.transitionIn = {type: 'overlap-slide', durationFrames: overlap};
    const old = (local: number) => Number(transitionStyle(oldScene, oldScene.durationFrames - overlap + local, overlap).opacity);
    const incoming = (local: number) => Number(transitionStyle(newScene, local, 0).opacity);

    expect(old(0)).toBe(1);
    expect(incoming(0)).toBe(0);
    expect(old(3)).toBeGreaterThan(old(6));
    expect(old(6)).toBeGreaterThan(0);
    expect(old(8)).toBe(0);
    expect(incoming(8)).toBeGreaterThan(0);
    expect(incoming(11)).toBeGreaterThan(incoming(8));
    expect(transitionStyle(newScene, 0, 0).transform).toBe('translateY(28px)');
    for (let local = 0; local < overlap; local += 1) {
      expect(old(local) * incoming(local)).toBe(0);
    }
  });

  it('keeps full opacity outside overlaps and combines both sides of a short scene', () => {
    expect(overlapHandoffOpacity({frame: 30, durationFrames: 90, overlapInFrames: 15, overlapOutFrames: 15})).toBe(1);
    expect(overlapHandoffOpacity({frame: 0, durationFrames: 20, overlapInFrames: 15, overlapOutFrames: 15})).toBe(0);
    expect(overlapHandoffOpacity({frame: 19, durationFrames: 20, overlapInFrames: 15, overlapOutFrames: 15})).toBe(0);
  });
});
