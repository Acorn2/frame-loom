import React, {useEffect, useState} from 'react';
import {Img, cancelRender, continueRender, delayRender, useCurrentFrame, useVideoConfig} from 'remotion';
import {ShotShell, type ShotRenderProps} from '../ShotShell';
import type {ShotPlan} from '../compile-shot';
import {isDirectionShot} from './schema';
import {directionAnchor, directionInsets, directionPlacement, directionProgress} from './layout';
import {mixColor} from '../appearance';

function useImageSize(source: string) {
  const [size, setSize] = useState<{width: number; height: number}>();
  const [handle] = useState(() => delayRender('Read real source image dimensions'));
  useEffect(() => {
    let live = true;
    const image = new Image();
    image.onload = () => {if (live) setSize({width: image.naturalWidth, height: image.naturalHeight}); continueRender(handle);};
    image.onerror = () => {continueRender(handle); cancelRender(new Error('产品实演来源图片无法读取。'));};
    image.src = source;
    return () => {live = false; image.onload = null; image.onerror = null; continueRender(handle);};
  }, [source, handle]);
  return size;
}
function SourceImage({source, crop, width, height}: {source: string; crop: {x: number; y: number; width: number; height: number}; width: number; height: number}) {
  const size = useImageSize(source);
  if (!size) return <Img src={source} style={{position: 'absolute', width: 1, height: 1, opacity: 0}}/>;
  const scale = Math.min(width / (size.width * crop.width), height / (size.height * crop.height));
  return <Img src={source} style={{position: 'absolute', maxWidth: 'none', width: size.width * scale, height: size.height * scale,
    left: -crop.x * size.width * scale + (width - crop.width * size.width * scale) / 2,
    top: -crop.y * size.height * scale + (height - crop.height * size.height * scale) / 2}}/>;
}

