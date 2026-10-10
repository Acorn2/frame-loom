import fs from 'node:fs';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {compileStoryboardShots} from '../src/shots/compile-shot.ts';
import {regroupPoints} from '../src/shots/expansion/layout.ts';
import {typedQuery} from '../src/shots/expansion/ExpansionScene.tsx';
import {libraryPreviewFixtures, libraryStyleIds, buildLibraryCatalog} from '../scripts/lib/library-catalog.mjs';
import {checkStoryboardInput, checkVisualInput} from '../scripts/lib/preflight.mjs';
import {normalizeSelection, createExports} from '../library/selection.mjs';
import {recipePreview} from '../library/presentation.mjs';
import {initProject} from '../scripts/init-project.mjs';
import os from 'node:os';
const ids = ['type-and-filter','ai-stream-response','unit-dot-regroup'];
const fixture = (id, canvas = 'landscape') => JSON.parse(fs.readFileSync(`examples/shot-recipes/${id}/${canvas === 'portrait' ? 'portrait' : 'storyboard'}.json`));
describe('source-driven landscape and portrait recipes', () => {
  it.each(libraryStyleIds)('%s accepts both orientations, captions and explicit fonts', style => {
    for (const id of ids) for (const canvas of ['landscape','portrait']) {
      const board = fixture(id, canvas); board.style.id = style;
      board.font = {id:'source-han-sans-sc',version:'2.005'};
      board.scenes[0].captions = [{id:'caption',text:'观察输入如何变成结果',start:0,end:board.project.durationFrames}];
      const storyboardPath = path.resolve(`examples/shot-recipes/${id}/${canvas === 'portrait' ? 'portrait' : 'storyboard'}.json`);
      expect(checkStoryboardInput(board,{storyboardPath,styleRoot:path.resolve('styles'),executionMode:'fast'}).filter(i=>i.severity==='error'),`${id}/${canvas}`).toEqual([]);
      const visual = checkVisualInput(board);
      expect([...visual.safeArea.issues,...visual.textLayout].filter(i=>i.severity==='error'),`${id}/${canvas}`).toEqual([]);
    }
  });
  it.each([
    ['type-and-filter', s=>{s.layers.find(l=>l.id==='query').label='不存在';}, /唯一匹配/],
    ['type-and-filter', s=>{s.layers.find(l=>l.id==='b').text='镜头';}, /唯一匹配/],
    ['type-and-filter', s=>{s.beats.find(b=>b.target==='detail').start=100;}, /因果顺序/],
    ['type-and-filter', s=>{s.layers.find(l=>l.id==='query').label='镜头笔记';s.beats.find(b=>b.target==='query').duration=6;}, /打字/],
    ['ai-stream-response', s=>{s.beats.find(b=>b.target==='done').start=100;}, /所有任务/],
    ['ai-stream-response', s=>{s.beats.find(b=>b.action==='set-state').state='current';}, /completed/],
    ['ai-stream-response', s=>{s.beats=s.beats.filter(b=>b.id!=='a-set-state');}, /唯一/],
    ['unit-dot-regroup', s=>{s.layers.find(l=>l.id==='total').value=37;}, /总数/],
    ['unit-dot-regroup', s=>{s.layers[0].value=1.5;}, /非负整数/],
    ['unit-dot-regroup', s=>{s.layers[0].value=-1;}, /非负整数/],
    ['unit-dot-regroup', s=>{s.layers[0].value=121;s.layers[3].value=141;}, /120/],
    ['unit-dot-regroup', s=>{s.visual.unit='';}, /单位/],
    ['unit-dot-regroup', s=>{s.layers[0].text='看不见的正文';}, /正文/]
  ])('rejects false inputs or causal order for %s', (id, mutate, error) => {
    const board = fixture(id); mutate(board.scenes[0]); expect(()=>compileStoryboardShots(board)).toThrow(error);
  });
  it.each(ids)('rejects unsupported shapes, hidden layers and insufficient final reading for %s', id => {
    const board = fixture(id); board.project.height = 1200; expect(()=>compileStoryboardShots(board)).toThrow(/画幅/);
    const hidden = fixture(id); hidden.scenes[0].layers[0].x = 100; expect(()=>compileStoryboardShots(hidden)).toThrow(/构图/);
    const short = fixture(id); short.scenes[0].durationFrames -= 54; expect(()=>compileStoryboardShots(short)).toThrow();
  });
  it('types Unicode code points without introducing ellipses or splitting surrogate pairs', () => {
    const beat={start:30,duration:60};
    expect(typedQuery('镜头🔎',20,beat)).toBe('');
    expect(typedQuery('镜头🔎',70,beat)).toBe('镜头');
    expect(typedQuery('镜头🔎',90,beat)).toBe('镜头🔎');
  });
  it.each([false,true])('preserves every point and its group within bounds (portrait=%s)', portrait => {
    const width = portrait ? 900 : 1600, height = portrait ? 1080 : 500;
    for (const values of [[16,12,8],[120,0],[0,0,120,0],[1,0,0,0],[30,30,30,30]]) {
      const stages = regroupPoints(values,width,height,portrait);
      for(const stage of stages) {
        expect(stage).toHaveLength(values.reduce((a,b)=>a+b,0));
        values.forEach((value,i)=>expect(stage.filter(p=>p.group===i)).toHaveLength(value));
        for(const p of stage) {expect(p.x).toBeGreaterThanOrEqual(9);expect(p.y).toBeGreaterThanOrEqual(9);expect(p.x).toBeLessThanOrEqual(width-9);expect(p.y).toBeLessThanOrEqual(height-9);}
      }
      expect(regroupPoints(values,width,height,portrait)).toEqual(stages);
    }
  });
  it('exports and initializes all new portrait recipes without dropping the pool', () => {
    const catalog=buildLibraryCatalog();
    const state=normalizeSelection(catalog,{style:'signal',canvas:'portrait',selected:ids});
    expect(state.selected).toEqual(ids);expect(createExports(catalog,state).prompt).toContain('9:16 竖屏');
    const folder=fs.mkdtempSync(path.join(os.tmpdir(),'frame-loom-expansion-'));
    try {
      const target=initProject(['--slug','portrait-proof','--style','signal','--shots',ids.join(','),'--canvas','portrait','--projects-dir',folder]);
      const draft=JSON.parse(fs.readFileSync(path.join(target,'storyboard.draft.json')));
      expect(draft.project).toMatchObject({width:1080,height:1920});expect(draft.shotRecipes.map(s=>s.id)).toEqual(ids);
    } finally {fs.rmSync(folder,{recursive:true,force:true});}
  });
  it('matches samples by both style and canvas, without landscape fallback', () => {
    const samples=libraryPreviewFixtures();
    for(const id of ids) for(const canvas of ['landscape','portrait']) expect(samples.filter(s=>s.recipeId===id&&s.canvas===canvas)).toHaveLength(6);
    const item={id:'proof',stylePreviews:[{style:'signal',canvas:'landscape',video:'wide.mp4',poster:'wide.png',previewStatus:'ready'},{style:'signal',canvas:'portrait',video:'tall.mp4',poster:'tall.png',previewStatus:'ready'}]};
    expect(recipePreview(item,'signal','portrait')).toMatchObject({video:'tall.mp4',sampleCanvas:'portrait'});
    expect(recipePreview({...item,stylePreviews:[item.stylePreviews[0]]},'signal','portrait')).toMatchObject({video:null,previewStatus:'missing'});
  });
});
