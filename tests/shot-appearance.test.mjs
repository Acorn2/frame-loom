import fs from 'node:fs';
import {describe, expect, it} from 'vitest';
import {recipeAppearance, captionTokensAtFrame} from '../src/shots/appearance.ts';
import {createStyleTokens, getDefaultStyleTokens} from '../src/styles/style-loader.ts';
import {captionTextStyle} from '../src/audio/caption-style.ts';
import {SHOT_CATALOG, PREVIOUS_SHOT_CATALOG} from '../src/shots/catalog.ts';
import {sceneAuxiliaries} from '../src/shots/auxiliary-catalog.ts';
import {resolveProductionLock} from '../scripts/lib/production-lock.mjs';
const fixture=id=>JSON.parse(fs.readFileSync(`examples/shot-recipes/${id}/storyboard.json`,'utf8'));
const luminance=hex=>{const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
describe('recipe visual treatments',()=>{
 it('retains precise 1.1.0 manifests and auxiliary versions without applying new appearance',()=>{
  expect(PREVIOUS_SHOT_CATALOG).toHaveLength(21);
  const board=fixture('blur-slide');board.shotRecipes[0].version='1.1.0';board.scenes[0].shot.version='1.1.0';
  expect(recipeAppearance(board.scenes[0].shot,getDefaultStyleTokens())).toBeUndefined();
  expect(sceneAuxiliaries(board.scenes[0])[0].version).toBe('1.1.0');
  expect(resolveProductionLock(board).lock.shots[0].version).toBe('1.1.0');
 });
 it('keeps content intact and preserves legible card text and independent caption contrast across all new recipes',()=>{
  const base=getDefaultStyleTokens();const before=JSON.stringify(base);const backgrounds=new Set();let dark=0,light=0;
  for(const entry of SHOT_CATALOG){
   const board=fixture(entry.id);const source=JSON.stringify(board);const appearance=recipeAppearance(board.scenes[0].shot,base);
   expect(contrast(appearance.tokens.ink,appearance.tokens.paper)).toBeGreaterThanOrEqual(7);
   expect(contrast(appearance.tokens.muted,appearance.tokens.paper)).toBeGreaterThanOrEqual(4.5);
   expect(contrast(captionTextStyle(appearance.tokens).color,appearance.tokens.background)).toBeGreaterThanOrEqual(4.5);
   expect(appearance.tokens.safeArea).toEqual(base.safeArea);
   expect(appearance.tokens.paper).toBe('#ffffff');
   if(['semantic-default','compare-reveal','network-expand'].includes(entry.id)) expect(appearance.background).toBe(base.background);
   else expect(appearance.background).not.toContain(base.background);
   expect(contrast(appearance.stageInk,appearance.tokens.background)).toBeGreaterThanOrEqual(7);
   expect(contrast(appearance.stageMuted,appearance.tokens.background)).toBeGreaterThanOrEqual(4.5);
   expect(JSON.stringify(board)).toBe(source);backgrounds.add(appearance.background);appearance.dark?dark++:light++;
  }
  expect(backgrounds.size).toBeGreaterThanOrEqual(10);expect(dark).toBeGreaterThan(0);expect(light).toBeGreaterThan(0);expect(JSON.stringify(base)).toBe(before);
 });
 it('keeps native diagrams legible on Signal stages without tinting white cards',()=>{
  const base=createStyleTokens(JSON.parse(fs.readFileSync('styles/signal/style.json','utf8')),JSON.parse(fs.readFileSync('styles/signal/motion.json','utf8')),1920,1080);
  for(const id of ['semantic-default','compare-reveal','network-expand']){
   const appearance=recipeAppearance(fixture(id).scenes[0].shot,base);
   expect(appearance.dark).toBe(true);
   expect(contrast(appearance.stageInk,appearance.background)).toBeGreaterThanOrEqual(7);
   expect(contrast(appearance.tokens.ink,appearance.tokens.paper)).toBeGreaterThanOrEqual(7);
   expect(contrast(appearance.tokens.captionInk,appearance.background)).toBeGreaterThanOrEqual(7);
  }
 });
 it('changes external captions with the active scene, including arbitrary backward seeks and legacy scenes',()=>{
  const base=getDefaultStyleTokens();const board=fixture('paper-title');const incoming=fixture('card-stack').scenes[0];board.scenes.push(incoming);
  const boundary=board.scenes[0].durationFrames;
  expect(captionTokensAtFrame(board,boundary,base).captionInk).toBe('#ffffff');
  expect(captionTokensAtFrame(board,0,base).captionInk).toBe('#334155');
  expect(captionTokensAtFrame(board,boundary+20,base).captionInk).toBe('#ffffff');
  incoming.shot.version='1.1.0';expect(captionTokensAtFrame(board,boundary,base)).toBe(base);
 });
});
