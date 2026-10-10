import fs from 'node:fs';
import {describe, expect, it} from 'vitest';
import {StoryboardSchema} from '../src/schemas/storyboard.ts';
import {SHOT_CATALOG} from '../src/shots/catalog.ts';
import {compileStoryboardShots} from '../src/shots/compile-shot.ts';
import {actionProgress, actionWindowProgress} from '../src/shots/frame-state.ts';
import {hierarchyLayout} from '../src/shots/shortlist/relation-layout.ts';
import {AUXILIARY_CATALOG, sceneAuxiliaries} from '../src/shots/auxiliary-catalog.ts';
import {validateStoryboard} from '../src/validation/storyboard-validator.ts';
import {proposeAudioTiming} from '../src/audio/retime.ts';
import {checkAssetInput, checkVisualInput} from '../scripts/lib/preflight.mjs';
import {resolveProductionLock} from '../scripts/lib/production-lock.mjs';
import {listShots} from '../scripts/list-shots.mjs';

const ids = ['blur-slide', 'split-text-stagger', 'card-stack', 'concept-matrix', 'platform-hinge-rise', 'source-converge', 'diagram-cascade'];
const fixture = (id, file = 'storyboard.json') => JSON.parse(fs.readFileSync(`examples/shot-recipes/${id}/${file}`, 'utf8'));
const errors = (board) => validateStoryboard(board, {executionMode: 'fast'}).filter((issue) => issue.severity === 'error');

