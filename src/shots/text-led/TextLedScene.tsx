import React from 'react';
import {Img, useCurrentFrame, useVideoConfig} from 'remotion';
import type {ShotPlan} from '../compile-shot';
import {ShotShell, type ShotRenderProps} from '../ShotShell';
import type {StoryboardLayer} from '../../schemas/storyboard';
import type {TextLedPlacement} from './schema';
import {isTextLedShot} from './schema';
import {textLedPlacementAt, textLedProgress, textLedStageAt, textLedStageFrames, textLedWeight} from './layout';

function textWidth(value: string, size: number, weight: number, family: string) {
  const context = document.createElement('canvas').getContext('2d')!;
  context.font = `${weight} ${size}px ${family}`;
  return context.measureText(value).width;
}
function contentBox(layer: StoryboardLayer, box: TextLedPlacement, font: string) {
  const rows = `${layer.label}${layer.text ? `\n${layer.text}` : ''}`.split('\n');
  const width = Math.max(...rows.map(row => textWidth(row, box.fontSize, textLedWeight(box.weight), font)));
  return {x: box.x + (box.align === 'center' ? (box.width - width) / 2 : box.align === 'right' ? box.width - width : 0),
    y: box.y, width, height: rows.length * box.fontSize * 1.35};
}
function routeBetween(a: ReturnType<typeof contentBox>, b: ReturnType<typeof contentBox>) {
  const vertical = Math.abs((a.y + a.height / 2) - (b.y + b.height / 2)) > Math.abs((a.x + a.width / 2) - (b.x + b.width / 2));
  const below = b.y + b.height / 2 > a.y + a.height / 2, right = b.x + b.width / 2 > a.x + a.width / 2;
  const points: [number, number][] = vertical ? [[a.x + a.width / 2, below ? a.y + a.height + 16 : a.y - 16], [b.x + b.width / 2, below ? b.y - 16 : b.y + b.height + 16]]
    : [[right ? a.x + a.width + 22 : a.x - 22, a.y + a.height / 2], [right ? b.x - 22 : b.x + b.width + 22, b.y + b.height / 2]];
  return {points, path: `M${points[0]!.join(' ')} L${points[1]!.join(' ')}`};
}
const pathOf = (points: [number, number][]) => points.length === 3 ? `M${points[0]!.join(' ')} Q${points[1]!.join(' ')} ${points[2]!.join(' ')}` : `M${points.map(p => p.join(' ')).join(' L')}`;

