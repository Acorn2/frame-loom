import React, {useEffect, useRef, useState} from 'react';
import {cancelRender, continueRender, delayRender, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import {ShotShell, type ShotRenderProps} from '../ShotShell';
import type {ShotPlan} from '../../compile-shot';
import {beatProgress, curves} from '../../motion';

export function WordP1(props: ShotRenderProps & {plan: ShotPlan}) {
  const {scene, tokens, plan} = props;
  const frame = useCurrentFrame(); const scale = useVideoConfig().width / 1920;
  const shot = scene.shot;
  if (shot?.id !== 'pill-slot-cycle' && shot?.id !== 'word-roll' && shot?.id !== 'text-column-converge') throw new Error('word contract required');
  const label = (id: string) => scene.layers.find(layer => layer.id === id)!.label;
  const converge = shot.id === 'text-column-converge';
  const font: React.CSSProperties = {fontFamily: converge ? tokens.bodyFont : tokens.displayFont, fontSize: (converge ? 56 : 72) * scale, fontWeight: converge ? 500 : 800, whiteSpace: 'nowrap', lineHeight: 1.3};
  const measures = useRef<HTMLDivElement>(null);
  const [handle] = useState(() => delayRender('Measure recipe word slots'));
  const [metrics, setMetrics] = useState({word: 0, prefix: 0, suffix: 0, available: 0, last: 0});
  const suffix = 'suffix' in shot.slots ? shot.slots.suffix : undefined;
  const wordKey = [label(shot.slots.prefix), ...shot.slots.items.map(label), suffix ? label(suffix) : ''].join('|');
  useEffect(() => {let live = true; document.fonts.ready.then(() => {
    if (!live) return;
    const node = measures.current!;
    const words = Array.from(node.querySelectorAll<HTMLElement>('[data-word]'));
    const stems = Array.from(node.querySelectorAll<HTMLElement>('[data-stem]'));
    const word = Math.max(...words.map(item => item.offsetWidth));
    const prefix = stems[0]!.offsetWidth; const suffix = stems[1]!.offsetWidth;
    const available = node.parentElement!.clientWidth;
    if (word + prefix + suffix + 108 * scale > available) throw new Error('Actual longest word and sentence stem exceed recipe bounds');
    setMetrics({word, prefix, suffix, available, last: words.at(-1)!.offsetWidth});
    continueRender(handle);
  }).catch(cancelRender);return () => {live = false;};}, [handle, wordKey, scale, tokens.displayFont, tokens.bodyFont]);
  const current = Math.max(0, shot.slots.items.reduce((last, id, i) => plan.actions.find(beat => beat.target === id && ['enter', 'reveal'].includes(beat.action))!.start <= frame ? i : last, 0));
  const id = shot.slots.items[current]!;
  const p = beatProgress(plan, id, ['enter', 'reveal'], frame, shot.id === 'word-roll' ? curves.reel : Easing.out(Easing.cubic));
  const prefix = beatProgress(plan, shot.slots.prefix, ['enter', 'reveal'], frame);
  const collapse = converge ? beatProgress(plan, shot.slots.result, ['focus'], frame, curves.handoff) : 0;
  const result = converge ? beatProgress(plan, shot.slots.result, ['enter', 'reveal'], frame) : 0;
  const row = 108 * scale;
  const position = current ? current - 1 + p : 0;
  const mergedLeft = (metrics.available - metrics.prefix - metrics.last - 28 * scale) / 2;
  return <ShotShell {...props} ownTitle>
    <div ref={measures} aria-hidden style={{position: 'absolute', visibility: 'hidden', ...font}}>{shot.slots.items.map(id => <div data-word key={id} style={{width: 'max-content'}}>{label(id)}</div>)}<span data-stem>{label(shot.slots.prefix)}</span><span data-stem>{suffix ? label(suffix) : ''}</span></div>
    {converge ? <>
      <div style={{position: 'absolute', top: '44%', width: '100%', height: row, ...font, opacity: prefix * (1 - result)}}>
        <span style={{position: 'absolute', left: metrics.available * .16 * (1 - collapse) + mergedLeft * collapse}}>{label(shot.slots.prefix)}</span>
        <span style={{position: 'absolute', right: metrics.available * .16 * (1 - collapse) + mergedLeft * collapse, color: tokens.accentAlt, opacity: frame >= plan.actions.find(beat => beat.target === id && ['enter', 'reveal'].includes(beat.action))!.start ? 1 : 0}}>{label(id)}</span>
      </div>
      <div style={{position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', ...font, opacity: result}}>{label(shot.slots.result)}</div>
    </> : <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 30 * scale, ...font}}>
      <span style={{opacity: prefix}}>{label(shot.slots.prefix)}</span>
      <div style={{position: 'relative', width: metrics.word + 48 * scale, height: row * (shot.id === 'word-roll' ? 3 : 1), overflow: 'hidden', border: shot.id === 'pill-slot-cycle' ? `2px solid ${tokens.accentAlt}` : undefined, borderRadius: shot.id === 'pill-slot-cycle' ? 54 * scale : undefined, background: shot.id === 'pill-slot-cycle' ? tokens.paper : undefined, opacity: shot.id === 'word-roll' ? Math.min(1, beatProgress(plan, shot.slots.items[0]!, ['enter', 'reveal'], frame)) : 1, maskImage: shot.id === 'word-roll' ? 'linear-gradient(transparent, black 30%, black 70%, transparent)' : undefined}}>
        {shot.id === 'word-roll' ? <div style={{transform: `translateY(${row * (1 - position)}px)`}}>{shot.slots.items.map((word, i) => {
          const distance = Math.abs(i - position);
          return <div key={word} style={{height: row, display: 'grid', placeItems: 'center', color: distance < .42 ? tokens.accentAlt : tokens.muted, opacity: Math.max(.1, 1 - .65 * distance), filter: `blur(${Math.min(5, distance * 3) * scale}px)`}}>{label(word)}</div>;
        })}</div> : shot.slots.items.map((word, i) => {
          if (i !== current && i !== current - 1) return null;
          const entering = i === current;
          const exit = beatProgress(plan, id, ['enter', 'reveal'], frame, Easing.in(Easing.cubic));
          const offset = entering ? (1 - p) * 120 : -exit * 130;
          return <div key={word} style={{position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: tokens.accentAlt, opacity: entering ? Math.min(1, p * 2) : 1 - exit, transform: `translateY(${offset * scale}px)`, filter: `blur(${(entering ? 14 * (1 - p) : exit * 10) * scale}px)`}}>{label(word)}</div>;
        })}
      </div>
      {suffix ? <span style={{opacity: beatProgress(plan, suffix, ['enter', 'reveal'], frame)}}>{label(suffix)}</span> : null}
    </div>}
  </ShotShell>;
}
