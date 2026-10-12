import fs from 'node:fs';
import path from 'node:path';
import {afterAll, describe, expect, it} from 'vitest';
import {IllustrationPlanSchema} from '../src/schemas/illustration.ts';
import {ILLUSTRATED_IDS} from '../src/shots/illustrated/schema.ts';
import {compileStoryboardShots} from '../src/shots/compile-shot.ts';
import {FONT_CATALOG} from '../src/fonts/catalog.ts';
import {checkStoryboardInput, checkVisualInput} from '../scripts/lib/preflight.mjs';
import {validateAssets} from '../scripts/validate-assets.mjs';
import {illustrationContext, prepareIllustrations, registerIllustration, localFile, inspectIllustration} from '../scripts/lib/illustrations.mjs';
import {fingerprintProjectInputs} from '../scripts/lib/input-fingerprint.mjs';
import {storyboardApprovalFingerprint} from '../scripts/lib/storyboard-approval.mjs';
import {initProject} from '../scripts/init-project.mjs';
import {illustratedProgress, pixelRevealBlocks, pixelEmphasisOpacity} from '../src/shots/illustrated/motion.ts';
import {illustratedLayout, illustrationTextBox, illustratedConnection} from '../src/shots/illustrated/layout.ts';
import {overlaps} from '../src/layout/scene-layout.ts';
const fixture = (style, id = 'storyboard') => path.resolve(`examples/illustrated-video/${style}/${id}.json`);
const read = file => JSON.parse(fs.readFileSync(file));
fs.mkdirSync('.tmp/illustrated-tests', {recursive: true});
const directories = [];
const copy = () => {const dir = fs.mkdtempSync(path.resolve('.tmp/illustrated-tests/case-')); directories.push(dir); fs.cpSync(path.dirname(fixture('flat-explainer')), dir, {recursive: true}); return dir;};
const save = (dir, name, value) => fs.writeFileSync(path.join(dir, name), JSON.stringify(value));
afterAll(() => {for (const dir of directories) fs.rmSync(dir, {recursive: true});});
describe('illustrated production', () => {
  it.each(['flat-explainer', 'paper-collage'])('%s keeps maximum slot counts inside the canvas with readable text and disjoint nodes', style => {
    for (const [id, counts] of [['illustrated-hero', [1]], ['illustrated-compare', [2]], ['illustrated-process', [2, 3, 4]], ['illustrated-explain', [2, 3]], ['illustrated-breakdown', [2, 3, 4]], ['illustrated-metric', [1, 2, 3]]]) {
      for (const count of counts) {
        const shot = structuredClone(read(fixture(style, id)).scenes[0].shot);
        shot.slots.items = Array.from({length: count}, (_, i) => `item-${i}`);
        const rects = illustratedLayout(shot, 1700, 539, style), values = [...rects.values()];
        for (const [layer, rect] of rects) {
          expect(rect.x).toBeGreaterThanOrEqual(0); expect(rect.y).toBeGreaterThanOrEqual(0);
          expect(rect.x + rect.width).toBeLessThanOrEqual(1700); expect(rect.y + rect.height).toBeLessThanOrEqual(539);
          const box = illustrationTextBox(shot, layer, rect, style), subject = layer === shot.slots.subject;
          const textHeight = box.label * 1.25 + (subject ? 0 : id === 'illustrated-metric' ? box.metricFont * 1.1 + 12 : box.gap + box.text * 1.35);
          expect(box.width, `${style}/${id}/${count}/${layer}`).toBeGreaterThan(100);
          expect(box.height, `${style}/${id}/${count}/${layer}`).toBeGreaterThanOrEqual(textHeight);
        }
        for (let i = 0; i < values.length; i++) for (let j = i + 1; j < values.length; j++) expect(overlaps(values[i], values[j]), `${style}/${id}/${count}`).toBe(false);
      }
    }
  });
  it('gives the same semantic inputs different structures and routes vertical pixel relations outside readable rows', () => {
    for (const id of ILLUSTRATED_IDS) {
      const shot = read(fixture('flat-explainer', id)).scenes[0].shot;
      expect([...illustratedLayout(shot, 1700, 539, 'flat-explainer')]).not.toEqual([...illustratedLayout(shot, 1700, 539, 'paper-collage')]);
    }
    const shot = read(fixture('paper-collage', 'illustrated-process')).scenes[0].shot;
    const rects = illustratedLayout(shot, 1700, 539, 'paper-collage');
    const a = rects.get(shot.slots.items[0]), b = rects.get(shot.slots.items[1]);
    expect(a.y + a.height).toBeLessThan(b.y);
    const connection = illustratedConnection(a, b, true);
    expect(connection.x).toBeLessThan(b.x); expect(connection.y).toBeGreaterThan(b.y);
    expect(connection.y).toBeLessThan(b.y + b.height); expect(connection.angle).toBe(0);
  });
  it.each(['flat-explainer', 'paper-collage'])('%s routes far-column branches around both rows without crossing intermediate content', style => {
    const shot = structuredClone(read(fixture(style, 'illustrated-breakdown')).scenes[0].shot);
    shot.slots.items = ['a', 'b', 'c', 'd'];
    const rects = illustratedLayout(shot, 1700, 539, style);
    const subject = rects.get(shot.slots.subject);
    for (const id of ['b', 'd']) {
      const target = rects.get(id), link = illustratedConnection(subject, target, style === 'paper-collage', [...rects.values()]);
      expect(link.x).toBeGreaterThan(target.x + target.width); expect(link.x).toBeLessThan(1700);
      expect(link.y).toBeGreaterThan(target.y); expect(link.y).toBeLessThan(target.y + target.height);
      expect(link.angle).toBe(Math.PI);
    }
  });
  it('reveals pixel subjects in deterministic blocks, flashes once and settles exactly', () => {
    expect(illustratedProgress(14, 12, 30, 'paper-collage')).toBeCloseTo(2 / 30);
    expect(illustratedProgress(15, 12, 30, 'paper-collage')).toBe(.1);
    expect(illustratedProgress(14, 12, 30, 'flat-explainer')).toBeCloseTo(2 / 30);
    expect(pixelRevealBlocks(0)).toEqual([]);
    const partial = pixelRevealBlocks(.45), complete = pixelRevealBlocks(1);
    expect(partial.length).toBeGreaterThan(0);
    expect(partial.length).toBeLessThan(complete.length);
    expect(complete).toHaveLength(96);
    expect(pixelRevealBlocks(.45)).toEqual(partial);
    const portraitBlocks = pixelRevealBlocks(1, .75);
    expect(portraitBlocks).toHaveLength(192);
    expect(portraitBlocks[0].width * 120).toBeCloseTo(portraitBlocks[0].height * 160);
    expect(partial.every(block => complete.some(full => JSON.stringify(full) === JSON.stringify(block)))).toBe(true);
    expect(pixelEmphasisOpacity(0)).toBe(0);
    expect(pixelEmphasisOpacity(.5)).toBe(1);
    expect(pixelEmphasisOpacity(1)).toBe(0);
    expect(pixelEmphasisOpacity(2)).toBe(0);
    for (const style of ['flat-explainer', 'paper-collage']) {
      expect(illustratedProgress(0, 12, 31, style)).toBe(0);
      expect(illustratedProgress(43, 12, 31, style)).toBe(1);
      expect(illustratedProgress(100, 12, 31, style)).toBe(1);
    }
  });
  it.each(['whiteboard', 'flat-explainer', 'paper-collage'])('%s supports six recipes and every independent font with actual registered images', style => {
    for (const id of ILLUSTRATED_IDS) {
      const file = fixture(style, id), board = read(file);
      expect(validateAssets(file)).toEqual([]);
      for (const font of FONT_CATALOG) {
        board.font = {id: font.id, version: font.version};
        expect(checkStoryboardInput(board, {storyboardPath: file, styleRoot: path.resolve('styles'), executionMode: 'fast'}).filter(i => i.severity === 'error'), `${style}/${id}/${font.id}`).toEqual([]);
        const visual = checkVisualInput(board);
        expect([...visual.safeArea.issues, ...visual.textLayout].filter(i => i.severity === 'error')).toEqual([]);
      }
      expect(compileStoryboardShots(board)[0].stableEndFrame - compileStoryboardShots(board)[0].completeFrame).toBeGreaterThanOrEqual(36);
    }
  });
  it.each([
    ['illustrated-process', s => {s.connections[0].to = 'a';}, /关系/],
    ['illustrated-explain', s => {s.beats.find(b => b.action === 'draw').start = 0;}, /两端/],
    ['illustrated-hero', s => {s.layers[0].fit = 'cover';}, /完整/],
    ['illustrated-hero', s => {s.layers[1].glyph = 'spark';}, /隐藏/],
    ['illustrated-metric', s => {s.layers[1].value = -1;}, /数字/],
    ['illustrated-metric', s => {delete s.visual.source;}, /来源/],
    ['illustrated-metric', s => {delete s.visual.unit;}, /unit/],
    ['illustrated-metric', s => {s.beats = s.beats.filter(b => b.action !== 'count');}, /count/]
  ])('rejects unrealized fields, wrong relations and ungrounded metrics in %s', (id, mutate, error) => {
    const board = read(fixture('flat-explainer', id)); mutate(board.scenes[0]); expect(() => compileStoryboardShots(board)).toThrow(error);
  });
  it('rejects portrait and unsupported styles without fallback', () => {
    const board = read(fixture('flat-explainer', 'illustrated-hero'));
    board.style.id = 'retro-zine'; expect(() => compileStoryboardShots(board)).toThrow(/风格/);
    board.style.id = 'flat-explainer'; Object.assign(board.project, {width: 1080, height: 1920}); expect(() => compileStoryboardShots(board)).toThrow(/画幅/);
  });
  it('requires actual visible alpha and blocks paths outside the project', () => {
    expect(inspectIllustration('examples/illustrated-video/flat-explainer/assets/organizer.png').width).toBe(1536);
    expect(() => inspectIllustration('library/style-covers/retro-zine.png')).toThrow(/透明/);
    expect(() => localFile(path.dirname(fixture('flat-explainer')), '../foreign.png')).toThrow(/逃出/);
    const plan = read('examples/illustrated-video/flat-explainer/illustration-plan.json');
    plan.assets.push(plan.assets[0]); expect(IllustrationPlanSchema.safeParse(plan).success).toBe(false);
  });
  it('invalidates both source review and production when the plan changes, and detects replaced bytes', () => {
    const dir = copy(), file = path.join(dir, 'storyboard.json');
    const before = fingerprintProjectInputs(dir, path.resolve('styles'), undefined, undefined, {includeAudio: false});
    const approval = storyboardApprovalFingerprint(dir), plan = read(path.join(dir, 'illustration-plan.json'));
    plan.assets[0].subject += ' New outfit.'; save(dir, 'illustration-plan.json', plan);
    expect(validateAssets(file).some(issue => issue.includes('指纹'))).toBe(true);
    expect(fingerprintProjectInputs(dir, path.resolve('styles'), undefined, undefined, {includeAudio: false})).not.toBe(before);
    expect(storyboardApprovalFingerprint(dir)).not.toBe(approval);
    const changed = copy(); fs.appendFileSync(path.join(changed, read(path.join(changed, 'asset-manifest.json')).assets[0].path), 'changed');
    expect(validateAssets(path.join(changed, 'storyboard.json')).some(issue => issue.includes('字节'))).toBe(true);
  });
  it('keeps existing subjects valid when a new independent asset is planned', () => {
    const dir = copy(), plan = read(path.join(dir, 'illustration-plan.json'));
    plan.assets.push({...plan.assets[0], id: 'second-subject', path: 'assets/second-subject.png', subject: 'A second isolated subject'});
    save(dir, 'illustration-plan.json', plan);
    expect(validateAssets(path.join(dir, 'storyboard.json'))).toEqual([]);
  });
  it('rejects screenshot generation and stale prepared prompts, never overwrites registered assets', () => {
    const dir = copy(); save(dir, 'project-input.json', {schemaVersion: '1.0', inputMode: 'document-images'});
    expect(() => illustrationContext(dir)).toThrow(/截图/);
    expect(validateAssets(path.join(dir, 'storyboard.json')).some(issue => issue.includes('截图'))).toBe(true);
    const other = copy(), plan = read(path.join(other, 'illustration-plan.json')); plan.assets[0].subject += ' New character.'; save(other, 'illustration-plan.json', plan);
    expect(() => registerIllustration(other, 'organizer', 'examples/illustrated-video/flat-explainer/assets/organizer.png', 'test')).toThrow(/已改变/);
    prepareIllustrations(other);
    expect(() => registerIllustration(other, 'organizer', 'examples/illustrated-video/flat-explainer/assets/organizer.png', 'test')).toThrow(/覆盖/);
  });
  it('initializes a plan only for document input and never marks preparation as generation', () => {
    const root = fs.mkdtempSync(path.resolve('.tmp/illustrated-tests/init-')); directories.push(root);
    const document = initProject(['--slug','document','--style','paper-collage','--projects-dir',root]);
    expect(read(path.join(document, 'project-input.json')).illustrationPolicy).toBe('generated-subjects-v1');
    expect(read(path.join(document, 'asset-manifest.json')).assets).toEqual([]);
    expect(() => prepareIllustrations(document)).toThrow(/空计划/);
    const screenshots = initProject(['--slug','screenshots','--style','flat-explainer','--input-mode','document-images','--projects-dir',root]);
    expect(read(path.join(screenshots, 'project-input.json'))).not.toHaveProperty('illustrationPolicy');
    expect(fs.existsSync(path.join(screenshots, 'illustration-plan.json'))).toBe(false);
  });
});
