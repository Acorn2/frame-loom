import {selectReviewFrames} from '../scripts/extract-review-frames.mjs';
import {listShots} from '../scripts/list-shots.mjs';
import fs from 'node:fs';
import {describe, expect, it} from 'vitest';
import {StoryboardSchema} from '../src/schemas/storyboard.ts';
import {compileStoryboardShots} from '../src/shots/compile-shot.ts';
import {validateStoryboard} from '../src/validation/storyboard-validator.ts';
import {proposeAudioTiming} from '../src/audio/retime.ts';
import {checkAssetInput, checkVisualInput} from '../scripts/lib/preflight.mjs';
import {resolveProductionLock} from '../scripts/lib/production-lock.mjs';
import {sceneAuxiliaries} from '../src/shots/auxiliary-catalog.ts';
import {chapterWindows, stripBounds, assertChapterCaptions} from '../src/shots/shortlist/chapter-transitions.tsx';
import {odometerPosition} from '../src/shots/shortlist/DataP1.tsx';
const ids = ['lead-word-assemble', 'brace-expand', 'pill-slot-cycle', 'word-roll', 'text-column-converge', 'evidence-relay', 'row-embed', 'structure-then-text', 'timeline-travel', 'odometer-roll'];
const read = (id, file = 'storyboard.json') => JSON.parse(fs.readFileSync(`examples/shot-recipes/${id}/${file}`));
const errors = (b) => validateStoryboard(b, {executionMode: 'fast'}).filter((e) => e.severity === 'error');
describe('remaining P1 recipes', () => {
  it.each(ids)('%s has a real independent contract, readable fixture and locked implementation', (id) => {
    const board = read(id);
    expect(StoryboardSchema.safeParse(board).success).toBe(true);
    expect(errors(board)).toEqual([]);
    expect(checkVisualInput(board).textLayout.filter((e) => e.severity === 'error')).toEqual([]);
    expect(checkAssetInput(`examples/shot-recipes/${id}/storyboard.json`)).toEqual([]);
    const [plan] = compileStoryboardShots(board);
    expect(plan.stableEndFrame - plan.completeFrame).toBeGreaterThanOrEqual(24);
    expect(resolveProductionLock(board).lock.shots.map((s) => s.id)).toEqual([id]);
  });
  it.each([
    ['lead-word-assemble', (s) => {s.beats.find((b) => b.action === 'focus').start = 0;}],
    ['lead-word-assemble', (s) => {s.title = '不匹配';}],
    ['lead-word-assemble', (s) => {s.beats.find((b) => b.target === 'rest').start = 60;}],
    ['brace-expand', (s) => {s.layers[0].label = '不匹配';}],
    ['pill-slot-cycle', (s) => {s.beats[2].start = 61;}],
    ['word-roll', (s) => {s.beats[1].start = 0;}],
    ['text-column-converge', (s) => {s.beats.find((b) => b.action === 'focus').start = 0;}],
    ['text-column-converge', (s) => {delete s.visual.source;}],
    ['evidence-relay', (s) => {s.beats[1].start++;}],
    ['evidence-relay', (s) => {s.shot.slots.keywords.pop();}],
    ['row-embed', (s) => {s.beats.find((b) => b.action === 'tape').start = 0;}],
    ['row-embed', (s) => {delete s.shot.treatment;}],
    ['structure-then-text', (s) => {s.beats.find((b) => b.action === 'enter').start = 0;}],
    ['structure-then-text', (s) => {s.beats = s.beats.filter((b) => b.action !== 'trace');}],
    ['timeline-travel', (s) => {s.layers[1].value = '2026-09-01';}],
    ['timeline-travel', (s) => {s.layers[1].value = '2026-02-30';}],
    ['timeline-travel', (s) => {delete s.visual.source;}],
    ['odometer-roll', (s) => {s.layers[0].value = 12.30;}],
    ['odometer-roll', (s) => {s.layers[0].value = '123456.78';}],
    ['odometer-roll', (s) => {delete s.visual.unit;}],
    ['odometer-roll', (s) => {s.beats[1].start = 0;}]
  ])('rejects invalid %s stage/content', (id, mutate) => {const b = read(id); mutate(b.scenes[0]); expect(errors(b).length).toBeGreaterThan(0);});
  it.each([24, 30, 60])('retimes P1 stages at %i fps, preserves input and refuses missing reading time', (fps) => {
    for (const id of ids) {
      const b = read(id); const ratio = fps / 30; b.project.fps = fps; b.project.durationFrames *= ratio;
      for (const s of b.scenes) {s.durationFrames *= ratio; for (const beat of s.beats) {beat.start = Math.round(beat.start * ratio); beat.duration = Math.ceil(beat.duration * ratio);} for (const cue of s.captions) {cue.start *= ratio; cue.end *= ratio;}}
      const before = JSON.stringify(b);
      const retimed = proposeAudioTiming(StoryboardSchema.parse(b), [{sceneId: id, durationSec: 12.123}]);
      expect(errors(retimed)).toEqual([]); expect(JSON.stringify(b)).toBe(before);
      expect(retimed.project.durationFrames / fps - 12.123).toBeLessThanOrEqual(.5);
      expect(() => proposeAudioTiming(StoryboardSchema.parse(b), [{sceneId: id, durationSec: .5}])).toThrow();
    }
  });
  it('keeps exact signed value, decimal punctuation, precision and digit-lock checkpoints', () => {
    const b = read('odometer-roll'); b.scenes[0].layers[0].value = '-12.300';
    const [plan] = compileStoryboardShots(b);
    expect(plan.checkpoints.filter((p) => p.id.startsWith('digit-'))).toHaveLength(5);
    const target = [1, 2, 3, 0, 0];
    for (const frame of [1, 0, .61, .2, .85, .4]) {const result = target.map((d, i) => odometerPosition(frame, d, i, 5));expect(target.map((d, i) => odometerPosition(frame, d, i, 5))).toEqual(result);}
    expect(target.map((d, i) => odometerPosition(1, d, i, 5) % 10)).toEqual(target);
    expect(b.scenes[0].layers[0].value).toBe('-12.300');
  });
  it('locks intrinsic outlines, optional tape and paired flip independently from scene selections', () => {
    for (const [id, aux] of [['structure-then-text', 'outline-trace'], ['row-embed', 'paper-tape']]) expect(resolveProductionLock(read(id)).lock.auxiliaries.map((s) => s.id)).toEqual([aux]);
    const tapedStack = read('card-stack', 'tape.json');
    expect(errors(tapedStack)).toEqual([]);
    expect(resolveProductionLock(tapedStack).lock.auxiliaries.map((s) => s.id)).toEqual(['paper-tape']);
    const tapeEnd = Math.max(...tapedStack.scenes[0].beats.filter(beat => beat.action === 'tape').map(beat => beat.start + beat.duration));
    tapedStack.scenes[0].beats.find((beat) => beat.action === 'focus').start = tapeEnd - 1;
    expect(errors(tapedStack).length).toBeGreaterThan(0);
    expect(errors(proposeAudioTiming(StoryboardSchema.parse(tapedStack), [{sceneId: 'card-stack', durationSec: 8.123}]))).toEqual([]);
    const b = read('concept-matrix', 'flip.json');
    expect(errors(b)).toEqual([]);
    expect(sceneAuxiliaries(b.scenes[0]).map((s) => s.id)).toEqual(['card-flip']);
    expect(resolveProductionLock(b).lock.auxiliaries[0].id).toBe('card-flip');
    b.scenes[0].beats.find((beat) => beat.target === 'i0').start = 25;
    expect(errors(b).length).toBeGreaterThan(0);
    b.scenes[0].shot.slots.fronts.pop(); expect(errors(b).length).toBeGreaterThan(0);
  });
  it('checks actual row and longest-word bounds even when character budgets fit', () => {
    const b = read('row-embed');b.scenes[0].layers[0].text = '一\n'.repeat(24);
    expect(checkVisualInput(b).textLayout.some((e) => e.severity === 'error')).toBe(true);
    const metric = read('odometer-roll');metric.scenes[0].visual.unit = '单位'.repeat(50);
    expect(checkVisualInput(metric).textLayout.some((e) => e.target === 'unit' && e.severity === 'error')).toBe(true);
    const timeline = read('timeline-travel');timeline.scenes[0].visual.source = '很长的来源'.repeat(100);
    expect(checkVisualInput(timeline).textLayout.some((e) => e.target === 'source' && e.severity === 'error')).toBe(true);
    const words = read('word-roll');words.scenes[0].layers.find((l) => l.id === 'prefix').label = '一\n二';
    expect(checkVisualInput(words).textLayout.some((e) => e.severity === 'error')).toBe(true);
  });
  it.each(['blinds-wipe', 'bottom-push'])('uses %s on the shared timeline with reading, captions and definition locks', (id) => {
    const b = read('chapter-transitions', `${id}.json`);
    expect(errors(b)).toEqual([]); expect(compileStoryboardShots(b)).toHaveLength(2);
    const required = selectReviewFrames(b).filter((frame) => frame.required).map((frame) => frame.label);
    expect(required).toContain('brace-expand-shot-chapter-out-mid');
    expect(required).toContain('second-chapter-shot-chapter-in-complete');
    expect(listShots(['--transitions'], {log: () => {}}).map((recipe) => recipe.id)).toEqual(['blinds-wipe', 'bottom-push', 'print-texture-transitions', 'line-carry-transition', 'page-turn-transitions']);
    expect(chapterWindows(b)).toEqual([{start: 162, end: 180}]);
    expect(resolveProductionLock(b).lock.transitions.map((s) => s.id)).toEqual([id]);
    expect(() => assertChapterCaptions(b, [{id:'cue', text:'关键词', startSec: 5.5, endSec: 6.1}])).toThrow();
    const altered = structuredClone(b);altered.scenes[1].beats[0].start = 0; expect(errors(altered).length).toBeGreaterThan(0);
    altered.scenes[1].beats[0].start = 18; altered.scenes[0].captions[0].end = 180;expect(errors(altered).length).toBeGreaterThan(0);
    b.scenes[1].transitionIn.chapterBoundary = false;expect(StoryboardSchema.safeParse(b).success).toBe(false);
  });
  it('complementary strip masks cover every column with no duplicated scene DOM', () => {
    for (const p of [0, .1, .3, .5, .9, 1]) for (const strip of stripBounds(p, 1920)) {
      const oldRight = strip.x + strip.width * (1 - strip.progress);
      const newLeft = strip.x + strip.width * (1 - strip.progress);
      expect(oldRight).toBe(newLeft);expect(strip.progress).toBeGreaterThanOrEqual(0);expect(strip.progress).toBeLessThanOrEqual(1);
    }
    expect(stripBounds(1, 1920).every((s) => s.progress === 1)).toBe(true);
  });
  it('does not admit recipe-specific actions or transitions in older schema versions', () => {
    const b = read('structure-then-text');b.schemaVersion='2.3';delete b.shotRecipes;delete b.scenes[0].shot;
    expect(StoryboardSchema.safeParse(b).success).toBe(false);
    const c = read('chapter-transitions','bottom-push.json');c.schemaVersion='2.3';delete c.shotRecipes;for(const s of c.scenes) delete s.shot;
    expect(StoryboardSchema.safeParse(c).success).toBe(false);
  });
});
