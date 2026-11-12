import fs from 'node:fs';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {StoryboardSchema} from '../src/schemas/storyboard.ts';
import {compileStoryboardShots} from '../src/shots/compile-shot.ts';
import {editorialDomain, editorialNumber, editorialChartLayout} from '../src/shots/editorial/layout.ts';
import {checkStoryboardInput, checkVisualInput} from '../scripts/lib/preflight.mjs';
import {FONT_CATALOG} from '../src/fonts/catalog.ts';
import {resolveShot} from '../src/shots/catalog.ts';

const file = path.resolve('examples/shot-recipes/editorial-explainer/storyboard.json');
const load = () => JSON.parse(fs.readFileSync(file));
const compile = b => compileStoryboardShots(StoryboardSchema.parse(b));
describe('editorial explainers', () => {
  it('compiles all five compositions and every independent font without fixture text dependencies', () => {
    const b = load();
    expect(compile(b)).toHaveLength(5);
    for (const font of FONT_CATALOG) {
      b.font = {id: font.id, version: font.version};
      expect(checkStoryboardInput(b, {storyboardPath: file, styleRoot: path.resolve('styles'), executionMode: 'fast'}).filter(i => i.severity === 'error')).toEqual([]);
      const checks = checkVisualInput(b);
      expect([...checks.safeArea.issues, ...checks.textLayout].filter(i => i.severity === 'error')).toEqual([]);
    }
    const s = b.scenes[0]; s.title = '原文支持的新主张'; s.primaryClaim = s.title; s.layers[0].label = s.title;
    for (const l of s.layers.filter(l => l.type === 'metric')) l.value += 25;
    s.shot.charts.figure.domain.max = 150;
    expect(compile(b)[0].shot.id).toBe('editorial-explainer');
  });
  it('preserves raw numeric labels and rescales the same members at every frame', () => {
    expect(editorialNumber(90.123456789)).toBe('90.123456789');
    const b = load(), s = b.scenes[3], chart = s.shot.charts.rescaled, beat = s.beats.find(b => b.id === chart.rescale.trigger);
    const values = s.layers.filter(l => l.type === 'metric').map(l => l.value);
    for (let frame = beat.start; frame <= beat.start + beat.duration; frame++) {
      const domain = editorialDomain(s, s.shot, 'rescaled', frame);
      expect(domain.min).toBeGreaterThanOrEqual(0); expect(domain.min).toBeLessThanOrEqual(80);
      expect(domain.max).toBe(110); expect(values.every(v => v >= domain.min && v <= domain.max)).toBe(true);
    }
    expect(editorialDomain(s, s.shot, 'rescaled', beat.start)).toEqual(chart.domain);
    expect(editorialDomain(s, s.shot, 'rescaled', beat.start + beat.duration)).toEqual(chart.rescale.domain);
    expect(editorialChartLayout(s.shot.elements.rescaled, 2).height).toBeGreaterThan(90);
  });
  it.each([
    ['missing source', s => {s.visual.source = '';}],
    ['hidden visual state', s => {s.visual.mediaFocus = {target: 'zero'};}],
    ['missing geometry', s => {delete s.shot.elements.zero;}],
    ['extra geometry', s => {s.shot.elements.unused = {...s.shot.elements.title};}],
    ['hidden layer coordinate', s => {s.layers[0].x = 20;}],
    ['hidden beat state', s => {s.beats[0].state = {value: 1};}],
    ['caption collision', s => {s.shot.elements.title.y = 840;}],
    ['content overlap', s => {s.shot.elements.zero.y = 190;}],
    ['unbound chart', s => {s.shot.charts.missing = {...s.shot.charts.zero};}],
    ['missing metric', s => {s.shot.charts.zero.metrics[0] = 'unknown';}],
    ['reused metric', s => {s.shot.charts.cut.metrics = [...s.shot.charts.zero.metrics];}],
    ['missing value', s => {delete s.layers.find(l => l.type === 'metric').value;}],
    ['textual numeric value', s => {s.layers.find(l => l.type === 'metric').value = '90';}],
    ['hidden category line', s => {s.layers.find(l => l.type === 'metric').label = 'A\n隐藏类别';}],
    ['hidden unit line', s => {for (const l of s.layers.filter(l => l.type === 'metric')) l.text = 'kg\n隐藏说明';}],
    ['negative value', s => {s.layers.find(l => l.type === 'metric').value = -1;}],
    ['clipped value', s => {s.shot.charts.zero.domain.max = 80;}],
    ['reversed scale', s => {s.shot.charts.zero.domain.min = 110;}],
    ['incompatible units', s => {s.layers.find(l => l.type === 'metric').text = 'kg';}],
    ['undisclosed nonzero origin', s => {s.layers.find(l => l.id === 'cut').text = '';}],
    ['wrong highlight target', s => {s.shot.charts.cut.accent = 'title';}],
    ['unsupported old version', s => {s.shot.version = '1.1.0';}]
  ])('rejects %s', (_name, mutate) => {const b = load(); mutate(b.scenes[2]); expect(() => compile(b)).toThrow();});
  it.each([
    ['missing focus', s => {s.shot.charts.rescaled.rescale.trigger = 'unknown';}],
    ['early focus', s => {s.beats.find(b => b.action === 'focus').start = 0;}],
    ['clipped rescale', s => {s.shot.charts.rescaled.rescale.domain.max = 90;}],
    ['hidden focus', s => {s.beats.push({id: 'extra', target: 'title', action: 'focus', start: 100, duration: 15});}]
  ])('rejects %s', (_name, mutate) => {const b = load(); mutate(b.scenes[3]); expect(() => compile(b)).toThrow();});
  it('binds underlines to unique visible phrases and explicit post-entry actions', () => {
    for (const phrase of ['不存在的内容', '应从零开始\n']) {const b = load(); b.scenes[1].shot.elements.extract.underline = phrase; expect(() => compile(b)).toThrow();}
    const b = load(); b.scenes[1].beats.find(b => b.action === 'highlight').start = 0; expect(() => compile(b)).toThrow();
  });
  it('keeps historical versions and rejects undeclared style and canvas combinations', () => {
    for (const version of ['1.0.0', '1.1.0']) expect(resolveShot('paper-title', version).version).toBe(version);
    const b = load(); b.style.id = 'signal'; expect(() => compile(b)).toThrow();
    b.style.id = 'retro-zine'; b.project.width = 1080; b.project.height = 1920; expect(() => compile(b)).toThrow();
  });
});
