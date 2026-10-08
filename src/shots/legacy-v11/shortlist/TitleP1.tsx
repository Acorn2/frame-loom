import React, {useEffect, useRef, useState} from 'react';
import {cancelRender, continueRender, delayRender, useCurrentFrame, useVideoConfig} from 'remotion';
import {ShotShell, type ShotRenderProps} from '../ShotShell';
import type {ShotPlan} from '../../compile-shot';
import {beatProgress, curves} from '../../motion';
import {actionProgress} from '../../frame-state';

// Measure the actual loaded font and its baseline, outside animated transforms.
export function TitleP1(props: ShotRenderProps & {plan: ShotPlan}) {
  const {scene, plan, tokens} = props;
  const frame = useCurrentFrame();
  const scale = useVideoConfig().width / 1920;
  const shot = scene.shot;
  if (shot?.id !== 'brace-expand' && shot?.id !== 'lead-word-assemble') throw new Error('title contract required');
  const ids = shot.id === 'brace-expand' ? [shot.slots.title] : shot.slots.phrases;
  const labels = ids.map((id) => scene.layers.find((layer) => layer.id === id)!.label!);
  const key = labels.join('');
  const line = useRef<HTMLDivElement>(null);
  const lead = useRef<HTMLSpanElement>(null);
  const ruler = useRef<HTMLSpanElement>(null);
  const [handle] = useState(() => delayRender('Measure recipe font and baseline'));
  const [metrics, setMetrics] = useState<{width: number; leadWidth: number; baseline: number} | null>(null);
  useEffect(() => {
    let live = true;
    document.fonts.ready.then(() => {
      if (!live) return;
      if (!line.current || !lead.current || !ruler.current) throw new Error('Missing title measurement nodes');
      const width = line.current.offsetWidth;
      const rect = line.current.getBoundingClientRect();
      const baseline = (ruler.current.getBoundingClientRect().top - rect.top) / (rect.width / width);
      const available = line.current.parentElement!.clientWidth;
      if (width + (shot.id === 'brace-expand' ? 160 * scale : 0) > available || lead.current.offsetWidth * 2.3 > available) throw new Error('Actual title font exceeds recipe bounds; shorten the title');
      if (width <= 0 || baseline <= 0) throw new Error('Invalid font measurement');
      setMetrics({width, leadWidth: lead.current.offsetWidth, baseline});
      continueRender(handle);
    }).catch(cancelRender);
    return () => {live = false;};
  }, [handle, key, scale, tokens.displayFont, shot.id]);
  const font: React.CSSProperties = {fontFamily: tokens.displayFont, fontSize: 88 * scale, fontWeight: 800, lineHeight: 1.2, whiteSpace: 'nowrap'};
  const p = beatProgress(plan, ids[0]!, ['enter', 'reveal'], frame, shot.id === 'brace-expand' ? curves.back : curves.press);
  const recede = shot.id === 'lead-word-assemble' ? beatProgress(plan, ids[0]!, ['focus'], frame, curves.handoff) : 1;
  return <ShotShell {...props} ownTitle>
    <div aria-hidden style={{position: 'absolute', visibility: 'hidden', ...font}} ref={line}><span ref={lead}>{labels[0]}</span>{labels.slice(1).map((text, i) => <span key={i}>{text}</span>)}<span ref={ruler} style={{display: 'inline-block', width: 0, height: 0, verticalAlign: 'baseline'}} /></div>
    {metrics ? <div style={{position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', ...font}}>
      {shot.id === 'brace-expand' ? <div style={{position: 'relative', width: metrics.width + 160 * scale, height: 88 * scale * 1.6}}>
        <span style={{position: 'absolute', left: (metrics.width / 2 + 50 * scale) * (1 - p), top: 0, transform: `scale(${.6 + .4 * p})`, color: tokens.accent}}>{'{'}</span>
        <span style={{position: 'absolute', right: (metrics.width / 2 + 50 * scale) * (1 - p), top: 0, transform: `scale(${.6 + .4 * p})`, color: tokens.accent}}>{'}'}</span>
        <span style={{position: 'absolute', left: 80 * scale, top: 0, width: metrics.width, clipPath: `inset(0 ${50 * (1 - p)}% 0 ${50 * (1 - p)}%)`, opacity: p > 0 ? 1 : 0, transform: `scale(${.6 + .4 * p})`}}>{scene.title}</span>
      </div> : <div style={{position: 'relative', width: metrics.width, height: 88 * scale * 2.5}}>
        <span style={{position: 'absolute', left: (metrics.width - metrics.leadWidth) / 2 * (1 - recede), top: 50 * scale, opacity: p, transformOrigin: `50% ${metrics.baseline}px`, transform: `scale(${1 + 1.3 * (1 - recede)}) translateY(${(1 - p) * 20 * scale}px)`}}>{labels[0]}</span>
        <span style={{position: 'absolute', left: metrics.leadWidth, top: 50 * scale}}>{ids.slice(1).map((id, i) => {
          const reveal = actionProgress(plan, id, ['enter', 'reveal'], frame);
          return <span key={id} style={{display: 'inline-block', opacity: reveal, transform: `translateX(${(1 - reveal) * 44 * scale}px)`}}>{labels[i + 1]}</span>;
        })}</span>
      </div>}
    </div> : null}
  </ShotShell>;
}
