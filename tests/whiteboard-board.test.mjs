import fs from 'node:fs';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {compileStoryboardShots} from '../src/shots/compile-shot.ts';
import {StoryboardSchema} from '../src/schemas/storyboard.ts';
import {FONT_CATALOG} from '../src/fonts/catalog.ts';
import {checkStoryboardInput, checkVisualInput} from '../scripts/lib/preflight.mjs';
import {validateAssets} from '../scripts/validate-assets.mjs';
import {boardShape, boardArrow, strokeProgress, travelTip, textSeconds} from '../src/shots/whiteboard-board/drawing.ts';
import {illustratedLayout} from '../src/shots/illustrated/layout.ts';
const file = path.resolve('examples/whiteboard-reference/storyboard.json');
const board = () => JSON.parse(fs.readFileSync(file));
describe('upstream whiteboard method adaptation', () => {
  it('validates the original public sample and its registered subjects with all independent fonts', () => {
    const originalFile = path.resolve('examples/whiteboard-original/storyboard.json');
    expect(validateAssets(originalFile)).toEqual([]);
    for (const font of FONT_CATALOG) {
      const value = JSON.parse(fs.readFileSync(originalFile)); value.font = {id: font.id, version: font.version};
      expect(checkStoryboardInput(value, {storyboardPath: originalFile, styleRoot: path.resolve('styles'), executionMode: 'fast'}).filter(issue => issue.severity === 'error')).toEqual([]);
      const visual = checkVisualInput(value);
      expect([...visual.textLayout, ...visual.safeArea.issues].filter(issue => issue.severity === 'error')).toEqual([]);
      expect(compileStoryboardShots(value)[0].completeFrame).toBeLessThan(value.project.durationFrames - 36);
    }
  });
  it('accepts the attributed reference assets and the open scene with every independent font', () => {
    expect(validateAssets(file)).toEqual([]);
    for (const font of FONT_CATALOG) {
      const value = board(); value.font = {id: font.id, version: font.version};
      expect(checkStoryboardInput(value, {storyboardPath: file, styleRoot: path.resolve('styles'), executionMode:'fast'}).filter(i=>i.severity==='error')).toEqual([]);
      const visual = checkVisualInput(value);
      expect([...visual.textLayout, ...visual.safeArea.issues].filter(i=>i.severity==='error')).toEqual([]);
      expect(compileStoryboardShots(value)[0].completeFrame).toBeLessThan(value.project.durationFrames - 36);
    }
  });
  it.each([
    [s => {s.beats[1].start=0;}, /不能重叠/],
    [s => {s.shot.elements.reader.y=700;}, /安全区/],
    [s => {s.shot.elements.heading.x=1610; s.shot.elements.heading.width=200;}, /品牌/],
    [s => {s.layers[1].fit='cover';}, /完整/],
    [s => {s.layers[2].x=820;}, /隐藏/],
    [s => {delete s.shot.elements.exercise;}, /唯一内容/],
    [s => {s.beats[0].duration=12;}, /书写预算/],
    [s => {s.shot.routes.extra=s.shot.routes['one-year'];}, /显式关系/]
  ])('rejects conflicting pens, unsafe geometry, cropping and undeclared paths', (mutate, message) => {
    const value=board(); mutate(value.scenes[0]); expect(()=>compileStoryboardShots(value)).toThrow(message);
  });
  it('never accepts an unimplemented font field or unsupported styles', () => {
    const value=board(); value.scenes[0].shot.elements.heading.fontFamily='other';
    expect(StoryboardSchema.safeParse(value).success).toBe(false);
    const other=board(); other.style.id='flat-explainer'; expect(()=>compileStoryboardShots(other)).toThrow(/风格/);
  });
  it('seeks rough strokes deterministically and hides the pen after completion', () => {
    const value=board(), e=value.scenes[0].shot.elements.result;
    const a=boardShape(e,'scene/result','#1e1e1e');
    expect(a).toEqual(boardShape(e,'scene/result','#1e1e1e'));
    expect(a).not.toEqual(boardShape(e,'scene/other','#1e1e1e'));
    expect(strokeProgress(a,1).every(p=>p.p===1 && p.secondProgress===1 && !p.tip)).toBe(true);
    const line=boardArrow(value.scenes[0].shot.routes['one-year'],'arrow','#1e1e1e');
    expect(strokeProgress(line,.4).some(p=>p.tip)).toBe(true);
    expect(strokeProgress(line,1).every(p=>!p.tip)).toBe(true);
    expect(travelTip(100, [{start:10,duration:30,first:{x:0,y:0},last:{x:100,y:100}}],30)).toBeUndefined();
    expect(textSeconds('你好',80)).toBeGreaterThan(textSeconds('ab',80));
  });
  it('honors the requested empty, solid or hachure checkbox fill', () => {
    const checkbox=board().scenes[0].shot.elements.sleep;
    expect(boardShape({...checkbox,fill:'none'},'check','#1e1e1e').every(p=>!p.fill)).toBe(true);
    expect(boardShape({...checkbox,fill:'green',fillStyle:'solid'},'check','#1e1e1e').every(p=>!p.fill)).toBe(true);
    expect(boardShape({...checkbox,fill:'green',fillStyle:'hachure'},'check','#1e1e1e').some(p=>p.fill)).toBe(true);
  });
  it('distinguishes surrounding cartoon explanations from aligned pixel modules', () => {
    const value=JSON.parse(fs.readFileSync('examples/illustrated-video/paper-collage/illustrated-explain.json'));
    const shot=value.scenes[0].shot;
    const flat=illustratedLayout(shot,1700,600,'flat-explainer'), paper=illustratedLayout(shot,1700,600,'paper-collage');
    expect(flat).not.toEqual(paper);
    expect(paper.get(shot.slots.subject).x + paper.get(shot.slots.subject).width).toBeLessThan(paper.get(shot.slots.items[0]).x);
    expect(flat.get(shot.slots.items[0]).x + flat.get(shot.slots.items[0]).width).toBeLessThan(flat.get(shot.slots.subject).x);
    expect(flat.get(shot.slots.subject).x + flat.get(shot.slots.subject).width).toBeLessThan(flat.get(shot.slots.items[1]).x);
  });
});
