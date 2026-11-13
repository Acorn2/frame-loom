import fs from 'node:fs';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {StoryboardSchema} from '../src/schemas/storyboard.ts';
import {compileStoryboardShots} from '../src/shots/compile-shot.ts';
import {imageCropAt, imageProjection, projectedRegion, imageFrame} from '../src/shots/image-led/layout.ts';
import {checkStoryboardInput, checkAssetInput, checkVisualInput} from '../scripts/lib/preflight.mjs';
import {checkImageLedText} from '../scripts/lib/image-led-text-layout.mjs';
import {estimateTextLines} from '../scripts/lib/text-layout.mjs';
import {FONT_CATALOG} from '../src/fonts/catalog.ts';
import {illustrationContext, illustrationFiles, prepareIllustrations, inspectIllustration, hash} from '../scripts/lib/illustrations.mjs';
const read = file => JSON.parse(fs.readFileSync(file));
const file = id => path.resolve(`examples/shot-recipes/${id}/storyboard.json`);
const load = id => read(file(id));
const compile = b => compileStoryboardShots(StoryboardSchema.parse(b));
describe('image-led formal directions', () => {
  it.each(['label', 'text'])('rejects an over-wide %s even when the box could fit wrapped lines', field => {
    const board = load('annotated-image'), scene = board.scenes[0];
    const layer = scene.layers.find(l => l.id === 'summary');
    Object.assign(scene.shot.elements.summary, {width: 200, height: 200, fontSize: 24, bodySize: 24});
    layer.label = '观察细节'; layer[field] = '观察细节'.repeat(7);
    expect(compile(board)).toHaveLength(5);
    expect(checkImageLedText(scene, estimateTextLines).some(i => i.target === 'summary')).toBe(true);
  });
  it('accepts authored line breaks when every row and total height fit', () => {
    const scene = load('annotated-image').scenes[0], layer = scene.layers.find(l => l.id === 'summary');
    Object.assign(scene.shot.elements.summary, {width: 200, height: 200, fontSize: 24, bodySize: 24});
    layer.label = '观察细节\n比较差异'; layer.text = '再来提问\n说清细节';
    expect(checkImageLedText(scene, estimateTextLines)).toEqual([]);
  });
  it('does not reserve a body row when an optional text field is empty', () => {
    const scene = load('annotated-image').scenes[0], layer = scene.layers.find(l => l.id === 'summary');
    Object.assign(scene.shot.elements.summary, {width: 200, height: 40, fontSize: 24});
    layer.label = '观察'; layer.text = '';
    expect(checkImageLedText(scene, estimateTextLines)).toEqual([]);
  });
  it('measures schema-default font sizes before rejecting over-wide rows', () => {
    const scene = load('annotated-image').scenes[0], layer = scene.layers.find(l => l.id === 'summary'), e = scene.shot.elements.summary;
    Object.assign(e, {width: 200, height: 80}); delete e.fontSize; delete e.bodySize;
    layer.label = '观察细节'.repeat(3);
    expect(checkImageLedText(scene, estimateTextLines).some(i => i.target === 'summary')).toBe(true);
    layer.label = '观察细节';
    expect(checkImageLedText(scene, estimateTextLines)).toEqual([]);
  });
  it.each([{width: 1000, height: 1000}, {width: 1672, height: 941}, {width: 941, height: 1672}])('clips a %j source to the selected rectangle, including mismatched aspect ratios', size => {
    const viewport = {x: 110, y: 160, width: 1000, height: 700}, crop = {x: .25, y: .25, width: .5, height: .25};
    const {projection, clip} = imageFrame(size, viewport, crop);
    expect((clip.x - projection.x) / projection.width).toBeCloseTo(crop.x);
    expect((clip.y - projection.y) / projection.height).toBeCloseTo(crop.y);
    expect(clip.width / projection.width).toBeCloseTo(crop.width);
    expect(clip.height / projection.height).toBeCloseTo(crop.height);
    expect(clip.x).toBeGreaterThanOrEqual(viewport.x - .001);
    expect(clip.y).toBeGreaterThanOrEqual(viewport.y - .001);
    expect(clip.x + clip.width).toBeLessThanOrEqual(viewport.x + viewport.width + .001);
    expect(clip.y + clip.height).toBeLessThanOrEqual(viewport.y + viewport.height + .001);
    expect(clip.width * clip.height).toBeLessThan(viewport.width * viewport.height);
  });
  it.each(['annotated-image', 'scene-narrative'])('%s accepts source assets, five compositions and independent fonts', id => {
    const board = load(id);
    expect(checkAssetInput(file(id))).toEqual([]);
    expect(new Set(board.scenes.map(s => s.shot.composition)).size).toBe(5);
    for (const font of FONT_CATALOG) {
      board.font = {id: font.id, version: font.version};
      expect(checkStoryboardInput(board, {executionMode: 'fast', storyboardPath: file(id)}).filter(i => i.severity === 'error')).toEqual([]);
      const checks = checkVisualInput(board);
      expect([...checks.textLayout, ...checks.safeArea.issues].filter(i => i.severity === 'error')).toEqual([]);
    }
    expect(compile(board)).toHaveLength(5);
  });
  it.each(['annotated-image', 'scene-narrative'])('%s preserves a complete prompt and byte record for every imported asset', id => {
    const root = path.dirname(file(id)), manifest = read(path.join(root, 'asset-manifest.json'));
    const requests = read(path.join(root, 'source-imagegen-requests.json')).requests;
    const bytes = read(path.join(root, 'source-imagegen-bytes.json')).assets;
    for (const asset of manifest.assets) {
      expect(requests.some(r => r.id === asset.id)).toBe(true);
      expect(bytes.find(r => r.id === asset.id).sha256).toBe(hash(fs.readFileSync(path.join(root, asset.path))));
      expect(asset.generation).toBeUndefined();
      if (id === 'scene-narrative') for (const ref of requests.find(r => r.id === asset.id).references ?? []) expect(fs.existsSync(path.join(root, ref))).toBe(true);
    }
  });
  it('keeps identical full narration and captions across the two 30-second samples', () => {
    const a = load('annotated-image'), b = load('scene-narrative');
    expect(a.project.durationFrames).toBe(900);
    expect(b.scenes.map(s => [s.narration, s.captions])).toEqual(a.scenes.map(s => [s.narration, s.captions]));
  });
  it.each([
    ['unknown field', s => {s.shot.elements.picture.rotation = 4;}],
    ['outside source crop', s => {s.shot.focus[0].crop.x = .99;}],
    ['missing focus binding', s => {s.shot.focus[0].trigger = 'missing';}],
    ['camera before source', s => {s.beats.find(b => b.action === 'focus').start = 0;}],
    ['hidden layer state', s => {s.layers[0].state = {value: 2};}],
    ['overlapping slots', s => {s.shot.elements.edge.x = 150;}],
    ['missing source', s => {delete s.layers.find(l => l.type === 'object').asset;}],
    ['missing image', s => {s.shot.elements.picture.kind = 'text';}],
    ['hidden connection text', s => {s.connections[0].label = 'hidden';}],
    ['wrong annotation target', s => {s.connections[0].to = 'picture';}],
    ['clipped annotation region', s => {s.shot.annotations['edge-note'].region.x = .85;}],
    ['unknown version', s => {s.shot.version = '1.1.0';}],
    ['unimplemented media visual', s => {s.visual.mediaFocus = {x: 0, y: 0, width: 1, height: 1, start: 30, duration: 20, label: 'ignored'};}]
  ])('rejects %s', (_name, change) => {const b = load('annotated-image'); change(b.scenes[1]); expect(() => compile(b)).toThrow();});
  it('binds moving marks to the actual source transform across a crop stage', () => {
    const s = load('annotated-image').scenes[1], sh = s.shot, size = {width: 1536, height: 1024}, e = sh.elements.picture;
    const crop0 = imageCropAt(s, sh, 'picture', 0), crop1 = imageCropAt(s, sh, 'picture', 100);
    expect(crop0).not.toEqual(crop1);
    const projection = imageProjection(size, {...e, height: e.height - 34}, crop1);
    const region = sh.annotations['edge-note'].region, r = projectedRegion(projection, region);
    expect(r.x).toBeCloseTo(projection.x + region.x * projection.width);
    expect(r.width).toBeCloseTo(region.width * projection.width);
    expect(r.x).toBeGreaterThan(e.x); expect(r.y + r.height).toBeLessThan(e.y + e.height - 34);
  });
  it('retains old illustration guide hashes and chooses scene backgrounds only by explicit guide version', () => {
    const base = path.resolve('.tmp/image-led-tests');fs.mkdirSync(base, {recursive: true});
    const dir = fs.mkdtempSync(path.join(base, 'guide-'));
    const plan = {schemaVersion: '1.0', style: {id: 'editorial-typography', version: '1.0.0'}, assets: [{id: 'scene', path: 'assets/scene.png', subject: 'Two fictional people examining an object', purpose: 'A complete observation scene', sourceClaim: 'source.md'}]};
    fs.writeFileSync(path.join(dir, 'project-input.json'), JSON.stringify({schemaVersion: '1.0', inputMode: 'document', illustrationPolicy: 'generated-subjects-v1'}));
    const save = () => fs.writeFileSync(path.join(dir, 'illustration-plan.json'), JSON.stringify(plan));save();
    const old = illustrationContext(dir), guide = read('styles/editorial-typography/illustration.json');
    expect(old.planHash).toBe(hash(JSON.stringify({plan, guide})));
    expect(old.prompts[0].prompt).toContain('genuinely transparent background');
    const opaque = path.resolve('examples/shot-recipes/scene-narrative/assets/story-observe.png');
    expect(() => inspectIllustration(opaque)).toThrow(/透明背景/);
    plan.guideVersion = '2.0';save();prepareIllustrations(dir);
    const current = illustrationContext(dir);
    expect(current.guide.background).toBe('scene'); expect(current.prompts[0].prompt).toContain('complete illustrated scene');
    expect(current.planHash).not.toBe(old.planHash);
    expect(illustrationFiles(dir)).toContain(path.resolve('styles/editorial-typography/illustration.v2.json'));
    expect(inspectIllustration(opaque, {background: 'scene'}).width).toBe(1672);
    // Leave this small reproducible fixture under ignored .tmp; never clean unrelated workspace files.
  });
});
