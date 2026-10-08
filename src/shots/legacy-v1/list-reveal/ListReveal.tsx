import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {ShotShell, type ShotRenderProps} from '../ShotShell';
import type {ShotPlan} from '../../compile-shot';
import {actionProgress} from '../frame-state';

export function ListReveal(props: ShotRenderProps & {plan: ShotPlan}) {
  const {scene, tokens, plan} = props;
  const frame = useCurrentFrame();
  const scale = useVideoConfig().width / 1920;
  if (scene.shot?.id !== 'list-reveal') throw new Error('list-reveal contract required');
  return <ShotShell {...props}><div style={{height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 20 * scale}}>
    {scene.shot.slots.items.map((id, index) => {
      const item = scene.layers.find((layer) => layer.id === id)!;
      const p = actionProgress(plan, id, ['enter', 'reveal'], frame, 'back');
      return <div key={id} style={{display: 'flex', alignItems: 'center', gap: 28 * scale, padding: `${14 * scale}px ${32 * scale}px`, background: tokens.paper, border: tokens.surfaceBorder, boxShadow: tokens.surfaceShadow, opacity: Math.min(1, p * 2.2), transform: `translateY(${(1 - p) * 14 * scale}px) scale(${0.9 + p * 0.1})`, transformOrigin: 'left center'}}>
        <span style={{fontSize: 36 * scale, color: tokens.accentAlt, fontFamily: tokens.displayFont}}>{String(index + 1).padStart(2, '0')}</span>
        <strong style={{fontSize: 30 * scale, width: '28%', flexShrink: 0, lineHeight: 1.2, overflowWrap: 'anywhere'}}>{item.label}</strong>
        <span style={{minWidth: 0, flex: 1, fontSize: 26 * scale, lineHeight: 1.3, color: tokens.muted, overflowWrap: 'anywhere'}}>{item.text}</span>
      </div>;
    })}
  </div></ShotShell>;
}
