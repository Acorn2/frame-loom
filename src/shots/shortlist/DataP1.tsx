import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {ShotShell, type ShotRenderProps} from '../ShotShell';
import type {ShotPlan} from '../compile-shot';
import {beatProgress, curves} from '../motion';
import {actionProgress} from '../frame-state';
export function odometerPosition(progress: number, digit: number, index: number, count: number) {
  const stop = .4 + .4 * index / Math.max(1, count - 1);
  if (progress >= stop + .2) return 20 + digit;
  const spinning = progress / stop * 12;
  if (progress <= stop) return spinning;
  const p = Math.min(1, (progress - stop) / .2);
  return 12 + (8 + digit) * (1 - (1 - p) ** 3);
}
export function DataP1(props: ShotRenderProps & {plan: ShotPlan}) {
  const {scene, tokens, plan, appearance} = props; const frame = useCurrentFrame(); const scale = useVideoConfig().width / 1920;
  const shot = scene.shot;
  if (shot?.id !== 'timeline-travel' && shot?.id !== 'odometer-roll') throw new Error('data contract required');
  if (shot.id === 'timeline-travel') {
    const current = Math.max(0, shot.slots.items.reduce((last, id, index) => plan.actions.find((beat) => beat.target === id && ['enter', 'reveal'].includes(beat.action))!.start <= frame ? index : last, 0));
    const p = beatProgress(plan, shot.slots.items[current]!, ['enter', 'reveal'], frame, curves.handoff);
    const camera = current ? current - 1 + p : 0;
    return <ShotShell {...props}><div style={{position: 'relative', height: '100%', overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 0, top: '12%', height: '72%', width: '100%', transform: `translateX(${-camera * 105}%)`}}>
        <div aria-hidden style={{position: 'absolute', top: '18%', left: '45%', width: `${(shot.slots.items.length - 1) * 105}%`, height: 4 * scale, background: appearance?.lineInk ?? tokens.accent}} />
        {shot.slots.items.map((id, i) => {
          const layer = scene.layers.find((layer) => layer.id === id)!;
          return <div key={id} style={{position: 'absolute', left: `${i * 105 + 18}%`, width: '64%', top: 0, height: '100%', opacity: actionProgress(plan, id, ['enter', 'reveal'], frame)}}>
            <div style={{fontSize: 64 * scale, textAlign: 'center', color: appearance?.lineInk ?? tokens.accent}}>{String(layer.value)}</div>
            <div style={{position: 'absolute', top: '30%', height: '68%', width: '100%', padding: 24 * scale, boxSizing: 'border-box', color: tokens.ink, border: tokens.surfaceBorder, background: tokens.paper, borderRadius: 20 * scale, boxShadow: tokens.surfaceShadow, transformOrigin: 'center bottom', transform: `scaleY(${beatProgress(plan, id, ['enter', 'reveal'], frame, curves.back)})`}}><strong style={{fontSize: 64 * scale, lineHeight: 1.2}}>{layer.label}</strong><div style={{fontSize: 44 * scale, lineHeight: 1.3, marginTop: 12 * scale}}>{layer.text}</div></div>
          </div>;
        })}
      </div>
      <div style={{position: 'absolute', bottom: 0, fontSize: 22 * scale, color: appearance?.stageMuted ?? tokens.muted}}>日期按顺序等距排列，不表示时间跨度 · {scene.visual?.source}</div>
    </div></ShotShell>;
  }
  const layer = scene.layers.find((layer) => layer.id === shot.slots.metric)!;
  const characters = [...String(layer.value)]; const count = characters.filter((c) => /\d/.test(c)).length;
  const beat = plan.actions.find((beat) => beat.target === layer.id && beat.action === 'count')!;
  const progress = Math.max(0, Math.min(1, (frame - beat.start) / beat.duration));
  let digitIndex = 0;
  const reveal = actionProgress(plan, layer.id, ['enter', 'reveal'], frame);
  return <ShotShell {...props}><div style={{height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: reveal, gap: 24 * scale}}>
    <div style={{fontSize: 64 * scale}}>{layer.label}</div>
    <div style={{display: 'flex', alignItems: 'center', fontSize: 190 * scale, fontFamily: tokens.font ? tokens.bodyFont : 'monospace', fontWeight: 800, lineHeight: 1, gap: 8 * scale}}>{characters.map((c, i) => {
      if (!/\d/.test(c)) return <span key={i}>{c}</span>;
      const index = digitIndex++;
      const pos = odometerPosition(progress, Number(c), index, count);
      const prev = odometerPosition(Math.max(0, progress - 1 / beat.duration), Number(c), index, count);
      const speed = Math.min(1, Math.abs(pos - prev));
      return <div key={i} style={{height: 210 * scale, width: 126 * scale, position: 'relative', overflow: 'hidden', borderRadius: 18 * scale, background: tokens.ink, boxShadow: 'inset 0 2px 4px #ffffff18, 0 8px 20px #00000066'}}><div style={{transform: `translateY(${-pos * 210 * scale}px)`, filter: `blur(${speed * 2 * scale}px)`}}>{Array.from({length: 30}, (_, n) => <div key={n} style={{height: 210 * scale, display: 'grid', placeItems: 'center'}}>{n % 10}</div>)}</div>{speed > .02 ? <div aria-hidden style={{position: 'absolute', inset: 0, opacity: speed * .12, filter: `blur(${speed * 6 * scale}px)`, transform: `translateY(${speed * 24 * scale}px)`, display: 'grid', placeItems: 'center'}}>{Math.round(pos) % 10}</div> : null}</div>;
    })}<span style={{fontSize: 42 * scale, marginLeft: 24 * scale}}>{scene.visual?.unit}</span></div>
    <div style={{fontSize: 26 * scale, color: appearance?.stageMuted ?? tokens.muted}}>{layer.text}</div>
    <div style={{fontSize: 22 * scale, color: appearance?.stageMuted ?? tokens.muted}}>来源：{scene.visual?.source}</div>
  </div></ShotShell>;
}
