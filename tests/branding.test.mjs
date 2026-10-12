import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {afterEach, describe, expect, it} from 'vitest';
import {BrandConfigSchema, BrandSchema, brandProgress, brandRegion} from '../src/branding/config.ts';
import {resolveBrand} from '../scripts/lib/branding.mjs';
import {resolveProductionLock} from '../scripts/lib/production-lock.mjs';
import {storyboardApprovalFingerprint} from '../scripts/lib/storyboard-approval.mjs';
import {sceneCacheKey} from '../scripts/lib/scene-cache.mjs';
import {coverFrame} from '../scripts/render-cover.mjs';
import {analyzeMeasurement} from '../src/layout/diagnostics.ts';
import {initProject} from '../scripts/init-project.mjs';
import fixture from '../examples/whiteboard-reference/storyboard.json' with {type: 'json'};

const directories = [];
const temp = () => {const value = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-loom-brand-')); directories.push(value); return value;};
afterEach(() => {for (const directory of directories.splice(0)) fs.rmSync(directory, {recursive: true, force: true});});
function config(directory, brand) {
  fs.writeFileSync(path.join(directory, 'config.json'), JSON.stringify({schemaVersion: '1.0', brand}));
}
function png(directory, color) {
  const file = path.join(directory, 'logo.png');
  const result = spawnSync('ffmpeg', ['-v', 'error', '-nostdin', '-y', '-f', 'lavfi', '-i', `color=c=${color}:s=96x32`, '-frames:v', '1', file]);
  expect(result.status).toBe(0); return file;
}
describe('shared primary-style brand', () => {
  it.each(['whiteboard', 'flat-explainer', 'paper-collage', 'annotated-reasoning', 'editorial-typography'])('reads a single name with safe defaults for %s', style => {
    const root = temp(); config(root, {name: 'Hresh赫什'});
    expect(resolveBrand(style, {root}).runtime).toMatchObject({name: 'Hresh赫什', watermark: {position: 'top-right', size: 36, opacity: .72, drawInSeconds: 1.2}});
  });
  it('replaces the entire project configuration without affecting the repository or legacy styles', () => {
    const root = temp(), projectPath = temp(); config(root, {name: 'Global', accent: '#ff0000'}); config(projectPath, {name: 'Project'});
    expect(resolveBrand('whiteboard', {root, projectPath})).toMatchObject({runtime: {name: 'Project'}, evidence: {scope: 'project'}});
    expect(resolveBrand('whiteboard', {root, projectPath}).runtime.accent).toBeUndefined();
    expect(resolveBrand('whiteboard', {root}).runtime.name).toBe('Global');
    expect(resolveBrand('retro-zine', {root: 'missing-directory'})).toBeUndefined();
  });
  it.each([{name: ''}, {name: 'line\nbreak'}, {name: 'x'.repeat(41)}, {name: 'X', endCard: {}}, {name: 'X', watermark: {position: 'bottom-right'}}, {name: 'X', watermark: {size: 48}}, {name: 'X', watermark: {opacity: .1}}])('rejects unsupported or unsafe settings %j', brand => {
    expect(BrandConfigSchema.safeParse({schemaVersion: '1.0', brand}).success).toBe(false);
  });
  it('decodes local PNGs with source/license and binds the actual bytes', () => {
    const root = temp(); png(root, 'red'); config(root, {name: 'X', logo: {path: 'logo.png', source: 'Original test shape', license: 'CC0'}});
    const first = resolveBrand('paper-collage', {root});
    expect(first.runtime.logoDataUri).toMatch(/^data:image\/png;base64,/u); expect(first.runtime.logoAspect).toBe(3);
    png(root, 'blue'); expect(resolveBrand('paper-collage', {root}).evidence.logoHash).not.toBe(first.evidence.logoHash);
  });
  it('does not load a disabled logo, and rejects remote assets, invalid bytes and undocumented logos', () => {
    const root = temp(), logo = {path: 'missing.png', source: 'Test', license: 'CC0'};
    config(root, {name: 'X', logo, watermark: {enabled: false}});
    expect(resolveBrand('whiteboard', {root}).runtime).toBeNull();
    for (const asset of ['https://example.com/logo.png', 'data:image/png;base64,invalid']) {
      config(root, {name: 'X', logo: {...logo, path: asset}}); expect(() => resolveBrand('whiteboard', {root})).toThrow(/本地 PNG/);
    }
    fs.writeFileSync(path.join(root, 'invalid.png'), 'not PNG');
    config(root, {name: 'X', logo: {...logo, path: 'invalid.png'}}); expect(() => resolveBrand('whiteboard', {root})).toThrow(/PNG/);
    expect(BrandSchema.safeParse({name: 'X', logo: {path: 'logo.png'}}).success).toBe(false);
  });
  it('invalidates production, approval and visual scene cache after name and logo changes', () => {
    const projectPath = temp(), board = structuredClone(fixture);
    for (const name of ['storyboard.json', 'asset-manifest.json']) fs.copyFileSync(path.resolve('examples/whiteboard-reference', name), path.join(projectPath, name));
    fs.cpSync(path.resolve('examples/whiteboard-reference/assets'), path.join(projectPath, 'assets'), {recursive: true});
    fs.copyFileSync(path.resolve('examples/whiteboard-reference/source.md'), path.join(projectPath, 'script.md'));
    config(projectPath, {name: 'First'});
    const first = resolveProductionLock(board, undefined, projectPath).lock;
    const approval = storyboardApprovalFingerprint(projectPath);
    const inputProps = {storyboard: board, styleTokens: {}, renderProfile: {productionLock: first, brand: resolveBrand('whiteboard', {projectPath}).runtime}};
    const values = {inputProps, composition: {width: 1920, height: 1080, fps: 30, durationInFrames: 600}, timing: {scene: board.scenes[0], startFrame: 0}, layoutFrames: [0, 460]};
    const cache = sceneCacheKey(values);
    config(projectPath, {name: 'Second'});
    const second = resolveProductionLock(board, undefined, projectPath).lock;
    expect(second.hash).not.toBe(first.hash); expect(storyboardApprovalFingerprint(projectPath)).not.toBe(approval);
    inputProps.renderProfile.productionLock = second; inputProps.renderProfile.brand = resolveBrand('whiteboard', {projectPath}).runtime;
    expect(sceneCacheKey(values)).not.toBe(cache);
    png(projectPath, 'red'); config(projectPath, {name: 'Second', logo: {path: 'logo.png', source: 'Original test', license: 'CC0'}});
    const before = resolveProductionLock(board, undefined, projectPath).lock.hash;
    png(projectPath, 'blue'); expect(resolveProductionLock(board, undefined, projectPath).lock.hash).not.toBe(before);
  });
  it('reveals only at the beginning of the global timeline and chooses a completed cover frame', () => {
    expect(brandProgress(0, 30, 1.2)).toBe(0); expect(brandProgress(40, 30, 1.2)).toBe(1); expect(brandProgress(600, 30, 1.2)).toBe(1);
    expect(brandProgress(0, 30, 0)).toBe(1);
    expect(coverFrame(fixture, [{completeFrame: 459, stableEndFrame: 600}], BrandSchema.parse({name: 'X'}))).toBe(469);
    expect(() => coverFrame(fixture, [{completeFrame: 599, stableEndFrame: 600}], null)).toThrow(/没有/);
  });
  it('rejects stable text/image collisions with the brand reserved region', () => {
    const rect = brandRegion(1920), content = {x: 0, y: 0, width: 1920, height: 1080};
    const sample = {sceneId: 'one', frame: 40, stable: true, content, brand: rect, texts: [{rect, text: 'conflict', group: 0}], images: [{rect, source: {width: 284, height: 108}, fit: 'contain', focused: true}], nodes: []};
    expect(analyzeMeasurement(sample).issues.filter(issue => issue.code === 'brand-overlap')).toHaveLength(2);
    expect(analyzeMeasurement(sample).issues.every(issue => issue.severity === 'error')).toBe(true);
    expect(analyzeMeasurement({...sample, stable: false}).issues.every(issue => issue.severity === 'warning')).toBe(true);
  });
  it('initializes a custom primary name in project config without creating a production video', () => {
    const directory = temp(), project = initProject(['--slug', 'branded', '--style', 'paper-collage', '--brand-name', 'Hresh赫什', '--projects-dir', directory]);
    expect(JSON.parse(fs.readFileSync(path.join(project, 'config.json'))).brand.name).toBe('Hresh赫什');
    expect(resolveBrand('paper-collage', {projectPath: project}).runtime.name).toBe('Hresh赫什');
    expect(() => initProject(['--slug', 'legacy', '--style', 'retro-zine', '--brand-name', 'X', '--projects-dir', directory])).toThrow(/三套主风格/);
  });
});
