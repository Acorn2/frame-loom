import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {describe, expect, it} from 'vitest';
import {SHOT_CATALOG, LEGACY_SHOT_CATALOG, resolveShot} from '../src/shots/catalog.ts';
import {SHOT_RENDERERS} from '../src/shots/renderer-registry.tsx';
import {SHOT_RENDERERS as OLD_RENDERERS} from '../src/shots/legacy-v1/renderer-registry.tsx';
import {compileStoryboardShots} from '../src/shots/compile-shot.ts';
import {StoryboardSchema} from '../src/schemas/storyboard.ts';
import {resolveProductionLock} from '../scripts/lib/production-lock.mjs';
import {beatProgress, beatSpring, curves, fanPose, cubicPoint} from '../src/shots/motion.ts';
import {sceneAuxiliaries} from '../src/shots/auxiliary-catalog.ts';
import {proposeAudioTiming} from '../src/audio/retime.ts';

const read = id => JSON.parse(fs.readFileSync(`examples/shot-recipes/${id}/storyboard.json`, 'utf8'));
describe('recipe motion version compatibility', () => {
  it('keeps all 21 old recipes resolvable and all three native renderers unchanged', () => {
    expect(LEGACY_SHOT_CATALOG).toHaveLength(21);
    for (const entry of LEGACY_SHOT_CATALOG) {
      expect(resolveShot(entry.id, '1.0.0')).toEqual(entry);
      expect(resolveShot(entry.id, '1.1.0').version).toBe('1.1.0');
      expect(SHOT_RENDERERS[entry.id]).not.toBe(OLD_RENDERERS[entry.id]);
    }
    for (const id of ['semantic-default', 'compare-reveal', 'network-expand']) {
      expect(SHOT_CATALOG.find(item => item.id === id).version).toBe('1.0.0');
      expect(() => resolveShot(id, '1.1.0')).toThrow();
    }
    expect(() => resolveShot('card-stack', '1.3.0')).toThrow();
  });
  it('binds historical scene and auxiliary manifests without silently upgrading a production lock', () => {
    const current = read('blur-slide');
    const old = structuredClone(current);
    if (old.shotRecipes) old.shotRecipes[0].version = '1.0.0'; old.scenes[0].shot.version = '1.0.0';
    delete old.videoTemplate;
    const oldLock = resolveProductionLock(old).lock;
    const history = path.resolve('shots/blur-slide/history/1.0.0.manifest.json');
    expect(oldLock.shots[0].manifestHash).toBe(createHash('sha256').update(fs.readFileSync(history)).digest('hex'));
    expect(sceneAuxiliaries(StoryboardSchema.parse(old).scenes[0])[0].version).toBe('1.0.0');
    expect(sceneAuxiliaries(StoryboardSchema.parse(current).scenes[0])[0].version).toBe('1.2.0');
    expect(oldLock.shots[0].version).toBe('1.0.0');
    expect(resolveProductionLock(current).lock.hash).not.toBe(oldLock.hash);
  });
  it('allows overlapping title handoff only in the new version, and still rejects premature body entry', () => {
    const current = read('title-to-label');
    expect(compileStoryboardShots(StoryboardSchema.parse(current))).toHaveLength(1);
    const old = structuredClone(current);
    if (old.shotRecipes) old.shotRecipes[0].version = '1.0.0'; old.scenes[0].shot.version = '1.0.0';
    delete old.videoTemplate;
    expect(() => compileStoryboardShots(StoryboardSchema.parse(old))).toThrow(/让位/);
    const demote = current.scenes[0].beats.find(item => item.action === 'demote');
    current.scenes[0].beats.find(item => current.scenes[0].shot.slots.items.includes(item.target)).start = demote.start;
    expect(() => compileStoryboardShots(StoryboardSchema.parse(current))).toThrow(/让位/);
  });
  it('finishes new convergence paths before carrier motion, including after measured audio retiming', () => {
    const board = read('source-converge');
    const overlap = structuredClone(board);
    overlap.scenes[0].beats.find(beat => beat.target === 'result').start -= 6;
    expect(() => compileStoryboardShots(StoryboardSchema.parse(overlap))).toThrow(/载体/);
    overlap.shotRecipes[0].version = '1.0.0';
    overlap.scenes[0].shot.version = '1.0.0';
    expect(compileStoryboardShots(StoryboardSchema.parse(overlap))).toHaveLength(1);
    const retimed = proposeAudioTiming(StoryboardSchema.parse(board), [{sceneId: 'source-converge', durationSec: 6.123}]);
    const beats = retimed.scenes[0].beats;
    const merge = beats.find(beat => beat.target === 'result');
    for (const draw of beats.filter(beat => beat.action === 'draw')) expect(draw.start + draw.duration).toBeLessThanOrEqual(merge.start);
  });
});
describe('distinct deterministic motion stages', () => {
  const plan = {actions: [{target: 'item', action: 'enter', start: 20, duration: 30}]};
  it('retains fan depth and a readable, symmetric spread instead of flattening into a row', () => {
    const poses = Array.from({length: 4}, (_, i) => fanPose(i, 4, 1));
    expect(poses[0].x).toBe(-poses[3].x);
    expect(poses[0].rotation).toBe(-poses[3].rotation);
    expect(poses[0].z).toBeLessThan(poses[1].z);
    expect(poses[1].order).toBeGreaterThan(poses[0].order);
    for (const key of ['x', 'rotation', 'z']) expect(fanPose(0, 4, 0)[key]).toBeCloseTo(0);
  });
  it('uses a curved trajectory that reaches the same source and destination as the drawn connection', () => {
    expect(cubicPoint(0, 310, 70, 680, 255)).toEqual({x: 310, y: 70});
    expect(cubicPoint(1, 310, 70, 680, 255)).toEqual({x: 680, y: 255});
    const quarter = cubicPoint(.25, 310, 70, 680, 255);
    expect(quarter.y).not.toBeCloseTo(70 + (255 - 70) * .25);
    expect(quarter.x).toBeGreaterThan(310); expect(quarter.x).toBeLessThan(680);
  });
  it.each([24, 30, 60])('can seek in arbitrary order at %i fps and stops all stage motion at the action end', fps => {
    const frames = [0, 20, 23, 35, 49, 50, 80];
    const sample = frame => [beatSpring(plan, 'item', frame, fps), ...Object.values(curves).map(ease => beatProgress(plan, 'item', ['enter'], frame, ease))];
    const expected = new Map(frames.map(frame => [frame, sample(frame)]));
    for (const frame of [...frames].reverse()) expect(sample(frame)).toEqual(expected.get(frame));
    for (const frame of [50, 80]) for (const value of sample(frame)) expect(value).toBeCloseTo(1);
  });
});
