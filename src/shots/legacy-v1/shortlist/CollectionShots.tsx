import {PaperTape} from './StructureP1';
import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {ShotShell, type ShotRenderProps} from '../ShotShell';
import type {ShotPlan} from '../../compile-shot';
import {actionProgress, actionWindowProgress} from '../frame-state';

export function CollectionShots(props: ShotRenderProps & {plan: ShotPlan}) {
  const {scene, tokens, plan} = props;
  const frame = useCurrentFrame();
  const scale = useVideoConfig().width / 1920;
  const shot = scene.shot;
  if (shot?.id !== 'card-stack' && shot?.id !== 'concept-matrix' && shot?.id !== 'platform-hinge-rise') throw new Error('collection contract required');
  const unfold = shot.id === 'card-stack' ? actionProgress(plan, shot.slots.items[0]!, ['focus'], frame, 'smooth') : 1;
  return <ShotShell {...props}><div style={{position: 'relative', height: '100%', perspective: 1200 * scale}}>
    <div style={{position: 'absolute', inset: 0, clipPath: shot.id === 'platform-hinge-rise' ? 'inset(0 0 41% 0)' : undefined}}>
    {shot.slots.items.map((id, index) => {
      const layer = scene.layers.find((item) => item.id === id)!;
      const matrix = shot.id === 'concept-matrix';
      const hinge = shot.id === 'platform-hinge-rise';
      const p = hinge ? actionWindowProgress(plan, id, ['enter', 'reveal'], frame, 0.25, 1) : actionProgress(plan, id, ['enter', 'reveal'], frame);
      const finalX = matrix || hinge ? index % 2 * 51 : index * (100 / shot.slots.items.length);
      const rowY = matrix ? Math.floor(index / 2) * 51 : 0;
      const cardWidth = matrix || hinge ? 49 : 100 / shot.slots.items.length - 2;
      const x = shot.id === 'card-stack' ? (50 - cardWidth / 2) * (1 - unfold) + finalX * unfold : finalX;
      const content = matrix ? Math.max(0, (p - 0.4) / 0.6) : shot.id === 'card-stack' ? unfold : p;
      const outline = matrix ? Math.min(1, p / 0.4) : p;
      if (shot.id === 'concept-matrix' && shot.revealMode && shot.slots.fronts) {
        const front = scene.layers.find((item) => item.id === shot.slots.fronts![index])!;
        const frontP = actionProgress(plan, front.id, ['enter', 'reveal'], frame);
        const turn = actionWindowProgress(plan, id, ['enter', 'reveal'], frame, 0, .7) * 192 - actionWindowProgress(plan, id, ['enter', 'reveal'], frame, .7, 1) * 12;
        return <div key={id} style={{position: 'absolute', left: `${finalX}%`, top: `${rowY}%`, width: `${cardWidth}%`, height: '49%', perspective: 1200 * scale, opacity: frontP}}>
          <div style={{position: 'relative', height: '100%', transformStyle: 'preserve-3d', transform: `rotateY(${turn}deg)`}}>
            {[front, layer].map((face, faceIndex) => <div key={face.id} style={{position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: faceIndex ? 'rotateY(180deg)' : undefined, background: tokens.paper, border: tokens.surfaceBorder, padding: 24 * scale, boxSizing: 'border-box'}}><strong style={{display: 'block', fontSize: 30 * scale, lineHeight: 1.2}}>{face.label}</strong><div style={{fontSize: 26 * scale, lineHeight: 1.3, marginTop: 16 * scale}}>{face.text}</div></div>)}
          </div>
        </div>;
      }
      return <div key={id} style={{position: 'absolute', left: `${x}%`, top: `${rowY}%`, width: `${cardWidth}%`, height: matrix ? '49%' : hinge ? '58%' : '90%', background: matrix ? undefined : tokens.paper, border: matrix ? undefined : tokens.surfaceBorder, boxShadow: matrix ? undefined : tokens.surfaceShadow, boxSizing: 'border-box', padding: 24 * scale, opacity: matrix ? 1 : p, transformOrigin: hinge ? index === 0 ? 'right bottom' : 'left bottom' : 'center bottom', transform: hinge ? `translateY(${(1 - p) * 90 * scale}px) rotate(${(index ? 18 : -18) * (1 - p)}deg)` : shot.id === 'card-stack' ? `translateY(${(1 - p) * 200 * scale}px) rotate(${(index - (shot.slots.items.length - 1) / 2) * 5 * (1 - unfold)}deg)` : undefined}}>
        {matrix ? <div style={{position: 'absolute', inset: 0, background: tokens.paper, boxShadow: tokens.surfaceShadow, opacity: content, clipPath: shot.variant === 'wireframe-draw-on' ? `inset(0 ${100 * (1 - content)}% 0 0)` : undefined}} /> : null}
        {matrix ? <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}><rect x="1" y="1" width="98" height="98" fill="none" stroke={tokens.accent} strokeWidth="0.5" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - outline} opacity={outline > 0 ? 1 : 0} /></svg> : null}
        {shot.id === 'card-stack' && shot.treatment ? <PaperTape progress={actionProgress(plan, id, ['tape'], frame, 'smooth')} scale={scale} color={tokens.accentAlt} /> : null}
        <div style={{position: 'relative', opacity: content, clipPath: matrix && shot.variant === 'wireframe-draw-on' ? `inset(0 ${100 * (1 - content)}% 0 0)` : undefined, transform: matrix && shot.variant === 'bento-light-up' ? `translateY(${(1 - content) * 20 * scale}px)` : undefined}}>
          <div style={{fontSize: 22 * scale, color: tokens.accentAlt, marginBottom: 12 * scale}}>{String(index + 1).padStart(2, '0')}</div>
          <strong style={{display: 'block', fontSize: 30 * scale, lineHeight: 1.2, marginBottom: 16 * scale, overflowWrap: 'anywhere'}}>{layer.label}</strong>
          <div style={{fontSize: 26 * scale, lineHeight: 1.3, color: tokens.muted, overflowWrap: 'anywhere'}}>{layer.text}</div>
        </div>
      </div>;
    })}
    </div>
    {shot.id === 'platform-hinge-rise' ? (() => {
      const result = scene.layers.find((layer) => layer.id === shot.slots.result)!;
      const p = actionProgress(plan, result.id, ['enter', 'reveal'], frame);
      const base = actionWindowProgress(plan, shot.slots.items[0]!, ['enter', 'reveal'], frame, 0, 0.25);
      return <><div style={{position: 'absolute', top: '59%', width: '100%', height: 6 * scale, background: tokens.accentAlt, transform: `scaleX(${base})`}} /><div style={{position: 'absolute', top: '68%', width: '100%', padding: 18 * scale, boxSizing: 'border-box', borderTop: tokens.surfaceBorder, opacity: p, transform: `translateY(${(1 - p) * 60 * scale}px)`}}><strong style={{fontSize: 32 * scale}}>{result.label}</strong><div style={{fontSize: 26 * scale, color: tokens.muted, marginTop: 8 * scale}}>{result.text}</div></div></>;
    })() : null}
  </div></ShotShell>;
}
