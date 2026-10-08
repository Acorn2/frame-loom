import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {ShotShell, type ShotRenderProps} from '../ShotShell';
import type {ShotPlan} from '../../compile-shot';
import {actionProgress} from '../frame-state';
import {hierarchyLayout} from './relation-layout';

export function RelationShots(props: ShotRenderProps & {plan: ShotPlan}) {
  const {scene, tokens, plan} = props;
  const frame = useCurrentFrame();
  const scale = useVideoConfig().width / 1920;
  const shot = scene.shot;
  if (shot?.id !== 'source-converge' && shot?.id !== 'diagram-cascade') throw new Error('relation contract required');
  const positions = shot.id === 'diagram-cascade' ? hierarchyLayout(scene) : new Map<string, {x: number; y: number; width: number; height: number}>([
    ...shot.slots.items.map((id, index) => [id, {x: 0, y: index * 500 / shot.slots.items.length, width: 310, height: 500 / shot.slots.items.length - 20}] as const),
    [shot.slots.result, {x: 680, y: 170, width: 320, height: 170}] as const
  ]);
  return <ShotShell {...props}><div style={{height: '100%', position: 'relative'}}>
    <svg viewBox="0 0 1000 500" preserveAspectRatio="none" style={{position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible'}}>
      {scene.connections.map((link) => {
        const from = positions.get(link.from)!; const to = positions.get(link.to)!;
        const p = actionProgress(plan, link.id, ['draw'], frame);
        const y1 = from.y + from.height / 2; const y2 = to.y + to.height / 2;
        const x1 = from.x + from.width; const x2 = to.x;
        const d = shot.id === 'source-converge' ? `M${x1} ${y1} C480 ${y1} 510 ${y2} ${x2} ${y2}` : `M${from.x + from.width / 2} ${from.y + from.height} V${(from.y + from.height + to.y) / 2} H${to.x + to.width / 2} V${to.y}`;
        return <g key={link.id} opacity={p > 0 ? 1 : 0}><path d={d} fill="none" stroke={tokens.accentAlt} strokeWidth="2" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - p} />{p >= 1 ? <path d={shot.id === 'source-converge' ? `M${x2 - 8} ${y2 - 5} L${x2} ${y2} L${x2 - 8} ${y2 + 5}` : `M${to.x + to.width / 2 - 5} ${to.y - 8} L${to.x + to.width / 2} ${to.y} L${to.x + to.width / 2 + 5} ${to.y - 8}`} fill="none" stroke={tokens.accentAlt} strokeWidth="2" /> : null}</g>;
      })}
    </svg>
    {[...positions].map(([id, box]) => {
      const layer = scene.layers.find((item) => item.id === id)!;
      const p = actionProgress(plan, id, ['enter', 'reveal'], frame);
      return <div key={id} style={{position: 'absolute', left: `${box.x / 10}%`, top: `${box.y / 5}%`, width: `${box.width / 10}%`, height: `${box.height / 5}%`, boxSizing: 'border-box', background: tokens.paper, border: tokens.surfaceBorder, padding: `${12 * scale}px ${18 * scale}px`, display: 'flex', flexDirection: 'column', justifyContent: 'center', opacity: p, transform: shot.id === 'diagram-cascade' ? `scale(${0.9 + 0.1 * p})` : `translateX(${(1 - p) * -20 * scale}px)`}}><strong style={{fontSize: 28 * scale, lineHeight: 1.15, overflowWrap: 'anywhere'}}>{layer.label}</strong><span style={{fontSize: 23 * scale, lineHeight: 1.25, color: tokens.muted, marginTop: 8 * scale, overflowWrap: 'anywhere'}}>{layer.text}</span></div>;
    })}
  </div></ShotShell>;
}
