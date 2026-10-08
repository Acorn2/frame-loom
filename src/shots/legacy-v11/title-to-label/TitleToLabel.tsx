import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {ShotShell, type ShotRenderProps} from '../ShotShell';
import type {ShotPlan} from '../../compile-shot';
import {beatProgress, curves} from '../../motion';
import {actionProgress} from '../../frame-state';

export function TitleToLabel(props: ShotRenderProps & {plan: ShotPlan}) {
  const {scene, tokens, plan} = props;
  const frame = useCurrentFrame();
  const scale = useVideoConfig().width / 1920;
  if (scene.shot?.id !== 'title-to-label') throw new Error('title-to-label contract required');
  const {title, items} = scene.shot.slots;
  const reveal = actionProgress(plan, title, ['enter', 'reveal'], frame);
  const demote = beatProgress(plan, title, ['demote'], frame, curves.handoff);
  return <ShotShell {...props} ownTitle>
    <div style={{position: 'absolute', left: `${50 * (1 - demote)}%`, top: `${45 - 39 * demote}%`, transform: `translate(${-50 * (1 - demote)}%, -50%) scale(${1 - 0.7 * demote})`, transformOrigin: 'left center', whiteSpace: 'nowrap', fontFamily: tokens.displayFont, fontSize: 112 * scale, fontWeight: 800, opacity: reveal, filter: `blur(${(1 - reveal) * 10 * scale}px)`}}>{scene.title}</div>
    <div style={{position: 'absolute', left: 0, right: 0, top: '22%', bottom: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 * scale}}>
      {items.map((id, index) => {
        const item = scene.layers.find((layer) => layer.id === id)!;
        const p = actionProgress(plan, id, ['enter', 'reveal'], frame);
        return <div key={id} style={{background: tokens.paper, borderTop: `3px solid ${tokens.accentAlt}`, padding: 28 * scale, opacity: p, transform: `translateY(${(1 - p) * 28 * scale}px) scaleX(${0.35 + p * 0.65})`, transformOrigin: 'left', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 15 * scale}}><span style={{color: tokens.accentAlt, fontSize: 24 * scale}}>0{index + 1}</span><strong style={{fontSize: 44 * scale}}>{item.label}</strong><span style={{fontSize: 28 * scale, lineHeight: 1.35, color: tokens.muted}}>{item.text}</span></div>;
      })}
    </div>
  </ShotShell>;
}
