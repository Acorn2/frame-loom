import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, describe, expect, it} from 'vitest';
import {StoryboardSchema} from '../src/schemas/storyboard';
import {compileStoryboardShots, compileShot} from '../src/shots/compile-shot';
import {actionProgress} from '../src/shots/frame-state';
import {validateStoryboard} from '../src/validation/storyboard-validator';
import {proposeAudioTiming} from '../src/audio/retime';
import {selectReviewFrames} from '../scripts/extract-review-frames.mjs';
import {checkVisualInput} from '../scripts/lib/preflight.mjs';
import {resolveProductionLock, writeProductionLock, assertProductionLock, productionDirectory, hashValue} from '../scripts/lib/production-lock.mjs';
import {writeRenderReceipt} from '../scripts/lib/render-receipt.mjs';
import {migrateStoryboard} from '../scripts/migrate-storyboard.mjs';
import {initProject} from '../scripts/init-project.mjs';
import {listShots} from '../scripts/list-shots.mjs';
import {checkDeliveryEligibility} from '../scripts/approve-delivery.mjs';
import {fingerprintProjectInputs} from '../scripts/lib/input-fingerprint.mjs';
import {renderToVerifiedOutput} from '../scripts/lib/verified-render-output.mjs';
import fixture from '../examples/video-templates/knowledge-notes/storyboard.json' with {type: 'json'};

