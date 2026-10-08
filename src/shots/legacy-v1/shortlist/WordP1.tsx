import React, {useEffect, useRef, useState} from 'react';
import {cancelRender, continueRender, delayRender, useCurrentFrame, useVideoConfig} from 'remotion';
import {ShotShell, type ShotRenderProps} from '../ShotShell';
import type {ShotPlan} from '../../compile-shot';
import {actionProgress} from '../frame-state';
export function WordP1(props: ShotRenderProps & {plan: ShotPlan}) {
  const {scene, tokens, plan} = props;
  const frame = useCurrentFrame(); const scale = useVideoConfig().width / 1920;
  const shot = scene.shot;
  if (shot?.id !== 'pill-slot-cycle' && shot?.id !== 'word-roll' && shot?.id !== 'text-column-converge') throw new Error('word contract required');
  const label = (id: string) => scene.layers.find((layer) => layer.id === id)!.label;
  const measures = useRef<HTMLDivElement>(null);
  const [handle] = useState(() => delayRender('Measure longest word'));
  const [width, setWidth] = useState(0);
  const suffix = 'suffix' in shot.slots ? shot.slots.suffix : undefined;
  const wordKey = [label(shot.slots.prefix), ...shot.slots.items.map(label), suffix ? label(suffix) : ''].join('|');
  useEffect(() => {let live = true; document.fonts.ready.then(() => {
    if (!live) return;
    const nodes = measures.current?.querySelectorAll<HTMLElement>('[data-word]');
    if (!nodes?.length) throw new Error('Missing word measurements');
    const longest = Math.max(...Array.from(nodes).map((node) => node.offsetWidth));
    const stems = Array.from(measures.current!.querySelectorAll<HTMLElement>('[data-stem]')).reduce((total, node) => total + node.offsetWidth, 0);
    if (longest + stems + 108 * scale > measures.current!.parentElement!.clientWidth) throw new Error('Actual longest word and sentence stem exceed recipe bounds');
    setWidth(longest);
    continueRender(handle);
  }).catch(cancelRender);return () => {live = false;};}, [handle, wordKey, scale, tokens.displayFont]);
  const current = Math.max(0, shot.slots.items.reduce((last, id, i) => plan.actions.find((beat) => beat.target === id && ['enter', 'reveal'].includes(beat.action))!.start <= frame ? i : last, 0));
  const active = shot.slots.items[current]!;
  const p = actionProgress(plan, active, ['enter', 'reveal'], frame, 'smooth');
  const converge = shot.id === 'text-column-converge';
  const collapse = converge ? actionProgress(plan, shot.slots.result, ['focus'], frame, 'smooth') : 0;
  const prefix = actionProgress(plan, shot.slots.prefix, ['enter', 'reveal'], frame);
  const font: React.CSSProperties = {fontFamily: tokens.displayFont, fontSize: 72 * scale, fontWeight: 800, whiteSpace: 'nowrap', lineHeight: 1.3};
  return <ShotShell {...props} ownTitle>
    <div ref={measures} aria-hidden style={{position: 'absolute', visibility: 'hidden', ...font}}>{shot.slots.items.map((id) => <div data-word key={id} style={{width: 'max-content'}}>{label(id)}</div>)}<span data-stem>{label(shot.slots.prefix)}</span><span data-stem>{suffix ? label(suffix) : ''}</span></div>
    <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 30 * scale, ...font, opacity: 1 - collapse, transform: `scaleX(${1 - .5 * collapse})`}}>
      <span style={{opacity: prefix}}>{label(shot.slots.prefix)}</span>
      <div style={{position: 'relative', width: width + 48 * scale, height: 108 * scale, overflow: 'hidden', border: converge ? undefined : tokens.surfaceBorder, borderRadius: converge ? undefined : 54 * scale, background: converge ? undefined : tokens.paper}}>
        {shot.slots.items.map((id, index) => {
          if (index !== current && index !== current - 1) return null;
          const entering = index === current;
          const offset = entering ? 1 - p : -p;
          const visibility = entering ? p : 1 - p;
          return <div key={id} style={{position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: tokens.accent, opacity: visibility, transform: `translateY(${offset * 108 * scale}px)`, filter: `blur(${Math.abs(offset) * (shot.id === 'word-roll' ? 9 : 5) * scale}px)`}}>{label(id)}</div>;
        })}
      </div>
      {'suffix' in shot.slots && shot.slots.suffix ? <span style={{opacity: actionProgress(plan, shot.slots.suffix, ['enter', 'reveal'], frame)}}>{label(shot.slots.suffix)}</span> : null}
    </div>
    {converge ? <div style={{position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', ...font, opacity: actionProgress(plan, shot.slots.result, ['enter', 'reveal'], frame)}}>{label(shot.slots.result)}</div> : null}
  </ShotShell>;
}
