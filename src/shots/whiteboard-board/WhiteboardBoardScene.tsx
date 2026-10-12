import React, {useEffect, useMemo, useState} from 'react';
import {cancelRender, continueRender, delayRender, Img, useCurrentFrame, useVideoConfig} from 'remotion';
import {ShotShell, type ShotRenderProps} from '../ShotShell';
import type {ShotPlan} from '../compile-shot';
import type {StoryboardLayer} from '../../schemas/storyboard';
import type {BoardElement} from './schema';
import {boardArrow, boardShape, BOARD_FILLS, clamp, strokeProgress, textSeconds, travelTip, type StrokePart} from './drawing';
import {drawingProgress, pointOnPath, type Point} from '../whiteboard/drawing';

type TextLine = {text: string; width: number; x: number; y: number; from: number; to: number};
function textGeometry(element: BoardElement, layer: StoryboardLayer) {
  const sticker = element.kind === 'sticker', checkbox = element.kind === 'checkbox';
  const size = sticker ? element.labelSize : element.fontSize;
  const value = `${layer.label}${layer.text ? `\n${layer.text}` : ''}`;
  return {size, value, x: element.x + (checkbox ? 58 : 0), y: sticker ? element.y + element.height - size * 1.3 : element.y + (['rectangle', 'ellipse'].includes(element.kind) ? (element.height - value.split('\n').length * size * 1.3) / 2 : 0), width: element.width - (checkbox ? 58 : ['rectangle', 'ellipse'].includes(element.kind) ? 40 : 0), align: sticker ? 'center' : element.align};
}
export function WhiteboardBoardScene(props: ShotRenderProps & {plan: ShotPlan}) {
  const {scene, tokens} = props, shot = scene.shot, frame = useCurrentFrame(), {width, fps} = useVideoConfig();
  if (shot?.id !== 'whiteboard-board') throw new Error('Whiteboard board contract required');
  const [handle] = useState(() => delayRender('Measure whiteboard writing with selected font'));
  const [lines, setLines] = useState<Record<string, TextLine[]>>({});
  useEffect(() => {let live = true;
    document.fonts.ready.then(() => {
      if (!live) return;
      const context = document.createElement('canvas').getContext('2d')!;
      const measured: Record<string, TextLine[]> = {};
      for (const layer of scene.layers) {
        const element = shot.elements[layer.id]!, box = textGeometry(element, layer);
        context.font = `400 ${box.size}px ${tokens.bodyFont}`;
        const textLines = box.value.split('\n'), seconds = textLines.map(t => textSeconds(t, box.size));
        const total = seconds.reduce((sum, s) => sum + s, 0) || 1; let cursor = 0;
        measured[layer.id] = textLines.map((text, i) => {
          const w = context.measureText(text).width;
          if (w > box.width) throw new Error(`${scene.id}/${layer.id}: actual selected-font text exceeds whiteboard element width`);
          const x = box.x + (box.align === 'center' ? (element.width - w) / 2 : box.align === 'right' ? box.width - w : 0);
          const line = {text, width: w, x, y: box.y + i * box.size * 1.3, from: cursor / total, to: (cursor + seconds[i]!) / total}; cursor += seconds[i]!; return line;
        });
      }
      setLines(measured); continueRender(handle);
    }).catch(cancelRender);
    return () => {live = false;};
  }, [handle, scene.id, scene.layers, shot.elements, tokens.bodyFont]);
  const colors = {ink: tokens.ink, muted: tokens.muted, accent: tokens.accentAlt, negative: '#c92a2a'};
  const shapes = useMemo(() => Object.fromEntries(Object.entries(shot.elements).map(([id, element]) => [id, boardShape(element, `${scene.id}/${id}`, colors[element.kind === 'sticker' ? 'ink' : element.color])])), [shot.elements, scene.id, tokens.ink, tokens.muted, tokens.accentAlt]);
  const routes = useMemo(() => Object.fromEntries(Object.entries(shot.routes).map(([id, route]) => [id, boardArrow(route, `${scene.id}/${id}`, colors[route.color])])), [shot.routes, scene.id, tokens.ink, tokens.muted, tokens.accentAlt]);
  const stage = (id: string) => scene.beats.find(b => b.target === id)!;
  const progress = (id: string) => {const b = stage(id); return drawingProgress(frame, b.start, b.duration);};
  const tips: Point[] = [], travels: {start: number; duration: number; first: Point; last: Point}[] = [];
  const strokes = (parts: StrokePart[], p: number, key: string) => strokeProgress(parts, p).map((part, i) => {
    if (part.tip) tips.push(part.tip);
    return <g key={`${key}-${i}`} opacity={part.p > 0 ? 1 : 0}>
      <path d={part.d} stroke={part.color} strokeWidth={part.width} strokeLinecap="round" strokeLinejoin="round" fill="none" pathLength={1} strokeDasharray={part.dashed ? '.015 .01' : 1} strokeDashoffset={part.dashed ? 0 : 1 - part.p} opacity={part.dashed ? part.p : 1}/>
      {part.secondD ? <path d={part.secondD} stroke={part.color} strokeWidth={part.width} strokeLinecap="round" fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - part.secondProgress} opacity={part.secondProgress > 0 ? 1 : 0}/> : null}
    </g>;
  });
  const body = scene.layers.map(layer => {
    const e = shot.elements[layer.id]!, p = progress(layer.id), b = stage(layer.id), box = textGeometry(e, layer);
    const outline = shapes[layer.id]!, shape = outline.length > 0;
    const solid = shape && e.kind !== 'text' && e.kind !== 'sticker' && e.fillStyle === 'solid' && e.fill !== 'none';
    const fillStart = e.kind === 'checkbox' ? .21 : .30, fillEnd = e.kind === 'checkbox' ? .30 : .42;
    const outlineEnd = solid ? fillStart : e.kind === 'checkbox' ? .30 : .42;
    const textProgress = shape ? clamp((p - .42) / .58) : e.kind === 'sticker' ? clamp((p - .8) / .2) : p;
    const textLines = lines[layer.id] ?? [];
    const first = e.kind === 'sticker' ? {x: e.x, y: e.y + e.height * .45} : shape ? outline[0]!.points[0]! : {x: textLines[0]?.x ?? e.x, y: e.y + box.size * .65};
    const lastLine = textLines.at(-1);
    travels.push({...b, first, last: {x: (lastLine?.x ?? e.x) + (lastLine?.width ?? e.width), y: (lastLine?.y ?? e.y) + box.size * .65}});
    const imageProgress = clamp(p / .8), imageHeight = e.height - (e.kind === 'sticker' ? e.labelSize * 1.3 : 0);
    if (e.kind === 'sticker' && imageProgress > 0 && imageProgress < 1) tips.push({x: e.x + e.width * imageProgress, y: e.y + imageHeight * (.5 + .4 * Math.sin(imageProgress * Math.PI * 7))});
    const check = clamp((p - .30) / .12);
    if (solid && p > fillStart && p < fillEnd) tips.push(outline.at(-1)!.points.at(-1)!);
    if (e.kind === 'checkbox' && check > 0 && check < 1) tips.push(pointOnPath([{x: e.x + 7, y: e.y + 29}, {x: e.x + 15, y: e.y + 37}, {x: e.x + 31, y: e.y + 18}], check));
    return <React.Fragment key={layer.id}>
      {shape ? <svg aria-hidden width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        {solid ? e.kind === 'ellipse' ? <ellipse cx={e.x + e.width / 2} cy={e.y + e.height / 2} rx={e.width / 2} ry={e.height / 2} fill={BOARD_FILLS[e.fill]} opacity={clamp((p - fillStart) / (fillEnd - fillStart)) * .65}/> : <rect x={e.x} y={e.y + (e.kind === 'checkbox' ? 8 : 0)} width={e.kind === 'checkbox' ? 38 : e.width} height={e.kind === 'checkbox' ? 38 : e.height} rx={e.kind === 'checkbox' ? 5 : 22} fill={BOARD_FILLS[e.fill]} opacity={clamp((p - fillStart) / (fillEnd - fillStart)) * .65}/> : null}
        {strokes(outline, clamp(p / outlineEnd), layer.id)}
        {e.kind === 'checkbox' ? <path d={`M${e.x + 7} ${e.y + 29} l8 8 l16 -19`} fill="none" stroke={tokens.accentAlt} strokeWidth={3} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - clamp((p - .30) / .12)} opacity={p > .3 ? 1 : 0}/> : null}
      </svg> : null}
      {e.kind === 'sticker' ? <div data-layout-node={layer.id} style={{position: 'absolute', left: e.x, top: e.y, width: e.width, height: imageHeight, opacity: imageProgress > 0 ? 1 : 0, clipPath: `inset(0 ${(1 - imageProgress) * 100}% 0 0)`}}><Img src={layer.assetDataUri ?? layer.asset!} style={{width: '100%', height: '100%', objectFit: 'contain'}}/></div> : null}
      <div data-layout-node={e.kind === 'sticker' ? `${layer.id}-label` : layer.id} style={{position: 'absolute', left: e.x, top: box.y, width: e.width, height: e.height - (box.y - e.y), opacity: textProgress > 0 ? 1 : 0}}>
        {textLines.map((line, index) => {const f = clamp((textProgress - line.from) / (line.to - line.from || 1));
          if (f > 0 && f < 1) tips.push({x: line.x + line.width * f, y: line.y + box.size * .65});
          return <div data-layout-text-group key={index} style={{position: 'absolute', left: line.x - e.x, top: line.y - box.y, width: line.width + 4, height: box.size * 1.3, fontFamily: tokens.bodyFont, fontSize: box.size, lineHeight: 1.3, fontWeight: 400, whiteSpace: 'pre', color: colors[e.kind === 'sticker' ? 'muted' : e.color], opacity: f > 0 ? 1 : 0, clipPath: `inset(0 ${(1 - f) * 100}% 0 0)`}}>{line.text}</div>;
        })}
      </div>
    </React.Fragment>;
  });
  const arrows = scene.connections.map(link => {
    const parts = routes[link.id]!, beat = stage(link.id);
    travels.push({...beat, first: parts[0]!.points[0]!, last: parts.at(-1)!.points.at(-1)!});
    return <g key={link.id}>{strokes(parts, progress(link.id), link.id)}</g>;
  });
  const pen = tips.at(-1) ?? travelTip(frame, travels, fps), scale = width / 1920;
  return <ShotShell {...props} ownTitle fullCanvas>
    <div style={{position: 'absolute', inset: 0, width: 1920, height: 1080, transform: `scale(${scale})`, transformOrigin: 'top left'}}>
      <div aria-hidden style={{position: 'absolute', inset: 0, backgroundImage: `radial-gradient(${tokens.grid} 1.6px, transparent 1.6px)`, backgroundSize: '40px 40px', backgroundPosition: '20px 20px', opacity: .58}}/>
      {body}
      <svg aria-hidden width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>{arrows}
        {pen ? <g transform={`translate(${pen.x} ${pen.y})`}><ellipse cx="6" cy="6" rx="9" ry="4" fill="#000" opacity=".10"/><g transform="rotate(40)"><rect x="-9" y="-70" width="18" height="60" rx="3" fill="#f5b942" stroke={tokens.ink} strokeWidth="2"/><polygon points="-9,-10 9,-10 0,4" fill="#f1d9b5" stroke={tokens.ink} strokeWidth="2"/><polygon points="-3,-4 3,-4 0,4" fill={tokens.ink}/><rect x="-9" y="-80" width="18" height="12" rx="3" fill="#e57373" stroke={tokens.ink} strokeWidth="2"/></g></g> : null}
      </svg>
    </div>
  </ShotShell>;
}