const board = () => StoryboardSchema.parse(structuredClone(fixture));
const errors = (input) => validateStoryboard(input, {executionMode: 'fast', styleRoot: path.resolve('styles')}).filter((issue) => issue.severity === 'error');
const directories = [];
const temp = () => {const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-loom-shots-')); directories.push(directory); return directory;};
afterEach(() => {for (const directory of directories.splice(0)) fs.rmSync(directory, {recursive: true, force: true});});

describe('2.4 shot production contracts', () => {
  it('composes a chosen style and recipe pool without a video-template preset', () => {
    const publicSelection = JSON.parse(fs.readFileSync('examples/shot-selection/storyboard.json', 'utf8'));
    expect(publicSelection.videoTemplate).toBeUndefined();
    expect(errors(publicSelection)).toEqual([]);
    expect(checkVisualInput(publicSelection).textLayout.filter((issue) => issue.severity === 'error')).toEqual([]);
    const input = board();
    delete input.videoTemplate;
    input.shotRecipes = [{id: 'paper-title', version: '1.2.0'}, {id: 'list-reveal', version: '1.2.0'}];
    input.scenes = [input.scenes[0], input.scenes[3], {...structuredClone(input.scenes[3]), id: 'repeated-list'}];
    input.project.durationFrames = input.scenes.reduce((sum, scene) => sum + scene.durationFrames, 0);
    input.project.durationSec = input.project.durationFrames / input.project.fps;
    expect(errors(input)).toEqual([]);
    expect(compileStoryboardShots(input).map((plan) => plan.shot.id)).toEqual(['paper-title', 'list-reveal', 'list-reveal']);
    input.shotRecipes = [input.shotRecipes[0]];
    expect(errors(input).some((issue) => issue.path === 'shotRecipes')).toBe(true);
    expect(() => compileStoryboardShots(input)).toThrow(/用户选择/);
    expect(() => resolveProductionLock(input)).toThrow(/用户选择/);
  });
  it('validates every selected recipe even when it is not used by any scene', () => {
    const input = board(); delete input.videoTemplate;
    input.style.id = 'signal'; input.scenes = [input.scenes.at(-1)];
    input.project.durationFrames = input.scenes[0].durationFrames; input.project.durationSec = input.project.durationFrames / 30;
    input.shotRecipes = [{id: 'semantic-default', version: '1.0.0'}, {id: 'paper-title', version: '1.0.0'}];
    expect(() => compileStoryboardShots(input)).toThrow(/尚未适配风格/);
    input.shotRecipes = [input.shotRecipes[0]];
    expect(errors(input)).toEqual([]);
    const duplicate = structuredClone(input); duplicate.shotRecipes.push(duplicate.shotRecipes[0]);
    expect(StoryboardSchema.safeParse(duplicate).success).toBe(false);
    const legacy = structuredClone(input); legacy.schemaVersion = '2.3'; delete legacy.scenes[0].shot;
    expect(StoryboardSchema.safeParse(legacy).success).toBe(false);
  });
  it('lists actual recipe capabilities for style and canvas selection', () => {
    const log = () => {};
    expect(listShots(['--style', 'retro-zine', '--canvas', 'landscape'], {log})).toHaveLength(40);
    expect(listShots(['--style', 'signal', '--canvas', 'portrait'], {log}).map((shot) => shot.id)).toEqual(['type-and-filter', 'ai-stream-response', 'unit-dot-regroup', 'semantic-default']);
    expect(() => listShots(['--style', 'invented'], {log})).toThrow(/未知风格/);
    expect(() => listShots(['--canvas', 'square'], {log})).toThrow(/canvas/);
    expect(() => listShots(['--invented'], {log})).toThrow(/Usage/);
    const output = [];
    listShots(['--style', 'retro-zine', '--json'], {log: (text) => output.push(text)});
    expect(JSON.parse(output[0]).some((shot) => shot.id === 'document-conclusions' && shot.slots.items.max === 3)).toBe(true);
  });
  it('initializes a custom selection without silently adding fallback shots or rendering', () => {
    const directory = temp();
    const target = initProject(['--slug', 'custom', '--style', 'retro-zine', '--shots', 'paper-title,list-reveal', '--projects-dir', directory]);
    const draft = JSON.parse(fs.readFileSync(path.join(target, 'storyboard.draft.json'), 'utf8'));
    expect(draft.schemaVersion).toBe('2.4'); expect(draft.videoTemplate).toBeUndefined();
    expect(draft.shotRecipes.map((shot) => shot.id)).toEqual(['paper-title', 'list-reveal']);
    expect(draft.scenes).toEqual([]);
    expect(fs.readFileSync(path.join(target, 'shot-map.md'), 'utf8')).toContain('Selected recipe pool: paper-title@1.2.0, list-reveal@1.2.0');
    expect(fs.readdirSync(path.join(target, 'output'))).toEqual(['.gitkeep']);
    expect(() => initProject(['--slug', 'cross-style', '--style', 'signal', '--shots', 'paper-title,list-reveal', '--projects-dir', directory])).not.toThrow();
    expect(() => initProject(['--slug', 'wrong-canvas', '--shots', 'paper-title', '--canvas', 'portrait', '--projects-dir', directory])).toThrow(/画幅/);
    expect(() => initProject(['--slug', 'duplicates', '--shots', 'list-reveal,list-reveal', '--projects-dir', directory])).toThrow(/重复/);
    expect(() => initProject(['--slug', 'unknown', '--shots', 'invented', '--projects-dir', directory])).toThrow();
    expect(fs.readdirSync(directory)).toHaveLength(2);
  });
  it('accepts two independent sourced documents and all registered single shots', () => {
    for (const name of ['knowledge-notes', 'product-update']) {
      const input = JSON.parse(fs.readFileSync(`examples/video-templates/${name}/storyboard.json`, 'utf8'));
      expect(errors(input)).toEqual([]);
      expect(checkVisualInput(input).textLayout.filter((issue) => issue.severity === 'error')).toEqual([]);
      expect(compileStoryboardShots(input)).toHaveLength(7);
    }
    for (const id of ['paper-title', 'title-to-label', 'document-conclusions', 'list-reveal', 'compare-reveal', 'network-expand', 'semantic-default']) expect(errors(JSON.parse(fs.readFileSync(`examples/shot-recipes/${id}/storyboard.json`, 'utf8')))).toEqual([]);
  });
  it('preflights the rendered four-row list and maximum five-branch network fixtures', () => {
    for (const file of ['storyboard.json', 'network-five.json']) {
      const input = JSON.parse(fs.readFileSync(`examples/shot-recipes/boundaries/${file}`, 'utf8'));
      expect(errors(input)).toEqual([]);
      expect(checkVisualInput(input).textLayout.filter((issue) => issue.severity === 'error')).toEqual([]);
    }
  });
  it.each([
    ['unknown shot', (input) => {input.scenes[0].shot.id = 'invented';}],
    ['unknown version', (input) => {input.scenes[0].shot.version = 'latest';}],
    ['missing shot', (input) => {delete input.scenes[0].shot;}],
    ['old pattern', (input) => {input.scenes[2].visual.shotPattern = 'document-conclusion-deal';}],
    ['missing slot layer', (input) => {input.scenes[2].shot.slots.source = 'missing';}],
    ['wrong count', (input) => {input.scenes[2].shot.slots.items.pop();}],
    ['duplicate slot', (input) => {input.scenes[3].shot.slots.items[1] = input.scenes[3].shot.slots.items[0];}],
    ['missing source', (input) => {delete input.scenes[2].visual.source;}],
    ['reverse relation', (input) => {input.scenes[2].connections[0].from = 'i0';}],
    ['unsupported portrait', (input) => {input.project.width = 1080; input.project.height = 1920;}],
    ['unverified ratio', (input) => {input.project.width = input.project.height;}],
    ['style conflict', (input) => {input.style.id = 'scatterbrain';}],
    ['invisible media focus', (input) => {input.scenes[2].visual.mediaFocus = {x: 0, y: 0, width: 1, height: 1, start: 10, duration: 18, label: '不可执行'};}],
    ['wrong direction kind', (input) => {input.scenes[3].visual.networkDirection = 'inward';}],
    ['semantics conflict', (input) => {input.scenes[2].visual.kind = 'compare';}],
    ['long source', (input) => {input.scenes[2].layers[0].text = '文'.repeat(111);}],
    ['unallocated content', (input) => {input.scenes[3].layers.push({id: 'hidden', type: 'node', label: '隐藏内容', text: '不能被忽略'});}],
    ['hidden action', (input) => {input.scenes[3].beats[0].action = 'focus';}],
    ['dock before source', (input) => {input.scenes[2].beats.find((beat) => beat.action === 'dock').start = 0;}],
    ['missing dock', (input) => {input.scenes[2].beats = input.scenes[2].beats.filter((beat) => beat.action !== 'dock');}],
    ['demote before hold', (input) => {input.scenes[1].beats.find((beat) => beat.action === 'demote').start = 20;}],
    ['premature content', (input) => {input.scenes[1].beats.find((beat) => beat.target === 'i0').start = 0;}],
    ['short reading', (input) => {input.scenes[2].beats.at(-1).start = 280;}],
    ['title mismatch', (input) => {input.scenes[0].title = '不同的标题';}],
    ['unbounded CSS', (input) => {input.scenes[0].shot.slots.css = 'position:absolute';}]
  ])('rejects %s before rendering', (_name, mutate) => {const input = structuredClone(fixture); mutate(input); expect(errors(input).length).toBeGreaterThan(0);});
  it('keeps historic files on the old path and refuses new actions there', () => {
    for (const file of ['examples/article-video/storyboard.json', 'examples/template-families/storyboard.json', 'examples/video-templates/knowledge-notes/storyboard.legacy.json']) {
      const input = JSON.parse(fs.readFileSync(file, 'utf8'));
      expect(errors(input)).toEqual([]);
      expect(compileStoryboardShots(input)).toEqual([]);
    }
    const input = structuredClone(fixture); input.schemaVersion = '2.3';
    expect(StoryboardSchema.safeParse(input).success).toBe(false);
  });
  it.each([24, 30, 60])('uses bounded actions with short/long measured narration at %i fps', (fps) => {
    const input = board();
    const ratio = fps / input.project.fps;
    input.project.fps = fps;
    input.project.durationFrames *= ratio;
    for (const scene of input.scenes) {scene.durationFrames *= ratio; for (const beat of scene.beats) {beat.start *= ratio; beat.duration *= ratio;}}
    const before = JSON.stringify(input);
    const measured = input.scenes.map((scene) => ({sceneId: scene.id, durationSec: 15.123}));
    const result = proposeAudioTiming(input, measured);
    expect(errors(result)).toEqual([]);
    expect(result.project.status).toBe('generated');
    expect(JSON.stringify(input)).toBe(before);
    for (const scene of result.scenes) {
      expect(scene.durationFrames / fps - 15.123).toBeLessThanOrEqual(0.5);
      expect(scene.beats.every((beat) => beat.duration / fps <= 1.2)).toBe(true);
    }
    expect(() => proposeAudioTiming(input, input.scenes.map((scene) => ({sceneId: scene.id, durationSec: 0.5})))).toThrow(/预算|时间|超出/);
  });
  it('includes dock, demote and every action checkpoint in mandatory review evidence', () => {
    const input = board();
    const frames = selectReviewFrames(input);
    expect(frames.length).toBeGreaterThan(48);
    for (const plan of compileStoryboardShots(input)) for (const point of plan.checkpoints) expect(frames.find((frame) => frame.label === `${plan.sceneId}-shot-${point.id}`)?.required).toBe(true);
  });
  it('has repeatable random seek and reverse seek without mutable animation state', () => {
    const input = board();
    const plan = compileStoryboardShots(input)[2];
    const sample = [200, 0, 42, 84, 18, 130, 298];
    const expected = sample.map((frame) => actionProgress(plan, 'source', ['dock'], frame, 'smooth'));
    for (const [index, frame] of [...sample.entries()].reverse()) expect(actionProgress(plan, 'source', ['dock'], frame, 'smooth')).toBe(expected[index]);
    expect(compileStoryboardShots(input)[2]).toEqual(plan);
  });
  it('enforces item count and near-budget mixed Chinese/English content', () => {
    const input = board();
    const source = input.scenes[2].layers[0];
    source.text = '资料 v2.4 2026 '.repeat(6);
    expect(errors(input)).toEqual([]);
    for (const count of [2, 3, 4]) {
      const scene = structuredClone(input.scenes[3]);
      scene.layers = Array.from({length: count}, (_, i) => ({id: `item${i}`, type: 'node', label: '检查 v2.4', text: '条目边界：中文与 English 2026'}));
      scene.shot.slots.items = scene.layers.map((layer) => layer.id);
      scene.beats = scene.layers.map((layer, i) => ({id: layer.id, target: layer.id, action: 'enter', start: i * 38, duration: 18}));
      expect(() => compileShot(scene, {...input.project, style: input.style})).not.toThrow();
    }
  });
  it('binds selected definitions and code, keeps unused recipe documents out of the lock', () => {
    const directory = temp();
    for (const name of ['src', 'styles', 'shots', 'video-templates', 'scripts']) fs.cpSync(name, path.join(directory, name), {recursive: true});
    for (const name of ['package-lock.json', 'tsconfig.json']) fs.copyFileSync(name, path.join(directory, name));
    const input = board(); input.scenes = [input.scenes[0]]; input.project.durationFrames = input.scenes[0].durationFrames; input.project.durationSec = input.project.durationFrames / 30;
    const first = resolveProductionLock(input, directory).lock.hash;
    fs.appendFileSync(path.join(directory, 'shots/list-reveal/recipe.md'), '\nUnselected documentation');
    const unused = path.join(directory, 'shots/list-reveal/manifest.json');
    const manifest = JSON.parse(fs.readFileSync(unused, 'utf8')); manifest.purpose += ' extra'; fs.writeFileSync(unused, JSON.stringify(manifest));
    expect(resolveProductionLock(input, directory).lock.hash).toBe(first);
    input.shotRecipes = [{id: 'paper-title', version: '1.2.0'}, {id: 'list-reveal', version: '1.2.0'}];
    const poolHash = resolveProductionLock(input, directory).lock.hash;
    manifest.purpose += ' selected but unused'; fs.writeFileSync(unused, JSON.stringify(manifest));
    expect(resolveProductionLock(input, directory).lock.hash).not.toBe(poolHash);
    delete input.shotRecipes;
    const selected = path.join(directory, 'shots/paper-title/manifest.json');
    const selectedData = JSON.parse(fs.readFileSync(selected, 'utf8')); selectedData.purpose += ' changed'; fs.writeFileSync(selected, JSON.stringify(selectedData));
    expect(resolveProductionLock(input, directory).lock.hash).not.toBe(first);
    const second = resolveProductionLock(input, directory).lock.hash;
    fs.appendFileSync(path.join(directory, 'src/shots/frame-state.ts'), '\n// new implementation');
    expect(resolveProductionLock(input, directory).lock.hash).not.toBe(second);
    const third = resolveProductionLock(input, directory).lock.hash;
    const template = path.join(directory, 'video-templates/retro-zine-explainer/template.json');
    const templateData = JSON.parse(fs.readFileSync(template, 'utf8')); templateData.selectionRules[0].content += ' changed'; fs.writeFileSync(template, JSON.stringify(templateData));
    expect(resolveProductionLock(input, directory).lock.hash).not.toBe(third);
  });
  it('rejects a lock, derived plan or render receipt edited after render', () => {
    const input = board(); const directory = temp(); const video = path.join(directory, 'sample.mp4'); fs.writeFileSync(video, 'test bytes');
    const resolved = resolveProductionLock(input);
    const lock = writeProductionLock(input, productionDirectory(video));
    const profile = {purpose: 'visual-preview', productionLockHash: lock.hash, productionLock: lock, resolvedShotPlan: resolved.plans};
    writeRenderReceipt(video, profile);
    expect(assertProductionLock(input, video).hash).toBe(lock.hash);
    const planFile = path.join(productionDirectory(video), 'resolved-shot-plan.json');
    const plans = JSON.parse(fs.readFileSync(planFile, 'utf8')); plans[0].checkpoints[0].frame += 1; fs.writeFileSync(planFile, JSON.stringify(plans));
    expect(() => assertProductionLock(input, video)).toThrow(/不一致/);
    writeProductionLock(input, productionDirectory(video));
    fs.appendFileSync(video, 'corrupt');
    expect(() => assertProductionLock(input, video)).toThrow(/字节/);
    fs.writeFileSync(video, 'test bytes');
    writeRenderReceipt(video, {...profile, productionLockHash: 'wrong'});
    expect(() => assertProductionLock(input, video)).toThrow(/不一致/);
  });
  it('does not publish a failed render or damage the previous locked output', async () => {
    const input = board(); const directory = temp(); const video = path.join(directory, 'sample.mp4'); fs.writeFileSync(video, 'previous');
    const resolved = resolveProductionLock(input); writeProductionLock(input, productionDirectory(video));
    const profile = {purpose: 'visual-preview', productionLockHash: resolved.lock.hash, productionLock: resolved.lock, resolvedShotPlan: resolved.plans}; writeRenderReceipt(video, profile);
    await expect(renderToVerifiedOutput({outputPath: video, force: true, profile, render: async (output) => {fs.writeFileSync(output, 'incomplete'); throw new Error('render failed');}, verify: () => {}})).rejects.toThrow('render failed');
    expect(fs.readFileSync(video, 'utf8')).toBe('previous'); expect(assertProductionLock(input, video).hash).toBe(resolved.lock.hash);
  });
  it('migrates a 2.3 document pilot explicitly and never inherits approval', () => {
    const input = JSON.parse(fs.readFileSync('examples/video-templates/knowledge-notes/storyboard.legacy.json', 'utf8'));
    input.project.status = 'approved';
    const before = JSON.stringify(input);
    const result = migrateStoryboard(input);
    expect(JSON.stringify(input)).toBe(before);
    expect(result.report.approvalInherited).toBe(false);
    expect(result.storyboard.project.status).toBe('generated');
    expect(result.storyboard.scenes[2].shot.id).toBe('document-conclusions');
    expect(result.storyboard.scenes.map((scene) => scene.narration)).toEqual(input.scenes.map((scene) => scene.narration));
    expect(errors(result.storyboard)).toEqual([]);
  });
  it('initializes the explicit template and retains the legacy style-only entry', () => {
    const directory = temp();
    const templated = initProject(['--slug', 'templated', '--video-template', 'retro-zine-explainer', '--projects-dir', directory], {now: new Date('2026-09-30T12:00:00+08:00')});
    const input = JSON.parse(fs.readFileSync(path.join(templated, 'storyboard.draft.json'), 'utf8'));
    expect(input.schemaVersion).toBe('2.4'); expect(input.style.id).toBe('retro-zine'); expect(input.scenes[0].shot.id).toBe('semantic-default');
    const legacy = initProject(['--slug', 'legacy', '--style', 'retro-zine', '--projects-dir', directory]);
    expect(JSON.parse(fs.readFileSync(path.join(legacy, 'storyboard.draft.json'), 'utf8')).schemaVersion).toBe('2.3');
    expect(() => initProject(['--slug', 'unsupported', '--video-template', 'retro-zine-explainer', '--canvas', 'portrait', '--projects-dir', directory])).toThrow(/画幅/);
    expect(() => initProject(['--slug', 'wrong', '--video-template', 'retro-zine-explainer', '--style', 'signal', '--projects-dir', directory])).toThrow(/风格/);
    expect(fs.existsSync(path.join(directory, '20260930-unsupported'))).toBe(false);
    expect(typeof fingerprintProjectInputs(templated, path.resolve('styles'))).toBe('string');
  });
});
