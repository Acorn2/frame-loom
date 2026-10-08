import fs from 'node:fs';
import {describe, expect, it} from 'vitest';
import {rowLandingFeedback} from '../src/shots/motion.ts';
import {SHOT_CATALOG} from '../src/shots/catalog.ts';

const fixture = id => JSON.parse(fs.readFileSync(`examples/shot-recipes/${id}/storyboard.json`, 'utf8'));
describe('P1 shot presentation', () => {
  it('gives every scene recipe its own demonstration topic and claim', () => {
    const scenes = SHOT_CATALOG.map(recipe => fixture(recipe.id).scenes[0]);
    expect(new Set(scenes.map(scene => scene.title)).size).toBe(scenes.length);
    expect(new Set(scenes.map(scene => scene.primaryClaim)).size).toBe(scenes.length);
    expect(scenes.every(scene => !JSON.stringify(scene).includes('内容与表达都能复核'))).toBe(true);
  });
  it('lets the platform evidence read without leaving a multi-second idle gap', () => {
    const scene = fixture('platform-hinge-rise').scenes[0];
    const evidenceEnd = Math.max(...scene.beats.filter(beat => scene.shot.slots.items.includes(beat.target)).map(beat => beat.start + beat.duration));
    const conclusion = scene.beats.find(beat => beat.target === scene.shot.slots.result);
    expect(conclusion.start - evidenceEnd).toBeGreaterThanOrEqual(9);
    expect(conclusion.start - evidenceEnd).toBeLessThanOrEqual(30);
  });
  it.each([24, 30, 60])('shows the row seam after touchdown, clears it, and supports backward seeks at %i fps', fps => {
    const start = fps; const duration = fps / 2;
    const plan = {actions: [{target: 'row', action: 'enter', start, duration}]};
    const land = start + duration;
    expect(rowLandingFeedback(plan, 'row', land - 1, fps).opacity).toBe(0);
    const growing = rowLandingFeedback(plan, 'row', land + Math.ceil(fps * .1), fps);
    expect(growing.opacity).toBeGreaterThan(0);
    expect(growing.spread).toBeGreaterThan(0);
    expect(growing.spread).toBeLessThanOrEqual(1);
    expect(rowLandingFeedback(plan, 'row', land + fps, fps).opacity).toBe(0);
    expect(rowLandingFeedback(plan, 'row', land + Math.ceil(fps * .1), fps)).toEqual(growing);
    expect(rowLandingFeedback(plan, 'missing', land, fps).opacity).toBe(0);
  });
});
