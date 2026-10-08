import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {ShotShell, type ShotRenderProps} from '../ShotShell';
import type {ShotPlan} from '../../compile-shot';
import {actionProgress} from '../frame-state';

export function PaperTape({progress, scale, color}: {progress: number; scale: number; color: string}) {
  if (progress <= 0) return null;
  return <>{[0, 1].map((i) => {
    const p = Math.max(0, Math.min(1, progress * 2 - i));
    return <div key={i} aria-hidden style={{position: 'absolute', width: 110 * scale, height: 22 * scale, left: i ? undefined : -12 * scale, right: i ? -12 * scale : undefined, top: i ? undefined : -8 * scale, bottom: i ? -8 * scale : undefined, opacity: p * .75, background: color, clipPath: 'polygon(0 8%, 4% 0, 96% 3%, 100% 12%, 98% 50%, 100% 90%, 95% 100%, 3% 97%, 0 88%, 2% 45%)', transform: `translateY(${(1 - p) * -55 * scale}px) rotate(${-20 + (1 - p) * 14}deg) scale(${1 + (1 - p) * .4})`}} />;
  })}</>;
}
export function StructureP1(props: ShotRenderProps & {plan: ShotPlan}) {
  const {scene, tokens, plan} = props; const frame = useCurrentFrame(); const scale = useVideoConfig().width / 1920;
  const shot = scene.shot;
  if (shot?.id !== 'row-embed' && shot?.id !== 'structure-then-text' && shot?.id !== 'evidence-relay') throw new Error('structure contract required');
  const relay = shot.id === 'evidence-relay';
  const current = relay ? Math.max(0, shot.slots.items.reduce((last, id, i) => plan.actions.find((beat) => beat.target === id && ['enter', 'reveal'].includes(beat.action))!.start <= frame ? i : last, 0)) : 0;
  return <ShotShell {...props}><div style={{position: 'relative', height: '100%', perspective: 1200 * scale, overflow: relay ? 'hidden' : undefined}}>
    {shot.slots.items.map((id, i) => {
      const layer = scene.layers.find((layer) => layer.id === id)!;
      const p = actionProgress(plan, id, ['enter', 'reveal'], frame, 'smooth');
      if (relay && i !== current && i !== current - 1) return null;
      const activeP = relay ? actionProgress(plan, shot.slots.items[current]!, ['enter', 'reveal'], frame, 'smooth') : 0;
      const trace = shot.id === 'structure-then-text' ? actionProgress(plan, id, ['trace'], frame, 'smooth') : 1;
      const top = relay ? (i - current + (1 - activeP)) * 105 : shot.id === 'row-embed' ? i * (100 / shot.slots.items.length) : Math.floor(i / 2) * 51;
      const tape = shot.id === 'row-embed' && shot.treatment ? actionProgress(plan, id, ['tape'], frame, 'smooth') : 0;
      const flutter = tape > 0 && tape < 1 ? Math.sin(tape * Math.PI * 4) * (1 - tape) * 1.5 : 0;
      const text = shot.id === 'structure-then-text' ? [...layer.text!].slice(0, Math.floor([...layer.text!].length * p)).join('') : layer.text;
      return <div key={id} style={{position: 'absolute', top: `${top}%`, left: shot.id === 'structure-then-text' ? `${i % 2 * 51}%` : 0, width: relay ? '58%' : shot.id === 'row-embed' ? '100%' : '49%', height: relay ? '92%' : shot.id === 'row-embed' ? `${100 / shot.slots.items.length - 4}%` : '49%', boxSizing: 'border-box', background: shot.id === 'structure-then-text' && trace < 1 ? undefined : tokens.paper, border: shot.id === 'structure-then-text' ? undefined : tokens.surfaceBorder, padding: 24 * scale, boxShadow: shot.id === 'structure-then-text' && trace < 1 ? undefined : tokens.surfaceShadow, opacity: shot.id === 'structure-then-text' ? trace : relay ? i === current ? p : 1 - activeP : p, transformOrigin: 'center bottom', transform: shot.id === 'row-embed' ? `translateY(${(1 - p) * -120 * scale}px) rotateX(${(1 - p) * 16}deg) rotate(${flutter}deg) translateY(${tape * 2 * scale}px) scale(${1 + (1 - p) * .04})` : undefined}}>
        {shot.id === 'structure-then-text' ? <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}><rect x=".5" y=".5" width="99" height="99" fill="none" stroke={tokens.accent} strokeWidth=".4" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - trace} />{trace > 0 && trace < 1 ? <rect x=".5" y=".5" width="99" height="99" fill="none" stroke={tokens.accent} strokeWidth=".7" pathLength="1" strokeDasharray=".045 .955" strokeDashoffset={.045 - trace} /> : null}</svg> : null}
        <div style={{opacity: p, position: 'relative'}}><strong style={{fontSize: 30 * scale, display: 'block', lineHeight: 1.2}}>{layer.label}</strong><div style={{fontSize: (relay ? 32 : 26) * scale, lineHeight: 1.3, marginTop: 12 * scale, overflowWrap: 'anywhere'}}>{text}</div></div>
        {shot.id === 'row-embed' ? <><div aria-hidden style={{position: 'absolute', bottom: -3 * scale, left: 0, width: '100%', height: 3 * scale, background: tokens.accent, opacity: p > .75 && p < 1 ? Math.sin((p - .75) * 4 * Math.PI) : 0}} />{shot.treatment ? <PaperTape progress={actionProgress(plan, id, ['tape'], frame, 'smooth')} scale={scale} color={tokens.accentAlt} /> : null}</> : null}
      </div>;
    })}
    {relay ? shot.slots.keywords.map((id, i) => {
      if (i !== current && i !== current - 1) return null;
      const p = actionProgress(plan, shot.slots.items[current]!, ['enter', 'reveal'], frame, 'smooth');
      // The old keyword exits completely before the new one appears.
      const opacity = i === current ? Math.max(0, (p - .5) * 2) : Math.max(0, 1 - p * 2);
      return <div key={id} style={{position: 'absolute', left: '64%', top: '34%', width: '36%', fontFamily: tokens.displayFont, fontSize: 72 * scale, fontWeight: 800, opacity, transform: `translateY(${(i === current ? 1 - p : -p) * 36 * scale}px)`}}>{scene.layers.find((layer) => layer.id === id)!.label}</div>;
    }) : null}
  </div></ShotShell>;
}
