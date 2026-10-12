import fs from 'node:fs';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {StoryboardSchema} from '../src/schemas/storyboard.ts';
import {compileStoryboardShots} from '../src/shots/compile-shot.ts';
import {textLedPlacementAt} from '../src/shots/text-led/layout.ts';
import {checkStoryboardInput, checkVisualInput, checkAssetInput} from '../scripts/lib/preflight.mjs';
import {initProject} from '../scripts/init-project.mjs';
import {illustrationContext, prepareIllustrations} from '../scripts/lib/illustrations.mjs';
import {FONT_CATALOG} from '../src/fonts/catalog.ts';
const read = file => JSON.parse(fs.readFileSync(file));
const fixture = (style, study = false) => path.resolve(`examples/text-led-video/${style}/${study ? 'study-storyboard' : 'storyboard'}.json`);
const load = (style, study) => StoryboardSchema.parse(read(fixture(style, study)));
const compile = board => compileStoryboardShots(StoryboardSchema.parse(board));
const styles = ['annotated-reasoning', 'editorial-typography'];

describe('text-led production contracts', () => {
  it.each(styles)('%s supports both themes, public assets and every independent font', style => {
    for (const study of [false, true]) {
      const file = fixture(style, study), board = load(style, study);
      expect(checkAssetInput(file)).toEqual([]);
      for (const font of FONT_CATALOG) {
        board.font = {id: font.id, version: font.version};
        expect(checkStoryboardInput(board, {storyboardPath: file, styleRoot: path.resolve('styles'), executionMode: 'fast'}).filter(i => i.severity === 'error')).toEqual([]);
        const checks = checkVisualInput(board);
        expect([...checks.safeArea.issues, ...checks.textLayout].filter(i => i.severity === 'error')).toEqual([]);
      }
      const plans = compile(board);
      expect(plans[0].stableEndFrame - plans[0].completeFrame).toBeGreaterThanOrEqual(36);
    }
  });
  it('accepts original content and phrase bindings rather than episode-specific words', () => {
    const board = load('annotated-reasoning'), s = board.scenes[0], [id, mark] = Object.entries(s.shot.annotations)[0];
    const layer = s.layers.find(l => l.id === id);
    layer.label = layer.label.replace(mark.phrase, '线索'); mark.phrase = '线索';
    expect(compile(board)).toHaveLength(1);
    expect(compile(board)[0].shot.id).toBe('annotated-manuscript');
  });
  it.each([
    ['unknown phrase', s => {Object.values(s.shot.annotations)[0].phrase = '原文未提供';}],
    ['ambiguous phrase', s => {const [id, mark] = Object.entries(s.shot.annotations)[0]; s.layers.find(l => l.id === id).label = mark.phrase + mark.phrase;}],
    ['early highlight', s => {s.beats.find(b => b.action === 'highlight').start = 0;}],
    ['missing highlight', s => {s.beats = s.beats.filter(b => b.action !== 'highlight');}],
    ['oversized auxiliary', s => {const box = Object.values(s.shot.elements).find(e => e.kind === 'sticker'); box.width = 600; box.height = 300;}],
    ['brand collision', s => {Object.values(s.shot.elements)[0].width = 1650;}],
    ['caption collision', s => {Object.values(s.shot.elements)[0].y = 880;}],
    ['route beyond canvas', s => {Object.values(s.shot.routes)[0].points[0][0] = 30;}],
    ['early relation', s => {s.beats.find(b => b.action === 'draw').start = 0;}],
    ['hidden layer field', s => {s.layers[0].glyph = 'spark';}],
    ['hidden beat state', s => {s.beats[0].state = {value: 2};}],
    ['unbound element', s => {s.shot.elements.extra = {...Object.values(s.shot.elements)[0]};}]
  ])('rejects %s in annotated reasoning', (_label, change) => {
    const board = load('annotated-reasoning'); change(board.scenes[0]); expect(() => compile(board)).toThrow();
  });
  it.each([
    ['missing placement', s => {delete s.shot.stages[0].placements[s.shot.slots.items[0]];}],
    ['unknown trigger', s => {s.shot.stages[0].trigger = 'unknown';}],
    ['overlapping stages', s => {const beat = s.beats.find(b => b.id === s.shot.stages[1].trigger); beat.start = s.beats.find(b => b.id === s.shot.stages[0].trigger).start;}],
    ['hidden focus', s => {const b = s.beats.find(b => b.id === s.shot.stages[0].trigger); s.shot.stages[0].placements[b.target].opacity = 0;}],
    ['unknown relation stage', s => {Object.values(s.shot.routes)[0].stage = 6;}],
    ['relation before stage settles', s => {s.beats.find(b => b.action === 'draw').start = 420;}],
    ['unimplemented stage field', s => {s.shot.stages[0].rotation = 20;}]
  ])('rejects %s in editorial typography', (_label, change) => {
    const board = load('editorial-typography'); change(board.scenes[0]); expect(() => compile(board)).toThrow();
  });
  it('retains text identity and interpolates from the previous completed placement', () => {
    const s = load('editorial-typography').scenes[0], shot = s.shot, beat = s.beats.find(b => b.id === shot.stages[0].trigger);
    const moving = shot.slots.items.find(id => shot.elements[id].opacity === 1 && shot.stages[0].placements[id].opacity === 1 && shot.elements[id].x !== shot.stages[0].placements[id].x);
    const initial = shot.elements[moving], end = shot.stages[0].placements[moving], mid = textLedPlacementAt(s, shot, moving, beat.start + beat.duration / 2);
    expect(mid.x).toBeCloseTo((initial.x + end.x) / 2); expect(mid.opacity).toBe(1);
    expect(textLedPlacementAt(s, shot, moving, beat.start + beat.duration)).toEqual(end);
    const incoming = shot.slots.items.find(id => shot.elements[id].opacity === 0 && shot.stages[0].placements[id].opacity === 1);
    expect(textLedPlacementAt(s, shot, incoming, beat.start + beat.duration / 2).opacity).toBe(0);
    expect(textLedPlacementAt(s, shot, incoming, beat.start + beat.duration).opacity).toBe(1);
  });
  it.each(styles)('%s initializes a fixed workflow and genuine generation policy', style => {
    const root = path.resolve('.tmp/text-led-rollout/init-tests'); fs.mkdirSync(root, {recursive: true});
    const target = initProject(['--slug', 'text-led-contract', '--style', style, '--input-mode', 'document', '--projects-dir', root]);
    const board = read(path.join(target, 'storyboard.draft.json'));
    expect(board.scenes).toEqual([]); expect(board.shotRecipes.map(s => s.id)).toEqual([style === styles[0] ? 'annotated-manuscript' : 'editorial-flow', 'semantic-default']);
    expect(read(path.join(target, 'project-input.json')).illustrationPolicy).toBe('generated-subjects-v1');
    const planFile = path.join(target, 'illustration-plan.json'), plan = read(planFile);
    plan.assets = [{id: 'auxiliary', path: 'assets/auxiliary.png', subject: 'A researcher checking a source document', sourceClaim: '先核对来源', purpose: 'Small auxiliary illustration beside native text'}];
    fs.writeFileSync(planFile, JSON.stringify(plan));
    expect(prepareIllustrations(target)).toContain('illustration-prompts.json');
    const context = illustrationContext(target);
    expect(context.guide.style.id).toBe(style); expect(context.prompts[0].prompt).toContain('No text');
    expect(fs.existsSync(path.join(target, 'assets/auxiliary.png'))).toBe(false);
  });
  it('keeps both historical styles independently renderable', () => {
    for (const style of ['flat-explainer', 'paper-collage']) expect(compile(read(path.resolve(`examples/illustrated-video/${style}/storyboard.json`)))).toHaveLength(6);
  });
});
