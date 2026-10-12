import React from 'react';
import type {Rect} from '../../layout/scene-layout';
import type {StyleTokens} from '../../styles/style-loader';
import type {IllustratedShot} from './schema';

// All shapes are visual scaffolding; content and facts remain in declared slots.
export function IllustratedStage({shot, rects, width, height, tokens, progress}: {
  shot: IllustratedShot; rects: Map<string, Rect>; width: number; height: number;
  tokens: StyleTokens; progress: (id: string) => number;
}) {
  if (tokens.id === 'whiteboard') return null;
  const pixel = tokens.id === 'paper-collage';
  return <svg aria-hidden width={width} height={height} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
    {pixel ? <g>
      {Array.from({length: Math.ceil(height / 32)}, (_, i) => <path key={i} d={`M16 ${16 + i * 32} H${width - 16}`} stroke={tokens.grid} strokeOpacity={.35} strokeWidth={1}/>)}
      <path d={`M16 32 V16 H${width - 32} V32 H${width - 16} V${height - 32} H${width - 32} V${height - 16} H32 V${height - 32} H16 Z`} fill="none" stroke={tokens.ink} strokeWidth={2}/>
      <path d={`M40 16 H120 M${width - 120} ${height - 16} H${width - 40}`} stroke={tokens.accent} strokeWidth={8}/>
    </g> : null}
    {[...rects.entries()].map(([id, rect], index) => {
      const p = progress(id), subject = 'subject' in shot.slots && id === shot.slots.subject;
      if (p <= 0) return null;
      if (pixel) {
        const cut = subject ? 16 : 8, x = rect.x, y = rect.y, w = rect.width, h = rect.height;
        return <g key={id} opacity={Math.min(1, p * 4)}>
          <path d={`M${x + cut} ${y} H${x + w - cut} V${y + cut} H${x + w} V${y + h - cut} H${x + w - cut} V${y + h} H${x + cut} V${y + h - cut} H${x} V${y + cut} H${x + cut} Z`}
            fill={tokens.paper} stroke={tokens.grid} strokeWidth={2}/>
          <rect x={x + 16} y={y + 12} width={8} height={8} fill={tokens.accent}/>
          {!subject ? <path d={`M${x + 30} ${y + 16} H${x + 64}`} stroke={tokens.accent} strokeWidth={2}/> : null}
        </g>;
      }
      if (!subject && !['illustrated-compare', 'illustrated-process', 'illustrated-breakdown'].includes(shot.id)) return <g key={id} opacity={p}>
        <path d={`M${rect.x + 20} ${rect.y + rect.height - 8} Q${rect.x + rect.width * .5} ${rect.y + rect.height - 20} ${rect.x + rect.width - 20} ${rect.y + rect.height - 10}`}
          fill="none" stroke={tokens.accent} strokeOpacity={.55} strokeWidth={4} strokeLinecap="round"/>
      </g>;
      const x = rect.x + 8, y = rect.y + 12, w = rect.width - 16, h = subject ? rect.height - 48 : rect.height * .61;
      return <g key={id} opacity={1 - (1 - p) ** 3}>
        <path d={`M${x + w * .12} ${y + h * .12} C${x + w * .40} ${y - 12},${x + w * .95} ${y + h * .04},${x + w * .96} ${y + h * .40} C${x + w + 12} ${y + h * .84},${x + w * .68} ${y + h},${x + w * .30} ${y + h * .91} C${x - 12} ${y + h * .88},${x - 12} ${y + h * .35},${x + w * .12} ${y + h * .12} Z`}
          fill={tokens.accent} fillOpacity={index % 2 ? .08 : .13}/>
        <path d={`M${x + w * .12} ${y + h * .85} Q${x + w * .5} ${y + h * .99} ${x + w * .88} ${y + h * .86}`}
          fill="none" stroke={tokens.ink} strokeOpacity={.45} strokeWidth={2} strokeLinecap="round"/>
      </g>;
    })}
  </svg>;
}
