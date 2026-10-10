import fs from 'node:fs';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {libraryStyleIds, libraryPreviewFixtures, buildLibraryCatalog} from '../scripts/lib/library-catalog.mjs';
import {checkStoryboardInput, checkVisualInput, checkAssetInput} from '../scripts/lib/preflight.mjs';
import {recipeAppearance} from '../src/shots/appearance.ts';
import {createStyleTokens} from '../src/styles/style-loader.ts';
import {normalizeSelection, createExports} from '../library/selection.mjs';
import {assertShotSelectionCompatibility} from '../src/shots/selection.ts';
import {recipePreview} from '../library/presentation.mjs';
const luminance=hex=>{const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return r*.2126+g*.7152+b*.0722;};
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
describe('independent landscape style and shot combinations',()=>{
 const catalog=buildLibraryCatalog();
 it.each(libraryStyleIds)('%s accepts every scene, hosted action, transition and variant fixture',style=>{
  const fixtures=libraryPreviewFixtures().filter(f=>f.styleId===style);expect(fixtures).toHaveLength(60);

  for(const fixture of fixtures){
   const storyboardPath=path.resolve(fixture.source),board=JSON.parse(fs.readFileSync(storyboardPath));board.style.id=style;delete board.videoTemplate;
   const tokens=createStyleTokens(JSON.parse(fs.readFileSync(`styles/${style}/style.json`)),JSON.parse(fs.readFileSync(`styles/${style}/motion.json`)),board.project.width,board.project.height);
   expect(checkStoryboardInput(board,{storyboardPath,styleRoot:path.resolve('styles'),executionMode:'fast'}).filter(i=>i.severity==='error'),fixture.id).toEqual([]);
   expect(checkAssetInput(storyboardPath)).toEqual([]);
   const visual=checkVisualInput(board);expect([...visual.safeArea.issues,...visual.textLayout].filter(i=>i.severity==='error'),fixture.id).toEqual([]);
   for(const scene of board.scenes){
    const appearance=recipeAppearance(scene.shot,tokens);expect(appearance).toBeDefined();
    expect(contrast(appearance.stageInk,appearance.tokens.background),fixture.id).toBeGreaterThanOrEqual(7);
    expect(contrast(appearance.stageMuted,appearance.tokens.background),fixture.id).toBeGreaterThanOrEqual(4.5);
    expect(contrast(appearance.tokens.captionInk,appearance.tokens.background),fixture.id).toBeGreaterThanOrEqual(4.5);
    if(!['semantic-default','compare-reveal','network-expand'].includes(scene.shot.id)) expect(contrast(appearance.tokens.accentAlt,appearance.tokens.paper),fixture.id).toBeGreaterThanOrEqual(4.5);
    expect(appearance.tokens.bodyFont).toBe(tokens.bodyFont);expect(appearance.tokens.safeArea).toEqual(tokens.safeArea);
   }
  }
 });
 it('retains the full chosen pool across styles and exports the current style',()=>{
  const selected=catalog.recipes.filter(r=>r.kind==='scene').map(r=>r.id);
  for(const style of libraryStyleIds){
   const next=normalizeSelection(catalog,{style,canvas:'landscape',selected});expect(next.selected).toEqual(selected);
   expect(createExports(catalog,next).prompt).toContain(`视频风格：${style}\n`);
  }
 });
 it('preserves historical style limits and current portrait limits',()=>{
  const context={width:1920,height:1080,fps:30,style:{id:'signal',version:'1.0.0'}};
  expect(()=>assertShotSelectionCompatibility([{id:'paper-title',version:'1.1.0'}],context)).toThrow(/风格/);
  expect(()=>assertShotSelectionCompatibility([{id:'paper-title',version:'1.2.0'}],{...context,width:1080,height:1920})).toThrow(/画幅/);
  expect(()=>assertShotSelectionCompatibility([{id:'paper-title',version:'1.2.0'}],{...context,style:{id:'signal',version:'9.9.9'}})).toThrow(/风格/);
 });
 it('resolves current style media and variants, never using another style as a fallback',()=>{
  const item={id:'card-stack',poster:'old.png',video:'old.mp4',stylePreviews:[{style:'signal',poster:'signal.png',video:'signal.mp4',previewStatus:'ready'}],previewVariants:[{id:'card-stack-tape',stylePreviews:[{style:'signal',poster:'tape.png',video:'tape.mp4',previewStatus:'ready'}]}]};
  expect(recipePreview(item,'signal')).toMatchObject({poster:'signal.png',video:'signal.mp4',sampleStyle:'signal'});
  expect(recipePreview(item,'signal').previewVariants[0].video).toBe('tape.mp4');
  expect(recipePreview(item,'scatterbrain')).toMatchObject({poster:null,video:null,previewStatus:'missing'});
  expect(item.video).toBe('old.mp4');
 });
});
