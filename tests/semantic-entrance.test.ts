import {describe, expect, it} from 'vitest';
import fixture from '../examples/shot-recipes/semantic-default/storyboard.json' with {type: 'json'};
import {StoryboardSchema} from '../src/schemas/storyboard';
import {getDefaultStyleTokens} from '../src/styles/style-loader';
import {semanticTextProgress} from '../src/templates/semantic/SemanticScene';
import {compileStoryboardShots} from '../src/shots/compile-shot';

const board = StoryboardSchema.parse(fixture);
const tokens = getDefaultStyleTokens();
describe('basic recipe text entrances', () => {
  it.each([24, 30, 60])('animates a bare closing with the same timing at %i fps and supports backward seeks', fps => {
    const scene = {...board.scenes[1]!, durationFrames: fps * 4};
    const at = (seconds: number) => semanticTextProgress(scene, Math.round(seconds * fps), fps, tokens);
    expect(at(0)).toEqual({heading: 0, claim: 0});
    expect(at(.3).heading).toBeGreaterThan(0); expect(at(.3).heading).toBeLessThan(1);
    expect(at(.6)).toEqual({heading: 1, claim: 0});
    expect(at(.9).claim).toBeGreaterThan(0); expect(at(.9).claim).toBeLessThan(1);
    expect(at(1.2)).toEqual({heading: 1, claim: 1});
    expect(at(3)).toEqual(at(1.2)); expect(at(0)).toEqual({heading: 0, claim: 0});
  });
  it('reveals the conclusion after the diagram finishes, with a stable reading interval', () => {
    const scene = board.scenes[0]!;
    const end = Math.max(...scene.beats.map(beat => beat.start + beat.duration));
    expect(semanticTextProgress(scene, end, 30, tokens).claim).toBe(0);
    expect(semanticTextProgress(scene, end + 9, 30, tokens).claim).toBeGreaterThan(0);
    expect(semanticTextProgress(scene, end + 18, 30, tokens).claim).toBe(1);
    expect(scene.durationFrames - end - 18).toBeGreaterThanOrEqual(24);
  });
  it('samples the actual text animation and complete state in production QA', () => {
    const plans = compileStoryboardShots(board);
    expect(plans.map(plan => plan.completeFrame)).toEqual([144, 36]);
    for (const [index, plan] of plans.entries()) {
      const scene = board.scenes[index]!;
      const midpoint = plan.checkpoints.find(point => point.id === 'claim-mid')!;
      const progress = semanticTextProgress(scene, midpoint.frame, 30, tokens).claim;
      expect(progress).toBeGreaterThan(0); expect(progress).toBeLessThan(1);
      const complete = plan.checkpoints.find(point => point.id === 'complete')!;
      expect(semanticTextProgress(scene, complete.frame, 30, tokens)).toEqual({heading: 1, claim: 1});
    }
  });
  it('leaves enough conclusion reading time before an outgoing overlap', () => {
    const scene = {...board.scenes[0]!, durationFrames: 150};
    expect(semanticTextProgress(scene, 111, 30, tokens, 15).claim).toBe(1);
  });
  it('keeps specialized text stages and transition handoffs under their existing owners', () => {
    const scene = {...board.scenes[1]!, shot: {id: 'compare-reveal' as const, version: '1.0.0' as const, slots: {items: ['a', 'b']}}};
    expect(semanticTextProgress(scene, 0, 30, tokens)).toEqual({heading: 1, claim: 1});
    const incoming = {...board.scenes[1]!, transitionIn: {type: 'overlap-slide' as const, durationFrames: 15}};
    expect(semanticTextProgress(incoming, 0, 30, tokens).heading).toBe(1);
    expect(semanticTextProgress({...board.scenes[1]!, shot: undefined}, 0, 30, tokens)).toEqual({heading: .12, claim: 0});
  });
});
