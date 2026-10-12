import fs from 'node:fs';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {FONT_CATALOG} from '../src/fonts/catalog.ts';
import {compileStoryboardShots} from '../src/shots/compile-shot.ts';
import {SHOT_CATALOG} from '../src/shots/catalog.ts';
import {checkStoryboardInput, checkVisualInput, checkAssetInput} from '../scripts/lib/preflight.mjs';
import {libraryPreviewFixtures, buildLibraryCatalog} from '../scripts/lib/library-catalog.mjs';
import {createExports} from '../library/selection.mjs';
import {listShots} from '../scripts/list-shots.mjs';
import {drawingProgress, roughPolyline, penPosition, pointOnPath} from '../src/shots/whiteboard/drawing.ts';
import {whiteboardCanvas, whiteboardLayout} from '../src/shots/whiteboard/layout.ts';

const ids = ['whiteboard-process', 'whiteboard-compare', 'whiteboard-explain'];
const file = id => path.resolve(`examples/shot-recipes/${id}/storyboard.json`);
const fixture = id => JSON.parse(fs.readFileSync(file(id), 'utf8'));
describe('whiteboard source-driven contracts', () => {
  it.each(ids)('%s supports each declared style, independent fonts and assets', id => {
    const recipe = SHOT_CATALOG.find(item => item.id === id);
    expect(checkAssetInput(file(id))).toEqual([]);
    for (const style of recipe.styles) for (const {id: fontId, version} of FONT_CATALOG) {
      const board = fixture(id); board.style.id = style; board.font = {id: fontId, version};
      const visual = checkVisualInput(board);
      expect([...checkStoryboardInput(board, {storyboardPath: file(id), styleRoot: path.resolve('styles'), executionMode: 'fast'}), ...visual.safeArea.issues, ...visual.textLayout].filter(issue => issue.severity === 'error'), `${id}/${style}/${fontId}`).toEqual([]);
      const plan = compileStoryboardShots(board)[0];
      expect(plan.stableEndFrame - plan.completeFrame).toBeGreaterThanOrEqual(36);
      expect(plan.checkpoints.some(point => point.id.includes('complete'))).toBe(true);
    }
  });
  it.each([
    ['whiteboard-process', s => {s.beats[1].start = 10;}, /重叠/],
    ['whiteboard-process', s => {s.beats[1].duration = 12;}, /预算/],
    ['whiteboard-process', s => {s.connections[0].to = 'c';}, /连接/],
    ['whiteboard-process', s => {s.layers[0].x = 10;}, /构图/],
    ['whiteboard-process', s => {delete s.visual.source;}, /来源/],
    ['whiteboard-process', s => {s.beats = s.beats.filter(b => b.action !== 'trace');}, /唯一 trace/],
    ['whiteboard-process', s => {s.beats[1].state = 'completed';}, /状态/],
    ['whiteboard-compare', s => {s.connections = [{id: 'ab', from: 'a', to: 'b'}];}, /连线/],
    ['whiteboard-explain', s => {delete s.layers[0].asset;}, /主体/],
    ['whiteboard-explain', s => {s.layers[0].fit = 'cover';}, /主体/],
    ['whiteboard-explain', s => {s.visual.networkDirection = 'inward';}, /方向/]
  ])('rejects unsupported input or ordering in %s', (id, mutate, error) => {
    const board = fixture(id); mutate(board.scenes[0]); expect(() => compileStoryboardShots(board)).toThrow(error);
  });
  it('rejects portrait, incomplete reading and real node overflow', () => {
    const board = fixture(ids[0]); Object.assign(board.project, {width: 1080, height: 1920});
    expect(() => compileStoryboardShots(board)).toThrow(/画幅/);
    const short = fixture(ids[0]); short.scenes[0].durationFrames = 390;
    expect(() => compileStoryboardShots(short)).toThrow(/阅读/);
    const full = fixture(ids[2]); full.scenes[0].layers[1].text = '解释内容'.repeat(12); full.scenes[0].beats.find(b => b.target === 'a' && b.action === 'reveal').duration = 45;
    expect(() => compileStoryboardShots(full)).toThrow(/预算/);
  });
  it('fits all three explanation notes using the same compact metrics as the renderer', () => {
    const board = JSON.parse(fs.readFileSync(path.resolve('examples/shot-recipes/whiteboard-explain/three-notes.json')));
    for (const style of SHOT_CATALOG.find(item => item.id === 'whiteboard-explain').styles) {
      board.style.id = style;
      expect(checkVisualInput(board).textLayout.filter(issue => issue.severity === 'error'), style).toEqual([]);
    }
  });
  it('exposes only supported style and canvas samples, without fallback', () => {
    const samples = libraryPreviewFixtures().filter(item => item.styleId === 'whiteboard');
    expect(samples.map(item => item.recipeId).sort()).toEqual(['semantic-default', 'whiteboard-board', ...ids, ...SHOT_CATALOG.filter(item => item.id.startsWith('illustrated-')).map(item => item.id)].sort());
    expect(samples.every(item => item.canvas === 'landscape')).toBe(true);
    expect(listShots(['--style', 'whiteboard', '--canvas', 'portrait'], {log: () => {}})).toEqual([]);
    const catalog = buildLibraryCatalog();
    expect(createExports(catalog, {style: 'whiteboard', font: 'source-han-sans-sc', fontMode: 'manual', selected: ids}).prompt).toContain('全片字体：source-han-sans-sc');
    expect(createExports(catalog, {style: 'whiteboard', selected: ['paper-title']}).prompt).toContain('内置镜头范围：whiteboard-board');
  });
});
describe('deterministic drawing and shared geometry', () => {
  it('seeks reproducibly and follows geometric length across segments', () => {
    const points = [{x: 0, y: 0}, {x: 100, y: 0}, {x: 100, y: 300}];
    expect(roughPolyline(points, 'same', 3)).toEqual(roughPolyline(points, 'same', 3));
    expect(roughPolyline(points, 'same', 3)).not.toEqual(roughPolyline(points, 'other', 3));
    expect(pointOnPath(points, .5)).toEqual({x: 100, y: 100});
    const stages = [{start: 30, duration: 60, points}];
    const sought = penPosition(60, stages);
    penPosition(80, stages); expect(penPosition(60, stages)).toEqual(sought);
    expect(penPosition(20, stages)).toBeUndefined(); expect(penPosition(150, stages)).toBeUndefined();
    expect([20, 30, 60, 90, 120].map(frame => drawingProgress(frame, 30, 60))).toEqual([0, 0, .5, 1, 1]);
  });
  it.each(ids)('%s places every node inside the shared body', id => {
    for (const style of SHOT_CATALOG.find(item => item.id === id).styles) {
      const pack = JSON.parse(fs.readFileSync(`styles/${style}/style.json`));
      const canvas = whiteboardCanvas(1920, 1080, pack.safeArea.landscape, true);
      for (const box of whiteboardLayout(fixture(id).scenes[0].shot, canvas.width, canvas.height).values()) {
        expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(canvas.width);
        expect(box.y + box.height).toBeLessThanOrEqual(canvas.height);
      }
    }
  });
});
