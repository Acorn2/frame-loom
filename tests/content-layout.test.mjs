import {describe, expect, it} from 'vitest';
import {sceneRegions, networkRects, overlaps, containedImage} from '../src/layout/scene-layout';
import {analyzeMeasurement} from '../src/layout/diagnostics';
import {layoutCheckpoints} from '../src/layout/checkpoints';
import {StoryboardSchema} from '../src/schemas/storyboard';
import fixture from '../examples/shot-selection/storyboard.json';
import {checkStoryboardInput, checkVisualInput} from '../scripts/lib/preflight.mjs';
import {libraryPreviewFixtures, libraryStyleIds} from '../scripts/lib/library-catalog.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {layoutCollector} from '../scripts/lib/layout-qa.mjs';
import {LAYOUT_LOG_PREFIX} from '../src/layout/diagnostics';
import {getSceneTimeline} from '../src/timeline/scene-timeline';

const safeArea = {left: 120, right: 120, top: 100, bottom: 100};
const measurement = () => ({sceneId: 'example', frame: 90, stable: true, content: {x: 0, y: 0, width: 1680, height: 755}, texts: [], images: [], nodes: []});

describe('content-first production layout', () => {
  it('keeps the policy explicit and rejects unsupported historical schemas', () => {
    const board = structuredClone(fixture);
    expect(StoryboardSchema.parse(board).layoutPolicy).toBeUndefined();
    expect(layoutCheckpoints(StoryboardSchema.parse(board))).toEqual([]);
    expect(StoryboardSchema.parse({...board, layoutPolicy: 'content-first-v1'}).layoutPolicy).toBe('content-first-v1');
    expect(StoryboardSchema.safeParse({...board, layoutPolicy: 'unknown'}).success).toBe(false);
    expect(StoryboardSchema.safeParse({...board, schemaVersion: '2.3', layoutPolicy: 'content-first-v1'}).success).toBe(false);
  });
  it('shows a 900×670 source at more than four times the old image area without cropping', () => {
    const regions = sceneRegions({width: 1920, height: 1080, safeArea, captions: true, media: true});
    const actual = containedImage({width: 900, height: 670}, regions.body);
    const old = containedImage({width: 900, height: 670}, {x: 0, y: 0, width: 1630, height: 365.25});
    expect(actual.width * actual.height / (old.width * old.height)).toBeGreaterThan(4);
    expect(overlaps(regions.title, regions.body)).toBe(false);
    expect(overlaps(regions.claim, regions.body)).toBe(false);
  });
  it.each([2, 3, 4, 5])('keeps %i branches clear of the anchor in both directions and orientations', count => {
    for (const [width, height] of [[1680, 543], [936, 1250]]) for (const inward of [false, true]) {
      const nodes = networkRects(count, width, height, 1, inward);
      const all = [nodes.anchor, ...nodes.branches];
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(overlaps(all[i], all[j])).toBe(false);
    }
  });
  it('detects final text/node collisions and clipping, with transient collisions kept as warnings', () => {
    const value = measurement();
    value.texts = [{rect: {x: 0, y: 0, width: 100, height: 40}, text: '中心', group: 0}, {rect: {x: 40, y: 20, width: 100, height: 40}, text: '分支', group: 1}];
    expect(analyzeMeasurement(value).issues.some(i => i.code === 'text-overlap' && i.severity === 'error')).toBe(true);
    value.stable = false;
    expect(analyzeMeasurement(value).issues.every(i => i.severity === 'warning')).toBe(true);
    value.stable = true; value.texts[0].rect.x = -20;
    expect(analyzeMeasurement(value).issues.some(i => i.code === 'text-clipped')).toBe(true);
    value.nodes = [{x: 0, y: 0, width: 200, height: 100}, {x: 100, y: 50, width: 200, height: 100}];
    expect(analyzeMeasurement(value).issues.some(i => i.code === 'node-overlap')).toBe(true);
  });
  it('measures contained pixels rather than the full image element and warns about cover', () => {
    const value = measurement();
    value.images = [{rect: {x: 0, y: 0, width: 1680, height: 365}, source: {width: 900, height: 670}, fit: 'contain', focused: false}];
    const result = analyzeMeasurement(value);
    expect(result.images[0].visible.width).toBeLessThan(500);
    expect(result.issues.some(i => i.code === 'media-small')).toBe(true);
    value.images[0].fit = 'cover';
    expect(analyzeMeasurement(value).issues.some(i => i.code === 'media-crop')).toBe(true);
  });
  it('includes event states and both sides of an actual overlapping handoff', () => {
    const board = StoryboardSchema.parse({...structuredClone(fixture), layoutPolicy: 'content-first-v1'});
    const frames = layoutCheckpoints(board);
    expect(frames.length).toBeGreaterThan(board.scenes.length * 2);
    expect(frames[0]).toBe(0);
    expect(frames.at(-1)).toBe(board.project.durationFrames - 1);
  });
  it('rejects missing event frames, missing scene coverage and completed-state errors', () => {
    const board = StoryboardSchema.parse({...structuredClone(fixture), layoutPolicy: 'content-first-v1'});
    expect(() => layoutCollector(board).finish()).toThrow(/必选帧/);
    const timeline = getSceneTimeline(board);
    const missing = layoutCollector(board, {frames: [0]});
    missing.onBrowserLog({text: `${LAYOUT_LOG_PREFIX}${JSON.stringify({frame: 0, checks: []})}`});
    expect(() => missing.finish()).toThrow(/场景/);
    const bad = layoutCollector(board, {frames: [0]});
    bad.onBrowserLog({text: `${LAYOUT_LOG_PREFIX}${JSON.stringify({frame: 0, checks: [{sceneId: timeline[0].scene.id, issues: [{severity: 'error', sceneId: timeline[0].scene.id, frame: 0, message: '关键内容遮挡'}]}]})}`});
    expect(() => bad.finish()).toThrow(/关键内容遮挡/);
  });
  it.each(libraryStyleIds)('accepts all current %s recipes under the new policy', style => {
    for (const item of libraryPreviewFixtures().filter(item => item.styleId === style)) {
      const storyboardPath = path.resolve(item.source);
      const board = JSON.parse(fs.readFileSync(storyboardPath, 'utf8'));
      board.style.id = style; delete board.videoTemplate; board.layoutPolicy = 'content-first-v1';
      expect(checkStoryboardInput(board, {storyboardPath, styleRoot: path.resolve('styles'), executionMode: 'fast'}).filter(i => i.severity === 'error'), item.id).toEqual([]);
      const visual = checkVisualInput(board);
      expect([...visual.safeArea.issues, ...visual.textLayout].filter(i => i.severity === 'error'), item.id).toEqual([]);
    }
  });
});