describe('selected upstream shortlist slice', () => {
  it('tracks all 48 candidates without counting native capabilities or unimplemented variants', () => {
    const entries = JSON.parse(fs.readFileSync('shots/shortlist-coverage.json')).candidates;
    expect(entries).toHaveLength(48);
    expect(new Set(entries.map((item) => item.number)).size).toBe(48);
    for (const [group, count] of [['A', 17], ['B', 17], ['C', 14]]) expect(entries.filter((item) => item.number.startsWith(group))).toHaveLength(count);
    expect(entries.filter((item) => item.status === 'registered-experimental').map((item) => item.number)).toEqual(['A', 'B', 'C'].flatMap(group => Array.from({length: group === 'C' ? 14 : 17}, (_, i) => `${group}${String(i + 1).padStart(2, '0')}`)));
    expect(entries.filter((item) => item.status === 'pending').every((item) => item.runtimeId === null)).toBe(true);
    expect(SHOT_CATALOG).toHaveLength(40);
    expect(AUXILIARY_CATALOG).toHaveLength(9);
  });
  it.each(ids)('accepts %s in an independent style and shot selection', (id) => {
    const board = fixture(id);
    expect(StoryboardSchema.safeParse(board).success).toBe(true);
    expect(board.videoTemplate).toBeUndefined();
    expect(errors(board)).toEqual([]);
    expect(checkAssetInput(`examples/shot-recipes/${id}/storyboard.json`)).toEqual([]);
    expect(checkVisualInput(board).textLayout.filter((issue) => issue.severity === 'error')).toEqual([]);
    const [plan] = compileStoryboardShots(board);
    expect(plan.stableEndFrame - plan.completeFrame).toBeGreaterThanOrEqual(24);
    const seek = [plan.completeFrame, 0, 47, 12, 178, 99];
    const snapshots = seek.map((frame) => board.scenes[0].layers.map((layer) => actionProgress(plan, layer.id, ['enter', 'reveal'], frame)));
    for (const [index, frame] of [...seek.entries()].reverse()) expect(board.scenes[0].layers.map((layer) => actionProgress(plan, layer.id, ['enter', 'reveal'], frame))).toEqual(snapshots[index]);
    expect(resolveProductionLock(board).lock.shots.map((shot) => shot.id)).toEqual([id]);
  });
  it('implements only declared matrix variants, rejects undeclared media variants', () => {
    const board = fixture('concept-matrix', 'wireframe.json');
    expect(errors(board)).toEqual([]);
    board.scenes[0].shot.variant = 'grid-wave-flip';
    expect(StoryboardSchema.safeParse(board).success).toBe(false);
  });
  it.each([
    ['source-converge', 'reversed convergence', (scene) => {scene.connections[0] = {...scene.connections[0], from: 'result', to: 'i0'};}],
    ['source-converge', 'no true source', (scene) => {delete scene.visual.source;}],
    ['source-converge', 'premature merge', (scene) => {scene.beats.find((beat) => beat.target === 'result').start = 0;}],
    ['source-converge', 'invisible edge label', (scene) => {scene.connections[0].label = 'hidden';}],
    ['diagram-cascade', 'cycle', (scene) => {scene.connections[0].from = 'i2';}],
    ['diagram-cascade', 'multiple parents', (scene) => {scene.connections.push({id: 'extra', from: 'i1', to: 'i2'});}],
    ['diagram-cascade', 'premature child', (scene) => {scene.beats.find((beat) => beat.target === 'i0').start = 0;}],
    ['diagram-cascade', 'phantom edge', (scene) => {scene.beats.find((beat) => beat.target === 'e0').start = 0;}],
    ['diagram-cascade', 'unbounded depth', (scene) => {scene.connections[3].from = 'i2';}],
    ['platform-hinge-rise', 'unread evidence', (scene) => {scene.beats.find((beat) => beat.target === 'result').start = 24;}],
    ['card-stack', 'missing unfold', (scene) => {scene.beats = scene.beats.filter((beat) => beat.action !== 'focus');}],
    ['card-stack', 'unfold before collection', (scene) => {scene.beats.find((beat) => beat.action === 'focus').start = 0;}],
    ['blur-slide', 'premature underline', (scene) => {scene.beats.find((beat) => beat.action === 'highlight').start = 0;}],
    ['blur-slide', 'wrong selected keyword', (scene) => {scene.shot.slots.emphasis = 'sub';}],
    ['split-text-stagger', 'unowned focus', (scene) => {scene.beats[0].action = 'focus';}]
  ])('rejects %s: %s', (id, _name, mutate) => {
    const board = fixture(id); mutate(board.scenes[0]); expect(errors(board).length).toBeGreaterThan(0);
  });
  it('checks actual card rectangles rather than bypassing all custom text layout', () => {
    const board = fixture('card-stack');
    for (const layer of board.scenes[0].layers) layer.text = 'W'.repeat(40);
    const [plan] = compileStoryboardShots(board);
    expect(plan).toBeDefined();
    board.project.width = 960; board.project.height = 540;
    // Explicit multiline text may fit the character budget while exceeding the rectangle.
    board.scenes[0].layers[0].text = '一\n'.repeat(19);
    expect(checkVisualInput(board).textLayout.some((issue) => issue.severity === 'error')).toBe(true);
  });
  it('keeps every hierarchy card inside the content rectangle with no overlapping siblings', () => {
    const positions = hierarchyLayout(fixture('diagram-cascade').scenes[0]);
    for (const box of positions.values()) {expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(1000); expect(box.y + box.height).toBeLessThanOrEqual(500);}
    const rows = new Map();
    for (const box of positions.values()) rows.set(box.y, [...(rows.get(box.y) ?? []), box]);
    for (const boxes of rows.values()) boxes.sort((a, b) => a.x - b.x).forEach((box, index) => {if (index) expect(box.x).toBeGreaterThan(boxes[index - 1].x + boxes[index - 1].width);});
  });
  it('binds hosted underline definitions, checkpoints and provenance separately from scene counts', () => {
    const board = fixture('blur-slide');
    expect(sceneAuxiliaries(board.scenes[0]).map((recipe) => recipe.id)).toEqual(['marker-underline']);
    expect(listShots(['--auxiliary'], {log: () => {}}).map((recipe) => recipe.id)).toEqual(['marker-underline', 'outline-trace', 'paper-tape', 'card-flip', 'scanline-annotate-focus', 'scan-bracket-sweep', 'line-boil', 'speed-ramp-freeze', 'mosaic-reframe']);
    expect(listShots(['--auxiliary', '--canvas', 'portrait'], {log: () => {}})).toEqual([]);
    expect(resolveProductionLock(board).lock.auxiliaries.map((recipe) => recipe.id)).toEqual(['marker-underline']);
    expect(compileStoryboardShots(board)[0].checkpoints.some((point) => point.id === 'p1-highlight-mid')).toBe(true);
    const plan = compileStoryboardShots(fixture('platform-hinge-rise'))[0];
    expect(plan.checkpoints.some((point) => point.id.endsWith('platform-ready'))).toBe(true);
    expect(actionWindowProgress(plan, 'i0', ['enter'], 0, 0, 0.25)).toBe(0);
    const enter = plan.actions.find(beat => beat.target === 'i0' && beat.action === 'enter');
    expect(actionWindowProgress(plan, 'i0', ['enter'], Math.ceil(enter.duration * .25), 0, 0.25)).toBe(1);
    expect(actionWindowProgress(plan, 'i0', ['enter'], Math.floor(enter.duration * .25), 0.25, 1)).toBe(0);
  });
  it.each([24, 30, 60])('retimes every added recipe at %i fps and refuses unreadably short narration', (fps) => {
    for (const id of ids) {
      const board = fixture(id);
      const ratio = fps / board.project.fps;
      board.project.fps = fps; board.project.durationFrames *= ratio;
      for (const scene of board.scenes) {scene.durationFrames *= ratio; for (const beat of scene.beats) {beat.start = Math.ceil(beat.start * ratio); beat.duration = Math.ceil(beat.duration * ratio);} for (const cue of scene.captions) cue.end *= ratio;}
      const before = JSON.stringify(board);
      const retimed = proposeAudioTiming(StoryboardSchema.parse(board), [{sceneId: id, durationSec: 6.123}]);
      expect(errors(retimed)).toEqual([]);
      expect(retimed.project.durationFrames / fps - 6.123).toBeLessThanOrEqual(0.5);
      expect(JSON.stringify(board)).toBe(before);
      expect(() => proposeAudioTiming(StoryboardSchema.parse(board), [{sceneId: id, durationSec: 0.5}])).toThrow();
    }
  });
});
