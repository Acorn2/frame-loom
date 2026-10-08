import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {ShotShell, type ShotRenderProps} from '../ShotShell';
import type {ShotPlan} from '../../compile-shot';
import {actionProgress} from '../frame-state';

// Method reference: Shotcraft doc-park-left-pill-deal. Independent implementation;
// provenance.json records the source and omitted scroll/caption/pill effects.
export function DocumentConclusions(props: ShotRenderProps & {plan: ShotPlan}) {
  const {scene, tokens, plan} = props;
  const frame = useCurrentFrame();
  const scale = useVideoConfig().width / 1920;
  if (scene.shot?.id !== 'document-conclusions') throw new Error('document-conclusions contract required');
  const sourceId = scene.shot.slots.source;
  const source = scene.layers.find((layer) => layer.id === sourceId)!;
  const items = scene.shot.slots.items.map((id) => scene.layers.find((layer) => layer.id === id)!);
  const park = actionProgress(plan, source.id, ['dock'], frame, 'smooth');
  const sourceIn = actionProgress(plan, source.id, ['enter', 'reveal'], frame);
  return <ShotShell {...props}>
    <div style={{position: 'absolute', left: `${24 * (1 - park)}%`, top: '2%', width: `${54 - 18 * park}%`, height: '94%', padding: `${26 * scale}px ${30 * scale}px`, boxSizing: 'border-box', background: tokens.paper, border: tokens.surfaceBorder, boxShadow: tokens.surfaceShadow, opacity: sourceIn, transform: `translateY(${(1 - sourceIn) * tokens.motion.enterOffset * scale}px)`}}>
      <div style={{fontSize: 17 * scale, color: tokens.accentAlt, borderBottom: `2px solid ${tokens.grid}`, paddingBottom: 12 * scale}}>原文摘录 / {source.label}</div>
      <div style={{fontFamily: tokens.displayFont, fontSize: 29 * scale, fontWeight: 700, lineHeight: 1.38, marginTop: 22 * scale, overflowWrap: 'anywhere'}}>{source.text}</div>
      <div style={{position: 'absolute', bottom: 20 * scale, left: 30 * scale, right: 30 * scale, borderTop: `2px solid ${tokens.grid}`, paddingTop: 10 * scale, fontSize: 17 * scale, color: tokens.muted}}>来源：{scene.visual?.source}</div>
    </div>
    {items.map((item, index) => {
      const reveal = actionProgress(plan, item.id, ['enter', 'reveal'], frame, 'back');
      const link = scene.connections.find((connection) => connection.to === item.id)!;
      const draw = actionProgress(plan, link.id, ['draw'], frame);
      return <React.Fragment key={item.id}>
        <div style={{position: 'absolute', left: '36%', top: `${16 + index * 32}%`, width: '12%', height: 3 * scale, background: tokens.accentAlt, transform: `scaleX(${draw})`, transformOrigin: 'left'}} />
        <div style={{position: 'absolute', left: '49%', top: `${2 + index * 32}%`, width: '50%', height: '27%', display: 'flex', alignItems: 'center', gap: 24 * scale, padding: `${12 * scale}px ${24 * scale}px`, boxSizing: 'border-box', background: tokens.paper, border: tokens.surfaceBorder, borderLeft: `${8 * scale}px solid ${tokens.accent}`, opacity: Math.min(1, reveal * 2.2), transform: `translateY(${(1 - reveal) * 24 * scale}px) scale(${0.94 + 0.06 * reveal})`}}>
          <span style={{fontFamily: tokens.displayFont, fontSize: 48 * scale, color: tokens.accentAlt}}>{String(index + 1).padStart(2, '0')}</span>
          <div style={{minWidth: 0}}><div style={{fontSize: 31 * scale, fontWeight: 800, lineHeight: 1.1}}>{item.label}</div><div style={{fontSize: 21 * scale, color: tokens.muted, marginTop: 7 * scale, lineHeight: 1.25, overflowWrap: 'anywhere'}}>{item.text}</div></div>
        </div>
      </React.Fragment>;
    })}
  </ShotShell>;
}
