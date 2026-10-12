import React from 'react';
import {Img, useCurrentFrame, useVideoConfig} from 'remotion';
import {ConceptGlyph} from '../../templates/semantic/ConceptGlyph';
import {ShotShell, type ShotRenderProps} from '../ShotShell';
import type {ShotPlan} from '../compile-shot';
import {isIllustratedShot} from './schema';
import {illustratedCanvas, illustratedLayout, illustrationTextBox, illustratedConnection} from './layout';
import {illustratedProgress, pixelRevealBlocks, pixelEmphasisOpacity} from './motion';
import {IllustratedStage} from './IllustratedStage';

export function IllustratedScene(props: ShotRenderProps & {plan: ShotPlan}) {
  const {scene, tokens} = props, frame = useCurrentFrame(), {width, height} = useVideoConfig(), shot = scene.shot;
  if (!shot || !isIllustratedShot(shot)) throw new Error('IllustratedScene requires an illustrated recipe');
  const canvas = illustratedCanvas(width, height, tokens.safeArea, Boolean(tokens.layoutPolicy));
  const rects = illustratedLayout(shot, canvas.width, canvas.height, tokens.id), pixel = tokens.id === 'paper-collage', whiteboard = tokens.id === 'whiteboard';
  const progress = (target: string, action: string) => {
    const beat = scene.beats.find(beat => beat.target === target && beat.action === action);
    return beat ? illustratedProgress(frame, beat.start, beat.duration, tokens.id) : 0;
  };
  return <ShotShell {...props}>
    <div style={{position: 'relative', width: canvas.width, height: canvas.height, transform: `scale(${canvas.scale})`, transformOrigin: 'top left'}}>
      <IllustratedStage shot={shot} rects={rects} width={canvas.width} height={canvas.height} tokens={tokens} progress={id => progress(id, 'reveal')}/>
      <svg aria-hidden width={canvas.width} height={canvas.height} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
        {scene.connections.map(link => {
          const a = rects.get(link.from)!, b = rects.get(link.to)!, p = progress(link.id, 'draw');
          const legacyAx = a.x + a.width + 12, legacyAy = a.y + a.height * .48, legacyBx = b.x - 18, legacyBy = b.y + b.height * .48;
          const route = whiteboard ? {path: `M${legacyAx} ${legacyAy} C${legacyAx + 30} ${legacyAy + 12},${legacyBx - 30} ${legacyBy},${legacyBx} ${legacyBy}`, x: legacyBx, y: legacyBy, angle: Math.atan2(legacyBy - legacyAy, legacyBx - legacyAx)} : illustratedConnection(a, b, pixel, [...rects.values()]), size = whiteboard ? 14 : pixel ? 9 : 12;
          return <g key={link.id} opacity={p > 0 ? 1 : 0}>
            <path d={route.path} fill="none" stroke={tokens.accentAlt} strokeWidth={whiteboard ? 3 : pixel ? 3 : 4} strokeLinecap={pixel ? 'square' : 'round'} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p}/>
            {p === 1 ? <path d={`M${route.x - size * Math.cos(route.angle - .5)} ${route.y - size * Math.sin(route.angle - .5)} L${route.x} ${route.y} L${route.x - size * Math.cos(route.angle + .5)} ${route.y - size * Math.sin(route.angle + .5)}`} stroke={tokens.accentAlt} strokeWidth={3} fill="none"/> : null}
          </g>;
        })}
      </svg>
      {scene.layers.map((layer, index) => {
        const rect = rects.get(layer.id)!, box = illustrationTextBox(shot, layer.id, rect, tokens.id), p = progress(layer.id, 'reveal'), eased = 1 - (1 - p) ** 4;
        const count = layer.type === 'metric' ? progress(layer.id, 'count') : 0, highlight = progress(layer.id, 'highlight');
        const clipId = `${scene.id}-${index}-pixel-reveal`;
        return <div key={layer.id} data-layout-node={layer.id} style={{position: 'absolute', left: rect.x, top: rect.y, width: rect.width, height: rect.height,
          opacity: p > 0 ? whiteboard || pixel ? 1 : eased : 0, transformOrigin: '50% 65%',
          transform: whiteboard || pixel ? undefined : `translateY(${(1 - eased) * 36}px) scale(${.94 + .06 * eased})`,
          clipPath: whiteboard ? `inset(0 ${(1 - p) * 100}% 0 0)` : undefined}}>
          {pixel && box.image ? <svg aria-hidden width={0} height={0} style={{position: 'absolute'}}><defs><clipPath id={clipId} clipPathUnits="objectBoundingBox">{pixelRevealBlocks(p, box.imageWidth / box.imageHeight).map((block, i) => <rect key={i} {...block}/>)}</clipPath></defs></svg> : null}
          {box.image ? <div style={{position: 'absolute', left: box.imageLeft, top: box.imageTop, width: box.imageWidth, height: box.imageHeight, clipPath: pixel && p < 1 ? `url(#${clipId})` : undefined}}>
            {layer.type === 'node' ? <div style={{height: '100%', display: 'grid', placeItems: 'center'}}><ConceptGlyph glyph={layer.glyph} color={tokens.accentAlt} size={Math.min((whiteboard ? box.width : box.imageWidth) * .7, box.imageHeight * .8)}/></div>
              : <Img src={layer.assetDataUri ?? layer.asset!} style={{display: 'block', width: '100%', height: '100%', objectFit: 'contain', imageRendering: pixel ? 'pixelated' : undefined}}/>}
          </div> : null}
          <div style={{position: 'absolute', left: box.left, top: box.top, width: box.width, height: box.height, color: tokens.ink,
            display: 'flex', flexDirection: 'column', justifyContent: !whiteboard && (shot.id === 'illustrated-hero' && layer.type === 'node' || layer.type === 'metric') ? 'center' : 'flex-start',
            textAlign: box.image && !box.row ? 'center' : 'left', opacity: pixel ? p >= .2 ? 1 : 0 : 1, overflowWrap: 'anywhere'}}>
            {layer.type === 'metric' ? <div style={{fontFamily: tokens.displayFont, fontSize: box.metricFont, lineHeight: 1.1, color: tokens.accentAlt, fontVariantNumeric: 'tabular-nums'}}>{Number(((typeof layer.value === 'number' ? layer.value : 0) * count).toFixed(2))}<span style={{fontSize: 30, marginLeft: 12}}>{scene.visual?.unit}</span></div> : null}
            <div style={{fontFamily: tokens.displayFont, fontSize: box.label, lineHeight: 1.25, fontWeight: whiteboard ? 400 : 600, marginTop: layer.type === 'metric' ? 12 : 0}}>{layer.label}</div>
            {layer.text ? <div style={{marginTop: box.gap, fontSize: box.text, lineHeight: 1.35, color: tokens.muted}}>{layer.text}</div> : null}
            {highlight > 0 ? <svg aria-hidden width="100%" height="12" style={{display: 'block', marginTop: 8}}>
              {pixel ? <g><path d={`M8 6 H${Math.max(8, box.width * .75)}`} stroke={tokens.accentAlt} strokeWidth={4} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - highlight}/><rect x={Math.max(8, box.width * .75) + 10} y={2} width={8} height={8} fill={tokens.accent} opacity={pixelEmphasisOpacity(highlight)}/></g>
                : <path d={whiteboard ? `M8 6 L${Math.max(8, box.width * .75)} 6` : `M8 6 Q${box.width * .35} 12 ${Math.max(8, box.width * .75)} 5`} fill="none" stroke={tokens.accentAlt} strokeWidth={whiteboard ? 4 : 5} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - highlight}/>}
            </svg> : null}
          </div>
        </div>;
      })}
    </div>
  </ShotShell>;
}
