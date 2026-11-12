import fs from 'node:fs';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {StoryboardSchema} from '../src/schemas/storyboard.ts';
import {compileStoryboardShots} from '../src/shots/compile-shot.ts';
import {directionPlacement} from '../src/shots/directions/layout.ts';
import {checkAssetInput, checkStoryboardInput, checkVisualInput} from '../scripts/lib/preflight.mjs';
import {FONT_CATALOG} from '../src/fonts/catalog.ts';
import {resolveShot} from '../src/shots/catalog.ts';
const file = slug => path.resolve(`examples/shot-recipes/${slug === 'mechanism' ? 'mechanism-map' : 'product-showcase'}/storyboard.json`);
const load = slug => JSON.parse(fs.readFileSync(file(slug)));
const compile = board => compileStoryboardShots(StoryboardSchema.parse(board));
describe('source-bound mechanism and product recipes', () => {
  it.each(['mechanism', 'product'])('%s uses explicit inputs and every independent font', slug => {
    const board = load(slug);
    expect(checkAssetInput(file(slug))).toEqual([]);
    expect(compile(board)).toHaveLength(5);
    for (const font of FONT_CATALOG) {
      board.font = {id: font.id, version: font.version};
      expect(checkStoryboardInput(board, {storyboardPath: file(slug), styleRoot: path.resolve('styles'), executionMode: 'fast'}).filter(i => i.severity === 'error')).toEqual([]);
      const checks = checkVisualInput(board);
      expect([...checks.safeArea.issues, ...checks.textLayout].filter(i => i.severity === 'error')).toEqual([]);
    }
  });
  it('accepts replacement content without a sample-word dependency', () => {
    const b = load('mechanism'), s = b.scenes[1]; s.layers.find(l => l.id === 'n2').label = 'chapter-17';
    s.title = '修订流程总览'; s.layers[0].label = s.title; s.primaryClaim = s.title;
    expect(compile(b)[1].shot.id).toBe('mechanism-map');
  });
  it.each([
    ['extra slot', s => {s.shot.slots.items.push('missing');}],
    ['unbound geometry', s => {s.shot.elements.extra = {...s.shot.elements.title};}],
    ['caption collision', s => {s.shot.elements.title.y = 840;}],
    ['hidden layer state', s => {s.layers[0].x = 200;}],
    ['hidden beat state', s => {s.beats[0].state = {value: 3};}],
    ['unknown old version', s => {s.shot.version = '1.0.0';}],
    ['early relationship', s => {s.beats.find(b => b.action === 'draw').start = 0;}],
    ['extra relationship words', s => {s.connections[0].label = 'unshown';}]
  ])('rejects %s', (_label, mutate) => {const b = load('mechanism'); mutate(b.scenes[1]); expect(() => compile(b)).toThrow();});
  it.each([
    ['missing media', s => {s.layers.find(l => l.id === 'screen').asset = undefined;}],
    ['outside crop', s => {s.shot.focus[0].crop.width = 1;}],
    ['unbound focus', s => {s.shot.focus[0].trigger = 'missing';}],
    ['fake media type', s => {s.layers.find(l => l.id === 'screen').type = 'node';}],
    ['hidden cover behavior', s => {s.layers.find(l => l.id === 'screen').fit = 'cover';}],
    ['camera/title collision', s => {s.shot.focus[0].verticalDelay = 0;}]
  ])('rejects product %s', (_label, mutate) => {const b = load('product'); mutate(b.scenes[1]); expect(() => compile(b)).toThrow();});
  it('derives camera position from the previous frame-independent endpoint', () => {
    const b = load('product'), s = b.scenes[1], f = s.shot.focus[0], beat = s.beats.find(b => b.id === f.trigger);
    const start = directionPlacement(s, s.shot, f.target, beat.start), end = directionPlacement(s, s.shot, f.target, beat.start + beat.duration);
    expect(start.x).toBe(s.shot.elements.screen.x); expect(end.x).toBe(f.box.x); expect(end.crop).toEqual(f.crop);
  });
  it('keeps delayed camera travel and source labels above the caption reserve at every frame', () => {
    for (const scene of load('product').scenes) for (const focus of scene.shot.focus) {
      const beat = scene.beats.find(b => b.id === focus.trigger);
      for (let frame = beat.start; frame <= beat.start + beat.duration; frame++) {
        const box = directionPlacement(scene, scene.shot, focus.target, frame);
        expect(box.y).toBeGreaterThanOrEqual(96);
        expect(box.y + box.height).toBeLessThanOrEqual(850);
        expect(box.x).toBeGreaterThanOrEqual(120);
        expect(box.x + box.width).toBeLessThanOrEqual(1800);
      }
    }
  });
  it('keeps historical recipes and rejects undeclared new combinations', () => {
    expect(resolveShot('paper-title', '1.0.0').version).toBe('1.0.0');
    expect(resolveShot('paper-title', '1.1.0').version).toBe('1.1.0');
    const b = load('product'); b.project.width = 1080; b.project.height = 1920; expect(() => compile(b)).toThrow();
    b.project.width = 1920; b.project.height = 1080; b.style.id = 'retro-zine'; expect(() => compile(b)).toThrow();
  });
});