const weight = {regular: 400, medium: 550, bold: 750};
export function DirectionScene(props: ShotRenderProps & {plan: ShotPlan}) {
  const {scene, tokens} = props, shot = scene.shot, frame = useCurrentFrame(), {width} = useVideoConfig();
  if (!shot || !isDirectionShot(shot)) throw new Error('DirectionScene requires an exact registered direction recipe');
  const scale = width / 1920, mechanical = shot.id === 'mechanism-map';
  const surface = mechanical ? mixColor(tokens.background, tokens.ink, .055) : tokens.paper, stroke = tokens.grid, active = tokens.accent, ink = tokens.ink;
  const marker = `${scene.id}-direction-arrow`;
  return <ShotShell {...props} ownTitle fullCanvas>
    <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: `scale(${scale})`, transformOrigin: 'top left', fontFamily: tokens.bodyFont}}>
      {mechanical && <svg aria-hidden width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        <defs><pattern id={`${scene.id}-grid`} width={64} height={64} patternUnits="userSpaceOnUse"><path d="M64 0H0V64" fill="none" stroke={stroke} strokeWidth={1} opacity={.45}/></pattern></defs>
        <rect width={1920} height={1080} fill={`url(#${scene.id}-grid)`}/>
      </svg>}
      {scene.layers.map(layer => {
        const e = shot.elements[layer.id]!, box = directionPlacement(scene, shot, layer.id, frame), opacity = directionProgress(scene, layer.id, 'reveal', frame);
        const emphasized = directionProgress(scene, layer.id, 'highlight', frame) > .5;
        const color = emphasized ? active : tokens[e.color];
        const inset = directionInsets(e.kind, box), innerWidth = box.width - inset.width;
        const at = e.emphasis ? layer.label!.indexOf(e.emphasis) : -1;
        const panel = ['panel', 'film', 'gate', 'plane'].includes(e.kind);
        const textStyle: React.CSSProperties = {fontFamily: tokens.bodyFont, fontSize: e.fontSize, fontWeight: weight[e.weight], lineHeight: 1.3, color, textAlign: e.align, whiteSpace: 'pre', margin: 0};
        return <div key={layer.id} {...(e.kind === 'plane' ? {'data-layout-plane': layer.id} : {'data-layout-node': layer.id})}
          style={{position: 'absolute', left: box.x, top: box.y, width: box.width, height: box.height, opacity, transform: `translateY(${mechanical ? 10 * (1 - opacity) : 16 * (1 - opacity)}px)`}}>
          {panel && <svg aria-hidden width={box.width} height={box.height} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
            {e.kind === 'gate' ? <path d={`M${box.width / 2} 0L${box.width} ${box.height / 2}L${box.width / 2} ${box.height}L0 ${box.height / 2}Z`} fill={surface} stroke={emphasized ? active : color} strokeWidth={2}/>
              : e.kind === 'plane' ? <><path d={`M0 ${box.height * .48}L${box.width * .55} 0L${box.width} ${box.height * .43}L${box.width * .45} ${box.height * .92}Z`} fill={surface} stroke={color} strokeWidth={1.5}/><path d={`M0 ${box.height * .48}v${box.height * .08}L${box.width * .45} ${box.height}L${box.width} ${box.height * .51}v-${box.height * .08}M${box.width * .45} ${box.height * .92}v${box.height * .08}`} fill="none" stroke={color}/></>
                : <rect width={box.width} height={box.height} fill={surface} stroke={emphasized ? active : color === ink ? stroke : color} strokeWidth={emphasized ? 2 : 1}/>}
            {e.kind === 'film' && Array.from({length: 7}, (_, i) => <g key={i}><rect x={12 + i * (box.width - 36) / 7} y={7} width={12} height={4} fill={stroke}/><rect x={12 + i * (box.width - 36) / 7} y={box.height - 11} width={12} height={4} fill={stroke}/></g>)}
          </svg>}
          {e.kind === 'media' ? <>
            <div data-layout-media data-layout-focused={String(Boolean(e.crop) || (shot.id === 'product-showcase' && shot.focus.some(f => f.target === layer.id)))} style={{position: 'absolute', inset: '0 0 34px', overflow: 'hidden', border: `1px solid ${stroke}`, background: surface, boxShadow: `0 24px 54px ${ink}15`}}>
              <SourceImage source={layer.assetDataUri ?? layer.asset!} crop={box.crop} width={box.width} height={Math.max(1, box.height - 34)}/>
            </div>
            <div data-layout-text-group style={{...textStyle, position: 'absolute', top: box.height - 28, width: box.width, fontSize: e.fontSize, lineHeight: '28px', color: tokens.muted}}>{layer.label}</div>
          </> : <div style={{position: 'absolute', left: inset.x, top: inset.y, width: innerWidth}}>
            <div data-layout-text-group style={textStyle}>{at >= 0 ? <>{layer.label!.slice(0, at)}<span style={{color: active}}>{e.emphasis}</span>{layer.label!.slice(at + e.emphasis!.length)}</> : layer.label}</div>
            {layer.text && <div data-layout-text-group style={{...textStyle, fontSize: e.bodySize, fontWeight: 400, color: tokens.muted, marginTop: 14}}>{layer.text}</div>}
          </div>}
        </div>;
      })}
      {shot.id === 'mechanism-map' && <svg aria-hidden width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        <defs><marker id={marker} viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto"><path d="M1 1L9 5L1 9" fill="none" stroke={active} strokeWidth={1.2}/></marker></defs>
        {scene.connections.map(link => {
          const route = shot.routes[link.id]!, from = directionAnchor(shot.elements[link.from]!, route.fromSide), to = directionAnchor(shot.elements[link.to]!, route.toSide);
          const points = [from, ...route.via, to], d = `M${points.map(p => p.join(' ')).join(' L')}`, p = directionProgress(scene, link.id, 'draw', frame);
          return <g key={link.id} opacity={p > 0 ? 1 : 0}><path d={d} fill="none" stroke={mixColor(tokens.background, tokens[route.color], .28)} strokeWidth={1}/><path d={d} fill="none" stroke={tokens[route.color]} strokeWidth={2.2} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} markerEnd={route.arrow && p === 1 ? `url(#${marker})` : undefined}/></g>;
        })}
      </svg>}
    </div>
  </ShotShell>;
}
