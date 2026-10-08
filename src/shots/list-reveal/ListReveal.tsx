import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {ShotShell, type ShotRenderProps} from '../ShotShell';
import type {ShotPlan} from '../compile-shot';
import {listType} from '../type-scale';
import {beatProgress, curves} from '../motion';

export function ListReveal(props: ShotRenderProps & {plan: ShotPlan}) {
  const {scene, tokens, plan} = props;
  const frame = useCurrentFrame();
  const scale = useVideoConfig().width / 1920;
  if (scene.shot?.id !== 'list-reveal') throw new Error('list-reveal contract required');
  const compact = scene.shot.slots.items.length === 4;
  const type = listType(scene.shot.slots.items.map(id => scene.layers.find(layer => layer.id === id)!));
  return <ShotShell {...props}><div style={{height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '88%', margin: '0 auto', gap: (compact ? 20 : 26) * scale}}>
    {scene.shot.slots.items.map((id, index) => {
      const item = scene.layers.find((layer) => layer.id === id)!;
      const p = beatProgress(plan, id, ['enter', 'reveal'], frame, curves.back);
      return <div key={id} style={{position: 'relative', display: 'flex', alignItems: 'center', gap: 28 * scale, padding: `${(compact ? 20 : 24) * scale}px ${32 * scale}px`, color: tokens.ink, background: tokens.paper, border: tokens.surfaceBorder, borderRadius: 16 * scale, boxShadow: tokens.surfaceShadow, opacity: Math.min(1, p * 2.2), transform: `translateY(${(1 - p) * 14 * scale}px) scale(${0.78 + p * 0.22})`, transformOrigin: 'left center'}}>
        <div aria-hidden style={{position: 'absolute', left: 0, top: '24%', bottom: '24%', width: 4 * scale, background: index % 2 ? tokens.accent : tokens.accentAlt, borderRadius: 4 * scale}} />
        <span style={{fontSize: 40 * scale, color: tokens.accentAlt, fontFamily: tokens.displayFont}}>{String(index + 1).padStart(2, '0')}</span>
        <strong style={{fontSize: type.label * scale, width: '28%', flexShrink: 0, lineHeight: 1.2, overflowWrap: 'anywhere'}}>{item.label}</strong>
        <span style={{minWidth: 0, flex: 1, fontSize: type.text * scale, lineHeight: 1.3, color: tokens.muted, overflowWrap: 'anywhere'}}>{item.text}</span>
      </div>;
    })}
  </div></ShotShell>;
}
