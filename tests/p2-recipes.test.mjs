import {compareAssetIssues} from '../scripts/lib/compare-assets.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {describe,expect,it} from 'vitest';
import {StoryboardSchema} from '../src/schemas/storyboard.ts';
import {compileStoryboardShots} from '../src/shots/compile-shot.ts';
import {P2_IDS} from '../src/shots/p2/schema.ts';
import {libraryFixtures,previewFingerprint} from '../scripts/lib/library-catalog.mjs';
import {checkStoryboardInput,checkAssetInput,checkVisualInput} from '../scripts/lib/preflight.mjs';
import {resolveProductionLock} from '../scripts/lib/production-lock.mjs';
import {freezeProgress,grainPosition,scrubPosition} from '../src/shots/p2/P2Scene.tsx';
import {assertChapterCaptions,inkBoundary,barnDoorInset} from '../src/shots/shortlist/chapter-transitions.tsx';
import {hydrateLibraryAssets} from '../scripts/lib/library-assets.mjs';
const coverage=JSON.parse(fs.readFileSync('shots/shortlist-coverage.json'));
const ids=coverage.candidates.filter(c=>c.priority==='P2').map(c=>c.runtimeId);
const fixtures=libraryFixtures().filter(f=>ids.includes(f.id));
const read=id=>JSON.parse(fs.readFileSync(fixtures.find(f=>f.id===id).source));
const compile=b=>compileStoryboardShots(StoryboardSchema.parse(b));
describe('P2 source-faithful recipes',()=>{
  it('connects exactly 13 scenes, 5 hosted actions and 3 transitions without changing native counts',()=>{
    expect(P2_IDS).toHaveLength(13);expect(fixtures).toHaveLength(21);
    expect(coverage.candidates.filter(c=>c.status==='pending')).toEqual([]);
    expect(coverage.candidates.filter(c=>c.runtimeKind==='scene')).toHaveLength(34);
    expect(coverage.candidates.filter(c=>c.runtimeKind==='auxiliary')).toHaveLength(9);
    expect(coverage.candidates.filter(c=>c.runtimeKind==='transition')).toHaveLength(5);
  });
  it.each(fixtures.map(f=>[f.id,f.source]))('preflights real %s inputs, assets, text and reading budgets',(id,source)=>{
    const b=read(id),before=structuredClone(b);
    const issues=checkStoryboardInput(b,{storyboardPath:path.resolve(source),styleRoot:path.resolve('styles'),executionMode:'fast'});
    expect(issues.filter(i=>i.severity==='error')).toEqual([]);expect(checkAssetInput(path.resolve(source))).toEqual([]);
    const visual=checkVisualInput(b);expect(visual.textLayout.filter(i=>i.severity==='error')).toEqual([]);expect(visual.safeArea.issues.filter(i=>i.severity==='error')).toEqual([]);
    for(const plan of compile(b))expect(plan.stableEndFrame-plan.completeFrame).toBeGreaterThanOrEqual(36);
    expect(b).toEqual(before);
  });
  it.each([
    ['research-stack',s=>{delete s.shot.authors[s.shot.slots.items[0]];}],
    ['list-stack-press',s=>{s.beats[1].start=5;}],
    ['integration-hub',s=>{s.connections[0].to=s.shot.slots.before;}],
    ['scroll-brake',s=>{s.shot.focusId='invented';}],
    ['chart-live',s=>{s.layers[0].value=999;}],
    ['chart-live',s=>{s.shot.samples[0].value=-1;}],
    ['particle-sand-fill',s=>{s.layers[0].value='';}],
    ['particle-sand-fill',s=>{s.shot.grainUnit=.0001;}],
    ['member-grid',s=>{s.shot.flagged.push('invented');}],
    ['ring-annotation',s=>{s.beats.find(b=>b.action==='draw').start=0;}],
    ['cycle-mechanism',s=>{s.connections.pop();}],
    ['media-before-after',s=>{s.layers[1].asset=s.layers[0].asset;}],
    ['media-before-after',s=>{s.layers[1].width=800;}],
    ['document-write',s=>{s.beats[1].start=0;}],
    ['code-reveal',s=>{s.shot.tokens[0].text+=' invent';}],
    ['letterspace-materialize',s=>{s.shot.glyphs[0].paths[0]='<script/>'; }],
    ['letterspace-materialize',s=>{s.shot.glyphs[0].character='X';}],
    ['chart-live',s=>{s.beats.push({id:'hidden-focus',target:s.layers[0].id,action:'focus',start:40,duration:30});}]
  ])('rejects malformed %s semantics',(id,mutate)=>{const b=read(id);mutate(b.scenes[0]);expect(()=>compile(b)).toThrow();});
  it.each(['scanline-annotate-focus','scan-bracket-sweep','line-boil','speed-ramp-freeze','mosaic-reframe'])('locks %s only when explicitly used by its host',id=>{
    const b=read(id);expect(resolveProductionLock(b).lock.auxiliaries.map(r=>r.id)).toContain(id);
    b.scenes[0].shot.effects=[];b.scenes[0].beats=b.scenes[0].beats.filter(beat=>beat.id!==`${id}-phase`);
    expect(resolveProductionLock(b).lock.auxiliaries.map(r=>r.id)).not.toContain(id);
  });
  it.each(['scanline-annotate-focus','scan-bracket-sweep','line-boil','speed-ramp-freeze','mosaic-reframe'])('refuses premature or unbound %s effects',id=>{
    const b=read(id);b.scenes[0].beats.find(b=>b.id===`${id}-phase`).start=0;expect(()=>compile(b)).toThrow();
    const wrong=read(id);wrong.scenes[0].shot.effects[0].target='invented';expect(()=>compile(wrong)).toThrow();
  });
  it.each([24,30,60])('supports bounded timing and backward seeking at %i fps',fps=>{
    for(const id of ids){const b=read(id);const factor=fps/30;b.project.fps=fps;
      for(const scene of b.scenes){scene.durationFrames=Math.ceil(scene.durationFrames*factor);for(const beat of scene.beats){beat.start=Math.ceil(beat.start*factor);beat.duration=Math.ceil(beat.duration*factor);}for(const c of scene.captions){c.start=Math.ceil(c.start*factor);c.end=Math.floor(c.end*factor);}if(scene.transitionIn)scene.transitionIn.durationFrames=Math.ceil(scene.transitionIn.durationFrames*factor);}
      b.project.durationFrames=b.scenes.reduce((n,s)=>n+s.durationFrames-(s.transitionIn?.durationFrames??0),0);b.project.durationSec=b.project.durationFrames/fps;
      const result=compile(b);expect(compile(b)).toEqual(result);
    }
    const motion={start:0,duration:6*fps},freeze={start:2*fps,duration:fps};
    expect(freezeProgress(2*fps,motion,freeze)).toBe(freezeProgress(3*fps-1,motion,freeze));expect(freezeProgress(6*fps,motion,freeze)).toBe(1);
    const sample=freezeProgress(fps,motion,freeze);freezeProgress(5*fps,motion,freeze);expect(freezeProgress(fps,motion,freeze)).toBe(sample);
  });
  it('clears particles exactly at completion, preserves overshoot and deterministic ink geometry',()=>{
    for(let i=0;i<28;i++)expect(grainPosition(1,i,28)).toEqual({y:1,visible:false});
    expect(scrubPosition(.2)).toBe(.76);expect(scrubPosition(.3)).toBe(.7);expect(scrubPosition(1)).toBe(.4);
    expect(inkBoundary(.4,1920,1080)).toBe(inkBoundary(.4,1920,1080));
  });
  it.each(['line-carry-transition','print-texture-transitions','page-turn-transitions'])('locks %s and rejects caption coverage or first-scene use',id=>{
    const b=read(id);expect(resolveProductionLock(b).lock.transitions.map(r=>r.id)).toContain(id);
    expect(()=>assertChapterCaptions(b,[{startSec:0,endSec:100,text:'overlap'}])).toThrow();
    b.scenes[0].transitionIn=b.scenes[1].transitionIn;expect(()=>compile(b)).toThrow();
  });
  it('reveals the barn-door incoming page only through the opened center gap',()=>{
    expect(barnDoorInset(0)).toBe(50);expect(barnDoorInset(1)).toBe(0);
    for(const progress of [0,.1,.25,.5,.75,.95,1]) {
      const oldCoverage=1-progress**3,newCoverage=1-barnDoorInset(progress)*2/100;
      expect(oldCoverage+newCoverage).toBeCloseTo(1,12);
    }
  });
  it('rejects carry keys not representing the same source title',()=>{const b=read('line-carry-transition');b.scenes[1].layers[0].semanticRole='carry:other';expect(()=>compile(b)).toThrow();});
  it('hydrates the two real image bytes while retaining input and fingerprinting those assets',()=>{
    const b=read('media-before-after');const source=path.resolve(fixtures.find(f=>f.id==='media-before-after').source);const hydrated=hydrateLibraryAssets(b,source);
    expect(hydrated.scenes[0].layers.every(l=>l.assetDataUri.startsWith('data:image/svg+xml;base64,'))).toBe(true);
    expect(b.scenes[0].layers.every(l=>!l.assetDataUri)).toBe(true);expect(previewFingerprint()).toMatch(/^[a-f0-9]{64}$/);
  });
  it('checks actual image dimensions and rejects distinct paths containing identical bytes',()=>{
    const b=read('media-before-after'),directory=path.resolve('examples/shot-recipes/media-before-after');
    expect(compareAssetIssues(b.scenes[0],directory)).toEqual([]);
    b.scenes[0].layers.forEach(l=>l.width=800);expect(compareAssetIssues(b.scenes[0],directory)[0]).toMatch(/真实尺寸/);
    const same=read('media-before-after');same.scenes[0].layers[1].asset=same.scenes[0].layers[0].asset;expect(compareAssetIssues(same.scenes[0],directory)[0]).toMatch(/相同文件内容/);
  });
  it('fails real overflowing text before rendering',()=>{const b=read('cycle-mechanism');b.scenes[0].layers[1].label='这是一个很长的循环节点';b.scenes[0].layers[1].text='这是长正文内容需要多行展示并且必须保留';expect(checkVisualInput(b).textLayout.some(i=>i.severity==='error')).toBe(true);});
});
