import {describe, expect, it} from 'vitest';
import semanticStoryboard from '../examples/semantic-visuals/storyboard.json' with {type: 'json'};
import type {StoryboardScene} from '../src/schemas/storyboard';
import {transitionStyle} from '../src/templates/semantic/SemanticScene';

describe('semantic overlap handoff', () => {
  it('shows exactly one complete scene at each overlap frame', () => {
    const oldScene = structuredClone(semanticStoryboard.scenes[1]) as unknown as StoryboardScene;
    const newScene = structuredClone(semanticStoryboard.scenes[2]) as unknown as StoryboardScene;
    const overlap = 15;
    newScene.transitionIn = {type: 'overlap-slide', durationFrames: overlap};
    for (let local = 0; local < overlap; local += 1) {
      const oldOpacity = transitionStyle(oldScene, oldScene.durationFrames - overlap + local, overlap).opacity;
      const newOpacity = transitionStyle(newScene, local, 0).opacity;
      expect(Number(oldOpacity) + Number(newOpacity)).toBe(1);
    }
  });

});
