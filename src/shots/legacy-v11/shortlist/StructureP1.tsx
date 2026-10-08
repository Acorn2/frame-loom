import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {ShotShell, type ShotRenderProps} from '../ShotShell';
import type {ShotPlan} from '../../compile-shot';
import {beatProgress, curves} from '../../motion';
import {actionProgress} from '../../frame-state';

export function PaperTape({progress, scale, color}: {progress: number; scale: number; color: string}) {
  if (progress <= 0) return null;
  return <>{[0, 1].map(i => {
    const p = Math.max(0, Math.min(1, progress * 2 - i));
    if (p <= 0) return null;
    const approach = Math.min(1, p / .72);
    const settle = Math.max(0, (p - .72) / .28);
    const rotation = approach < 1 ? -16 * (1 - approach) : 7 * (1 - settle);
    const press = p >= .72 && p < .8 ? .72 : p < .9 ? .9 : 1;
    return <div key={i} aria-hidden style={{position: 'absolute', width: 110 * scale, height: 26 * scale, left: i ? undefined : -12 * scale, right: i ? -12 * scale : undefined, top: i ? undefined : -8 * scale, bottom: i ? -8 * scale : undefined, opacity: Math.min(1, approach * 3) * .75, background: color, clipPath: 'polygon(0 8%, 4% 0, 96% 3%, 100% 12%, 98% 50%, 100% 90%, 95% 100%, 3% 97%, 0 88%, 2% 45%)', transform: `translateY(${(1 - approach) * -55 * scale}px) rotate(${-20 + rotation}deg) scale(${1 + (1 - approach) * .45}) scaleY(${press})`}} />;
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
      const p = beatProgress(plan, id, ['enter', 'reveal'], frame, shot.id === 'row-embed' ? curves.flight : curves.handoff);
      if (relay && Math.abs(i - current) > 1) return null;
      const activeP = relay ? beatProgress(plan, shot.slots.items[current]!, ['enter', 'reveal'], frame, curves.handoff) : 0;
      const trace = shot.id === 'structure-then-text' ? actionProgress(plan, id, ['trace'], frame, 'smooth') : 1;
      const top = relay ? 12 + (i - current + (current ? 1 - activeP : 0)) * 84 : shot.id === 'row-embed' ? i * (100 / shot.slots.items.length) : Math.floor(i / 2) * 51;
      const tape = shot.id === 'row-embed' && shot.treatment ? beatProgress(plan, id, ['tape'], frame, t => t) : 0;
      const flutter = shot.id === 'row-embed' && shot.treatment && p >= 1 && tape < 1 ? Math.sin(frame * .22 + i) * 1.5 * (tape > .36 ? .45 : 1) * (1 - Math.max(0, (tape - .86) / .14)) : 0;
      const text = shot.id === 'structure-then-text' ? [...layer.text!].slice(0, Math.floor([...layer.text!].length * p)).join('') : layer.text;
      return <div key={id} style={{position: 'absolute', top: `${top}%`, left: shot.id === 'structure-then-text' ? `${i % 2 * 51}%` : 0, width: relay ? '58%' : shot.id === 'row-embed' ? '100%' : '49%', height: relay ? '74%' : shot.id === 'row-embed' ? `${100 / shot.slots.items.length - 4}%` : '49%', boxSizing: 'border-box', background: shot.id === 'structure-then-text' && trace < 1 ? undefined : relay && i % 2 ? tokens.ink : tokens.paper, color: relay && i % 2 ? tokens.paper : tokens.ink, borderRadius: shot.id === 'row-embed' ? 4 * scale : 14 * scale, border: shot.id === 'structure-then-text' ? undefined : tokens.surfaceBorder, padding: 24 * scale, boxShadow: shot.id === 'structure-then-text' && trace < 1 ? undefined : tokens.surfaceShadow, opacity: shot.id === 'structure-then-text' ? trace : relay ? (current === 0 ? p : 1) : p, transformOrigin: 'center bottom', transform: shot.id === 'row-embed' ? `translateY(${(1 - p) * -120 * scale}px) rotateX(${(1 - p) * 16}deg) rotate(${flutter}deg) translateY(${tape * 2 * scale}px) scale(${1 + Math.sin(p * Math.PI) * .04})` : shot.id === 'structure-then-text' ? `translate(${(i % 2 ? 1 : -1) * (1 - trace) * 120 * scale}px, ${(i < 2 ? -1 : 1) * (1 - trace) * 80 * scale}px) rotate(${(i % 2 ? 1 : -1) * (1 - trace) * 6}deg)` : undefined}}>
        {shot.id === 'structure-then-text' ? <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}><rect x=".5" y=".5" width="99" height="99" fill="none" stroke={tokens.accent} strokeWidth=".4" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - trace} />{trace > 0 && trace < 1 ? <rect x=".5" y=".5" width="99" height="99" fill="none" stroke={tokens.accent} strokeWidth=".7" pathLength="1" strokeDasharray=".045 .955" strokeDashoffset={.045 - trace} /> : null}</svg> : null}
        <div style={{opacity: relay ? 1 : p, position: 'relative'}}><strong style={{fontSize: 38 * scale, display: 'block', lineHeight: 1.2}}>{layer.label}</strong><div style={{fontSize: (relay ? 42 : 30) * scale, lineHeight: 1.3, marginTop: 12 * scale, overflowWrap: 'anywhere'}}>{text}</div></div>
        {shot.id === 'row-embed' ? <><div aria-hidden style={{position: 'absolute', bottom: -3 * scale, left: 0, width: '100%', height: 3 * scale, background: tokens.accent, opacity: p > .75 && p < 1 ? Math.sin((p - .75) * 4 * Math.PI) : 0}} />{shot.treatment ? <PaperTape progress={beatProgress(plan, id, ['tape'], frame, t => t)} scale={scale} color={tokens.accentAlt} /> : null}</> : null}
      </div>;
    })}
    {relay ? shot.slots.keywords.map((id, i) => {
      if (i !== current && i !== current - 1) return null;
      const p = beatProgress(plan, shot.slots.items[current]!, ['enter', 'reveal'], frame, curves.handoff);
      // The old keyword exits completely before the new one appears.
      const opacity = i === current ? Math.max(0, (p - .5) * 2) : Math.max(0, 1 - p * 2);
      return <div key={id} style={{position: 'absolute', left: '64%', top: '49%', transformOrigin: 'left center', width: '36%', fontFamily: tokens.displayFont, fontSize: 100 * scale, fontWeight: 800, opacity, transform: `translateY(calc(-50% + ${(i === current ? 1 - p : -p) * 36 * scale}px))`}}>{scene.layers.find((layer) => layer.id === id)!.label}</div>;
    }) : null}
  </div></ShotShell>;
}