export function TextLedScene(props: ShotRenderProps & {plan: ShotPlan}) {
  const {scene, tokens} = props, frame = useCurrentFrame(), {width} = useVideoConfig(), shot = scene.shot;
  if (!shot || !isTextLedShot(shot)) throw new Error('TextLedScene requires a text-led shot');
  const scale = width / 1920, family = tokens.bodyFont, activeStage = textLedStageAt(scene, shot, frame);
  const stageFrames = textLedStageFrames(scene, shot);
  const progress = (target: string, action: string) => {const beat = scene.beats.find(b => b.target === target && b.action === action); return beat ? textLedProgress(frame, beat.start, beat.duration) : 0;};
  const marker = `${scene.id}-text-arrow`;
  const placements = new Map(scene.layers.map(layer => [layer.id, textLedPlacementAt(scene, shot, layer.id, frame)]));
  return <ShotShell {...props} ownTitle fullCanvas>
    <div style={{position: 'absolute', inset: 0, width: 1920, height: 1080, transform: `scale(${scale})`, transformOrigin: 'top left'}}>
      {scene.layers.map(layer => {
        const e = shot.elements[layer.id]!, box = placements.get(layer.id)!, opacity = box.opacity * progress(layer.id, 'reveal');
        return <div key={layer.id} data-layout-node={layer.id} style={{position: 'absolute', left: box.x, top: box.y, width: box.width, height: box.height,
          opacity, color: tokens[box.color], fontFamily: family, fontSize: box.fontSize, fontWeight: textLedWeight(box.weight), lineHeight: 1.35, textAlign: box.align, whiteSpace: 'pre'}}>
          {e.kind === 'sticker' ? <><Img src={layer.assetDataUri ?? layer.asset!} style={{display: 'block', width: '100%', height: Math.max(1, box.height - box.fontSize * 1.35), objectFit: 'contain'}}/><div data-layout-text-group style={{textAlign: 'center', color: tokens.muted}}>{layer.label}</div></>
            : <span data-layout-text-group>{layer.label}{layer.text ? `\n${layer.text}` : ''}</span>}
        </div>;
      })}
      <svg aria-hidden width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        <defs><marker id={marker} viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto"><path d="M1 1 L9 5 L1 9" fill="none" stroke={tokens.accent} strokeWidth={1.3}/></marker></defs>
        {shot.id === 'annotated-manuscript' ? Object.entries(shot.annotations).map(([id, mark]) => {
          const layer = scene.layers.find(l => l.id === id)!, e = shot.elements[id]!, p = progress(id, 'highlight');
          const label = layer.label ?? '', before = label.slice(0, label.indexOf(mark.phrase)).split('\n'), row = before.length - 1;
          const prefix = textWidth(before.at(-1)!, e.fontSize, textLedWeight(e.weight), family);
          const span = textWidth(mark.phrase, e.fontSize, textLedWeight(e.weight), family);
          const rowWidth = textWidth(label.split('\n')[row]!, e.fontSize, textLedWeight(e.weight), family);
          const x = e.x + (e.align === 'center' ? (e.width - rowWidth) / 2 : e.align === 'right' ? e.width - rowWidth : 0) + prefix;
          const y = e.y + row * e.fontSize * 1.35;
          const cy = y + e.fontSize * .72, cx = x + span / 2, rx = span / 2 + 12, ry = e.fontSize * .64;
          const d = mark.kind === 'circle' ? `M${cx + rx} ${cy} A${rx} ${ry} 0 1 1 ${cx - rx} ${cy} A${rx} ${ry} 0 1 1 ${cx + rx} ${cy}`
            : `M${x} ${y + e.fontSize * 1.3} Q${x + span * .48} ${y + e.fontSize * 1.36} ${x + span} ${y + e.fontSize * 1.3}`;
          return <path key={id} d={d} fill="none" stroke={tokens[mark.color]} strokeWidth={mark.kind === 'circle' ? 3 : 4} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} opacity={p > 0 ? 1 : 0}/>;
        }) : null}
        {scene.connections.map(link => {
          const p = progress(link.id, 'draw'), spec = shot.routes[link.id]!, routeStage = shot.id === 'editorial-flow' ? shot.routes[link.id]!.stage : 0;
          const next = stageFrames[routeStage], opacity = shot.id === 'editorial-flow' ? activeStage < routeStage ? 0 : next ? 1 - textLedProgress(frame, next.start, Math.min(next.duration, 18)) : 1 : 1;
          const points = shot.id === 'annotated-manuscript' ? shot.routes[link.id]!.points : undefined;
          const boxes = shot.id === 'editorial-flow' ? routeStage === 0 ? shot.elements : shot.stages[routeStage - 1]!.placements : undefined;
          const route = points ? {points, path: pathOf(points)} : routeBetween(contentBox(scene.layers.find(l => l.id === link.from)!, boxes![link.from]!, family), contentBox(scene.layers.find(l => l.id === link.to)!, boxes![link.to]!, family));
          const from = route.points[0]!, to = route.points.at(-1)!;
          return <g key={link.id} opacity={p > 0 ? opacity : 0}>
            <path d={route.path} fill="none" stroke={tokens.accent} strokeWidth={2.5} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} markerEnd={spec.arrow && p === 1 ? `url(#${marker})` : undefined}/>
            {shot.id === 'editorial-flow' && shot.routes[link.id]!.track && p > 0 && p < 1 ? <circle cx={from[0] + (to[0] - from[0]) * p} cy={from[1] + (to[1] - from[1]) * p} r={6} fill={tokens.accent}/> : null}
          </g>;
        })}
      </svg>
    </div>
  </ShotShell>;
}
