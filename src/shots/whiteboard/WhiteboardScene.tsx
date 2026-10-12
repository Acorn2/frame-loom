import React, {useId} from 'react';
import {Img, useCurrentFrame, useVideoConfig} from 'remotion';
import {ShotShell, type ShotRenderProps} from '../ShotShell';
import type {ShotPlan} from '../compile-shot';
import type {StoryboardBeat} from '../../schemas/storyboard';
import {isWhiteboardShot} from './schema';
import {whiteboardCanvas, whiteboardLayout, whiteboardType} from './layout';
import {drawingProgress, pathData, penPosition, roughPolyline, type Point} from './drawing';

export function WhiteboardScene(props: ShotRenderProps & {plan: ShotPlan}) {
  const {scene, tokens} = props, shot = scene.shot;
  const frame = useCurrentFrame(), {width, height, fps} = useVideoConfig(), uid = useId().replace(/:/gu, '');
  if (!shot || !isWhiteboardShot(shot)) throw new Error('Missing whiteboard contract');
  const canvas = whiteboardCanvas(width, height, tokens.safeArea, Boolean(tokens.layoutPolicy));
  const rects = whiteboardLayout(shot, canvas.width, canvas.height);
  const type = whiteboardType(shot);
  const hand = tokens.id === 'whiteboard' || tokens.id === 'scatterbrain';
  const roughness = hand ? 3 : .4;
  const beat = (target: string, action: string) => scene.beats.find(b => b.target === target && b.action === action)!;
  const progress = (b: StoryboardBeat) => drawingProgress(frame, b.start, b.duration);
  const paths = new Map<string, Point[]>();
  for (const id of shot.slots.items) {
    const r = rects.get(id)!;
    paths.set(`${id}/trace`, roughPolyline([{x: r.x, y: r.y}, {x: r.x + r.width, y: r.y},
      {x: r.x + r.width, y: r.y + r.height}, {x: r.x, y: r.y + r.height}, {x: r.x, y: r.y}], `${scene.id}/${id}`, roughness));
    const labelY = r.y + type.inset + type.label * .625;
    const textY = r.y + type.inset + type.label * 1.25 + type.gap + type.text * type.lineHeight / 2;
    paths.set(`${id}/reveal`, [{x: r.x + type.inset, y: labelY}, {x: r.x + r.width - type.inset, y: labelY},
      {x: r.x + type.inset, y: textY}, {x: r.x + r.width - type.inset, y: textY}]);
    paths.set(`${id}/highlight`, roughPolyline(Array.from({length: 33}, (_, i) => {
      const a = i / 32 * Math.PI * 2;
      return {x: r.x + r.width / 2 + (r.width / 2 - 12) * Math.cos(a), y: labelY + type.label * .84 * Math.sin(a)};
    }), `${id}/highlight`, roughness));
  }
  for (const link of scene.connections) {
    const a = rects.get(link.from)!, b = rects.get(link.to)!;
    const points = [{x: a.x + a.width + 8, y: a.y + a.height / 2}, {x: b.x - 10, y: b.y + b.height / 2}];
    paths.set(`${link.id}/draw`, roughPolyline(points, link.id, roughness));
  }
  if (shot.id === 'whiteboard-explain') {
    const r = rects.get(shot.slots.subject)!;
    paths.set(`${shot.slots.subject}/reveal`, [{x: r.x, y: r.y + r.height / 2}, {x: r.x + r.width, y: r.y + r.height / 2}]);
  }
  const pen = penPosition(frame, scene.beats.map(b => ({...b, points: paths.get(`${b.target}/${b.action}`)!})), Math.ceil(.8 * fps));
  const stroke = (points: Point[], p: number, color: string, key: string) => <g key={key} opacity={p > 0 ? 1 : 0}>
    <path d={pathData(points)} fill="none" stroke={color} strokeWidth={hand ? 3 : 2.5} strokeLinecap="round" strokeLinejoin="round"
      pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p}/>
    {hand ? <path d={pathData(roughPolyline(points, `${key}/second`, 1.5))} fill="none" stroke={color} opacity={.32}
      strokeWidth={1.2} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - Math.max(0, (p - .04) / .96)}/> : null}
  </g>;
  const wipe = (p: number): React.CSSProperties => ({opacity: p > 0 ? 1 : 0, clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`});
  return <ShotShell {...props}>
    <div style={{position: 'relative', width: canvas.width, height: canvas.height, transform: `scale(${canvas.scale})`, transformOrigin: 'top left'}}>
      {tokens.pattern === 'dots' ? <div aria-hidden style={{position: 'absolute', inset: 0, backgroundImage: `radial-gradient(${tokens.grid}66 1px, transparent 1px)`, backgroundSize: '36px 36px', pointerEvents: 'none'}}/> : null}
      <svg aria-hidden="true" width={canvas.width} height={canvas.height} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
        <defs><pattern id={`${uid}-hatch`} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><line x1="0" y1="0" x2="0" y2="12" stroke={tokens.accent} strokeWidth="2"/></pattern></defs>
        {shot.slots.items.map(id => {
          const r = rects.get(id)!, p = progress(beat(id, 'trace'));
          return <g key={id}>
            <rect x={r.x} y={r.y} width={r.width} height={r.height} fill={hand ? `url(#${uid}-hatch)` : tokens.accent}
              opacity={Math.max(0, p - .65) * (hand ? .22 : .12)}/>
            {stroke(paths.get(`${id}/trace`)!, p, tokens.ink, id)}
          </g>;
        })}
        {scene.connections.map(link => {
          const p = progress(beat(link.id, 'draw')), points = paths.get(`${link.id}/draw`)!, end = points.at(-1)!, prev = points.at(-2)!;
          const angle = Math.atan2(end.y - prev.y, end.x - prev.x);
          return <g key={link.id}>{stroke(points, p, tokens.accentAlt, link.id)}
            {p === 1 ? <path d={`M${end.x - 12 * Math.cos(angle - .5)} ${end.y - 12 * Math.sin(angle - .5)} L${end.x} ${end.y} L${end.x - 12 * Math.cos(angle + .5)} ${end.y - 12 * Math.sin(angle + .5)}`}
              stroke={tokens.accentAlt} strokeWidth="3" fill="none"/> : null}</g>;
        })}
      </svg>
      {shot.slots.items.map(id => {
        const r = rects.get(id)!, layer = scene.layers.find(layer => layer.id === id)!, p = progress(beat(id, 'reveal'));
        return <div key={id} data-layout-node={id} style={{position: 'absolute', left: r.x, top: r.y, width: r.width, height: r.height,
          boxSizing: 'border-box', padding: type.inset, overflowWrap: 'anywhere', opacity: frame >= beat(id, 'trace').start ? 1 : 0}}>
          <div style={{fontFamily: tokens.displayFont, fontSize: type.label, lineHeight: 1.25, color: tokens.ink, ...wipe(Math.min(1, p / .45))}}>{layer.label}</div>
          <div style={{marginTop: type.gap, fontSize: type.text, lineHeight: type.lineHeight, color: tokens.muted,
            ...wipe(Math.max(0, (p - .45) / .55))}}>{layer.text}</div>
        </div>;
      })}
      {shot.id === 'whiteboard-explain' ? (() => {
        const id = shot.slots.subject, r = rects.get(id)!, layer = scene.layers.find(layer => layer.id === id)!, p = progress(beat(id, 'reveal'));
        return <div data-layout-node={id} style={{position: 'absolute', left: r.x, top: r.y, width: r.width, height: r.height, ...wipe(p)}}>
          <Img src={layer.assetDataUri ?? layer.asset!} style={{width: '100%', height: `calc(100% - 64px)`, objectFit: 'contain'}}/>
          <div style={{fontFamily: tokens.displayFont, fontSize: 36, lineHeight: 1.3, textAlign: 'center', color: tokens.ink, overflowWrap: 'anywhere'}}>{layer.label}</div>
        </div>;
      })() : null}
      <svg aria-hidden="true" width={canvas.width} height={canvas.height} style={{position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none'}}>
        {scene.beats.filter(b => b.action === 'highlight').map(b => stroke(paths.get(`${b.target}/highlight`)!, progress(b), tokens.accentAlt, b.id))}
        {pen ? <g transform={`translate(${pen.x} ${pen.y}) rotate(${pen.x > canvas.width - 100 ? -90 : 90})`}><path d="M0 0 L-7 -18 L7 -18 Z" fill={tokens.ink}/><rect x="-7" y="-82" width="14" height="64" rx="3" fill={tokens.accent} stroke={tokens.ink} strokeWidth="2"/></g> : null}
      </svg>
    </div>
  </ShotShell>;
}
