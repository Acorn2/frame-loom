import {PaperTape} from './StructureP1';
import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {ShotShell, type ShotRenderProps} from '../ShotShell';
import type {ShotPlan} from '../compile-shot';
import {beatProgress, curves, fanPose, beatSpring} from '../motion';
import {mixColor} from '../appearance';
import {actionProgress, actionWindowProgress} from '../frame-state';

export function CollectionShots(props: ShotRenderProps & {plan: ShotPlan}) {
  const {scene, tokens, plan} = props;
  const frame = useCurrentFrame();
  const {width, fps} = useVideoConfig();
  const scale = width / 1920;
  const shot = scene.shot;
  if (shot?.id !== 'card-stack' && shot?.id !== 'concept-matrix' && shot?.id !== 'platform-hinge-rise') throw new Error('collection contract required');
  const unfold = shot.id === 'card-stack' ? beatProgress(plan, shot.slots.items[0]!, ['focus'], frame, curves.fan) : 1;
  return <ShotShell {...props}><div style={{position: 'relative', height: '100%', perspective: 1200 * scale}}>
    <div style={{position: 'absolute', inset: 0, clipPath: shot.id === 'platform-hinge-rise' ? 'inset(0 0 41% 0)' : undefined}}>
    {shot.slots.items.map((id, index) => {
      const layer = scene.layers.find((item) => item.id === id)!;
      const matrix = shot.id === 'concept-matrix';
      const hinge = shot.id === 'platform-hinge-rise';
      const p = hinge ? beatProgress(plan, id, ['enter', 'reveal'], frame, curves.hinge, .25, 1) : shot.id === 'card-stack' ? beatSpring(plan, id, frame, fps) : actionProgress(plan, id, ['enter', 'reveal'], frame);
      const finalX = matrix || hinge ? index % 2 * 51 : index * (100 / shot.slots.items.length);
      const rowY = matrix ? Math.floor(index / 2) * 51 : 0;
      const cardWidth = matrix || hinge ? 49 : 22;
      const fan = fanPose(index, shot.slots.items.length, unfold);
      const x = shot.id === 'card-stack' ? 50 - cardWidth / 2 + fan.x : finalX;
      const content = matrix ? Math.max(0, (p - 0.4) / 0.6) : p;
      const outline = matrix ? Math.min(1, p / 0.4) : p;
      if (shot.id === 'concept-matrix' && shot.revealMode && shot.slots.fronts) {
        const front = scene.layers.find((item) => item.id === shot.slots.fronts![index])!;
        const frontP = actionProgress(plan, front.id, ['enter', 'reveal'], frame);
        const turn = beatProgress(plan, id, ['enter', 'reveal'], frame, curves.flip, 0, .7) * 192 - beatProgress(plan, id, ['enter', 'reveal'], frame, t => 1 - (1 - t) ** 5, .7, 1) * 12;
        return <div key={id} style={{position: 'absolute', left: `${finalX}%`, top: `${rowY}%`, width: `${cardWidth}%`, height: '49%', perspective: 1200 * scale, opacity: frontP}}>
          <div style={{position: 'relative', height: '100%', transformStyle: 'preserve-3d', transform: `rotateY(${turn}deg)`}}>
            {[front, layer].map((face, faceIndex) => <div key={face.id} style={{position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: faceIndex ? 'rotateY(180deg)' : undefined, background: faceIndex ? tokens.paper : tokens.ink, color: faceIndex ? tokens.ink : tokens.paper, border: tokens.surfaceBorder, borderRadius: 20 * scale, boxShadow: tokens.surfaceShadow, padding: 24 * scale, boxSizing: 'border-box'}}><strong style={{display: 'block', fontSize: 64 * scale, lineHeight: 1.2}}>{face.label}</strong><div style={{fontSize: 44 * scale, lineHeight: 1.3, marginTop: 16 * scale}}>{face.text}</div><div aria-hidden style={{position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', background: `linear-gradient(90deg, transparent ${Math.max(0, turn / 180 * 100 - 15)}%, ${tokens.ink}45 ${turn / 180 * 100}%, transparent ${Math.min(100, turn / 180 * 100 + 15)}%)`, opacity: Math.abs(Math.sin(turn * Math.PI / 180)) * .6}} /></div>)}
          </div>
        </div>;
      }
      return <div key={id} style={{position: 'absolute', left: `${x}%`, top: `${shot.id === 'card-stack' ? 8 : rowY}%`, width: `${cardWidth}%`, height: matrix ? '49%' : hinge ? '58%' : '80%', color: tokens.ink, background: matrix ? undefined : `linear-gradient(160deg, ${tokens.paper}, ${mixColor(tokens.accentAlt, tokens.paper, .96)})`, border: matrix ? undefined : tokens.surfaceBorder, boxShadow: matrix ? undefined : tokens.surfaceShadow, boxSizing: 'border-box', padding: 24 * scale, opacity: matrix ? 1 : Math.min(1, p * 4), borderRadius: matrix ? undefined : 20 * scale, zIndex: shot.id === 'card-stack' ? fan.order : undefined, transformOrigin: hinge ? index === 0 ? 'right bottom' : 'left bottom' : '50% 130%', transform: hinge ? `translateY(${(1 - p) * 90 * scale}px) rotate(${(index ? 18 : -18) * (1 - p)}deg)` : shot.id === 'card-stack' ? `translateY(${(1 - p) * 200 * scale}px) translateZ(${fan.z * scale}px) rotate(${fan.rotation}deg)` : undefined}}>
        {matrix ? <div style={{position: 'absolute', inset: 0, background: mixColor(index % 2 ? tokens.accentAlt : tokens.accent, tokens.paper, .94), border: tokens.surfaceBorder, borderRadius: 20 * scale, boxShadow: tokens.surfaceShadow, opacity: shot.variant === 'bento-light-up' ? .18 + .82 * content : content, clipPath: shot.variant === 'wireframe-draw-on' ? `inset(0 ${100 * (1 - content)}% 0 0)` : undefined}} /> : null}
        {matrix && shot.variant === 'wireframe-draw-on' ? <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}><rect x="1" y="1" width="98" height="98" rx="3" fill="none" stroke={tokens.accentAlt} strokeWidth="0.3" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - outline} opacity={outline > 0 ? 1 : 0} /></svg> : null}
        {shot.id === 'card-stack' && shot.treatment ? <PaperTape progress={beatProgress(plan, id, ['tape'], frame, t => t)} scale={scale} color={tokens.accentAlt} /> : null}
        <div style={{position: 'relative', opacity: content, clipPath: matrix && shot.variant === 'wireframe-draw-on' ? `inset(0 ${100 * (1 - content)}% 0 0)` : undefined, transform: matrix && shot.variant === 'bento-light-up' ? `translateY(${(1 - content) * 20 * scale}px)` : undefined}}>
          <div style={{fontSize: 28 * scale, color: tokens.accentAlt, marginBottom: 12 * scale}}>{String(index + 1).padStart(2, '0')}</div>
          <strong style={{display: 'block', fontSize: 64 * scale, lineHeight: 1.2, marginBottom: 16 * scale, overflowWrap: 'anywhere'}}>{layer.label}</strong>
          <div style={{fontSize: 44 * scale, lineHeight: 1.3, color: tokens.muted, overflowWrap: 'anywhere'}}>{layer.text}</div>
        </div>
        {shot.id === 'card-stack' ? <div aria-hidden style={{position: 'absolute', bottom: 14 * scale, right: 20 * scale, fontFamily: tokens.displayFont, fontSize: 150 * scale, lineHeight: 1, color: tokens.accentAlt, opacity: .2 * unfold}}>{String(index + 1).padStart(2, '0')}</div> : null}
      </div>;
    })}
    </div>
    {shot.id === 'platform-hinge-rise' ? (() => {
      const result = scene.layers.find((layer) => layer.id === shot.slots.result)!;
      const p = actionProgress(plan, result.id, ['enter', 'reveal'], frame);
      const base = actionWindowProgress(plan, shot.slots.items[0]!, ['enter', 'reveal'], frame, 0, 0.25);
      return <><div style={{position: 'absolute', top: '59%', width: '100%', height: 6 * scale, background: tokens.accentAlt, transform: `scaleX(${base})`}} /><div style={{position: 'absolute', top: '68%', width: '100%', padding: 18 * scale, boxSizing: 'border-box', borderTop: tokens.surfaceBorder, opacity: p, transform: `translateY(${(1 - p) * 60 * scale}px)`}}><strong style={{fontSize: 44 * scale}}>{result.label}</strong><div style={{fontSize: 44 * scale, color: tokens.muted, marginTop: 8 * scale}}>{result.text}</div></div></>;
    })() : null}
  </div></ShotShell>;
}
