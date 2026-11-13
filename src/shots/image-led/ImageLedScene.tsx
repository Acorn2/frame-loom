import React, {useEffect, useState} from 'react';
import {Img, delayRender, continueRender, cancelRender, useCurrentFrame, useVideoConfig} from 'remotion';
import type {StoryboardLayer, StoryboardScene} from '../../schemas/storyboard';
import type {StyleTokens} from '../../styles/style-loader';
import {ShotShell, type ShotRenderProps} from '../ShotShell';
import type {ShotPlan} from '../compile-shot';
import {isImageLedShot, type ImageLedShot} from './schema';
import {imageAnchor, imageCropAt, imageProgress, imageFrame, projectedRegion} from './layout';

function SourcePicture({scene, shot, layer, tokens, frame}: {scene: StoryboardScene; shot: ImageLedShot; layer: StoryboardLayer; tokens: StyleTokens; frame: number}) {
  const source = layer.assetDataUri ?? layer.asset!, e = shot.elements[layer.id]!;
  const [size, setSize] = useState<{width: number; height: number}>();
  const [handle] = useState(() => delayRender('Read illustration source dimensions'));
  useEffect(() => {
    let live = true;
    const image = new Image();
    image.onload = () => {if (live) setSize({width: image.naturalWidth, height: image.naturalHeight}); continueRender(handle);};
    image.onerror = () => {continueRender(handle); cancelRender(new Error('插画来源图片无法读取。'));};
    image.src = source;
    return () => {live = false; image.onload = null; image.onerror = null; continueRender(handle);};
  }, [source, handle]);
  if (!size) return null;
  const viewport = {...e, height: e.height - 34}, crop = imageCropAt(scene, shot, layer.id, frame), {projection, clip} = imageFrame(size, viewport, crop);
  const opacity = imageProgress(scene, layer.id, 'reveal', frame);
  return <>
    <div data-layout-node={layer.id} style={{position: 'absolute', left: e.x, top: e.y, width: e.width, height: e.height, opacity}}>
      <div data-layout-media data-layout-focused={String(Boolean(e.crop) || shot.focus.some(f => f.target === layer.id))} style={{position: 'absolute', left: clip.x - e.x, top: clip.y - e.y, width: clip.width, height: clip.height, overflow: 'hidden'}}>
        <Img src={source} style={{position: 'absolute', maxWidth: 'none', left: projection.x - clip.x, top: projection.y - clip.y, width: projection.width, height: projection.height}}/>
      </div>
      <div data-layout-text-group style={{position: 'absolute', top: e.height - 30, width: e.width, fontSize: 24, lineHeight: '30px', color: tokens.muted, textAlign: 'center', whiteSpace: 'pre'}}>{layer.label}</div>
    </div>
    {shot.id === 'annotated-image' && <svg aria-hidden width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      {scene.connections.filter(c => c.from === layer.id).map(link => {
        const mark = shot.annotations[link.id]!, r = projectedRegion(projection, mark.region), p = imageProgress(scene, link.id, 'draw', frame);
        const to = shot.elements[link.to]!, endpoint = imageAnchor({...to, height: to.fontSize * 1.3}, mark.toSide);
        const points = [imageAnchor(r, mark.fromSide), ...mark.via, endpoint];
        const color = tokens[mark.color], line = Math.max(0, (p - .35) / .65);
        return <g key={link.id} opacity={p > 0 ? 1 : 0}>
          <ellipse cx={r.x + r.width / 2} cy={r.y + r.height / 2} rx={r.width / 2} ry={r.height / 2} fill="none" stroke={color} strokeWidth={3} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - Math.min(1, p / .5)}/>
          <path d={`M${points.map(point => point.join(' ')).join(' L')}`} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - line}/>
        </g>;
      })}
    </svg>}
  </>;
}
export function ImageLedScene(props: ShotRenderProps & {plan: ShotPlan}) {
  const {scene, tokens} = props, shot = scene.shot, frame = useCurrentFrame(), {width} = useVideoConfig();
  if (!shot || !isImageLedShot(shot)) throw new Error('ImageLedScene requires an exact registered image-led recipe');
  return <ShotShell {...props} ownTitle fullCanvas>
    <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: `scale(${width / 1920})`, transformOrigin: 'top left', fontFamily: tokens.bodyFont}}>
      {shot.kicker && <div data-layout-text-group style={{position: 'absolute', left: 110, top: 103, color: tokens.muted, fontSize: 24}}>{shot.kicker}</div>}
      <svg aria-hidden width={1920} height={1080} style={{position: 'absolute', inset: 0}}><path d="M110 143H1810" fill="none" stroke={tokens.grid}/></svg>
      {scene.layers.map(layer => {
        const e = shot.elements[layer.id]!;
        if (e.kind === 'image') return <SourcePicture key={layer.id} scene={scene} shot={shot} layer={layer} tokens={tokens} frame={frame}/>;
        const opacity = imageProgress(scene, layer.id, 'reveal', frame), underline = imageProgress(scene, layer.id, 'highlight', frame);
        return <div key={layer.id} data-layout-node={layer.id} style={{position: 'absolute', left: e.x, top: e.y, width: e.width, height: e.height, opacity, transform: `translateY(${8 * (1 - opacity)}px)`, color: tokens[e.color], fontSize: e.fontSize, fontWeight: e.weight === 'semibold' ? 650 : 400, textAlign: e.align, whiteSpace: 'pre', lineHeight: 1.3}}>
          <div data-layout-text-group><span style={{position: 'relative', display: 'inline-block'}}>{layer.label}{e.underline && <svg aria-hidden width="100%" height={9} style={{position: 'absolute', left: 0, bottom: -9}}><path d="M0 4H2000" fill="none" stroke={tokens.accent} strokeWidth={2.5} style={{clipPath: `inset(0 ${(1 - underline) * 100}% 0 0)`}}/></svg>}</span></div>
          {layer.text && <div data-layout-text-group style={{fontSize: e.bodySize, fontWeight: 400, color: tokens.muted, marginTop: 14}}>{layer.text}</div>}
        </div>;
      })}
    </div>
  </ShotShell>;
}
