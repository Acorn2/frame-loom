import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {StoryboardBeat, StoryboardLayer} from '../../schemas/storyboard';
import type {ShotPlan} from '../compile-shot';
import {ShotShell, type ShotRenderProps} from '../ShotShell';
import {expansionLayout, regroupPoints} from './layout';
import {isExpansionShot} from './schema';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export function phaseProgress(frame: number, beat: StoryboardBeat) {
  const linear = interpolate(frame, [beat.start, beat.start + beat.duration], [0, 1], clamp);
  return linear * linear * (3 - 2 * linear);
}
export function typedQuery(text: string, frame: number, beat: StoryboardBeat) {
  const chars = [...text];
  const progress = interpolate(frame, [beat.start, beat.start + beat.duration], [0, 1], clamp);
  return chars.slice(0, Math.floor(progress * chars.length)).join('');
}
export function ExpansionScene(props: ShotRenderProps & {plan: ShotPlan}) {
  const {scene, tokens, appearance} = props;
  const shot = scene.shot;
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  if (!shot || !isExpansionShot(shot)) throw new Error('Missing expansion recipe');
  const portrait = width < height, scale = width / (portrait ? 1080 : 1920);
  const contentWidth = (width - tokens.safeArea.left - tokens.safeArea.right) / scale;
  const contentHeight = (height - tokens.safeArea.top - tokens.safeArea.bottom - (portrait ? 170 : 125) * scale) * .86 / scale;
  const layout = expansionLayout(contentWidth, contentHeight, shot.slots.items.length);
  const get = (id: string) => scene.layers.find(layer => layer.id === id)!;
  const beat = (id: string, action: string) => scene.beats.find(b => b.target === id && (action === 'entry' ? ['enter', 'reveal'].includes(b.action) : b.action === action))!;
  const progress = (id: string, action = 'entry') => phaseProgress(frame, beat(id, action));
  const ink = appearance?.stageInk ?? tokens.ink, muted = appearance?.stageMuted ?? tokens.muted;
  const accent = appearance?.lineInk ?? tokens.accentAlt;
  const cardStyle: React.CSSProperties = {boxSizing: 'border-box', color: tokens.ink, background: tokens.paper,
    border: tokens.surfaceBorder, borderRadius: tokens.surfaceRadius, boxShadow: tokens.surfaceShadow, padding: layout.inset};
  const body = (layer: StoryboardLayer) => <><div style={{fontSize: layout.labelFont, lineHeight: 1.2, fontWeight: 700, overflowWrap: 'anywhere'}}>{layer.label}</div>
    {layer.text ? <div style={{fontSize: layout.textFont, color: tokens.muted, lineHeight: 1.35, marginTop: 12, overflowWrap: 'anywhere'}}>{layer.text}</div> : null}</>;
  let content: React.ReactNode;
  if (shot.id === 'type-and-filter') {
    const filter = progress(shot.selectedId, 'focus'), clickBeat = beat(shot.selectedId, 'highlight');
    const clicked = progress(shot.selectedId, 'highlight');
    const detail = progress(shot.slots.detail);
    const queryBeat = beat(shot.slots.query, 'entry');
    content = <>
      <div style={{...cardStyle, position: 'absolute', inset: `0 0 auto`, height: layout.queryHeight, display: 'flex', alignItems: 'center', gap: 18, fontSize: layout.labelFont}}>
        <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden><circle cx="13" cy="13" r="9" stroke={tokens.muted} strokeWidth="3" fill="none"/><path d="m20 20 9 9" stroke={tokens.muted} strokeWidth="3"/></svg>
        <span>{typedQuery(get(shot.slots.query).label!, frame, queryBeat)}</span>
        {frame >= queryBeat.start && frame < clickBeat.start ? <span style={{width: 3, height: 36, background: tokens.accentAlt, opacity: frame < queryBeat.start + queryBeat.duration || Math.floor(frame / 15) % 2 === 0 ? 1 : 0}}/> : null}
      </div>
      {shot.slots.items.map((id, index) => {
        const selected = id === shot.selectedId;
        const x = (index % layout.columns) * (layout.itemWidth + layout.gap), y = layout.queryHeight + layout.gap + Math.floor(index / layout.columns) * (layout.itemHeight + layout.gap);
        const entry = progress(id);
        const ripple = frame >= clickBeat.start && frame < clickBeat.start + clickBeat.duration;
        return <div key={id} style={{...cardStyle, position: 'absolute', width: layout.itemWidth, height: layout.itemHeight,
          left: x * (selected ? 1 - filter : 1), top: selected ? y + (layout.queryHeight + layout.gap - y) * filter : y + filter * 28,
          opacity: entry * (selected ? 1 : 1 - filter) * (1 - detail), transform: `translateY(${(1 - entry) * 20}px)`,
          borderColor: selected && clicked > 0 ? tokens.accentAlt : undefined}}>
          {body(get(id))}
          {selected && ripple ? <div aria-hidden style={{position: 'absolute', width: 36 + clicked * 100, height: 36 + clicked * 100, right: '12%', top: '36%', border: `3px solid ${tokens.accentAlt}`, borderRadius: '50%', opacity: 1 - clicked}}/> : null}
        </div>;
      })}
      <div style={{...cardStyle, position: 'absolute', left: 0, right: 0, top: layout.queryHeight + layout.gap,
        height: contentHeight - layout.queryHeight - layout.gap, opacity: detail, transform: `translateY(${(1 - detail) * 24}px)`}}>{body(get(shot.slots.detail))}</div>
    </>;
  } else if (shot.id === 'ai-stream-response') {
    const complete = progress(shot.slots.completion);
    content = <>
      <div style={{...cardStyle, position: 'absolute', left: 0, right: 0, top: 0, height: layout.summaryHeight,
        fontFamily: tokens.displayFont, fontSize: layout.labelFont, fontWeight: 700, lineHeight: 1.25, opacity: progress(shot.slots.summary)}}>{get(shot.slots.summary).label}</div>
      {shot.slots.items.map((id, index) => {
        const arrived = progress(id), done = progress(id, 'set-state');
        return <div key={id} style={{...cardStyle, position: 'absolute', left: 0, right: 0,
          top: layout.summaryHeight + layout.gap + index * (layout.streamHeight + layout.gap), height: layout.streamHeight,
          display: 'flex', alignItems: 'center', gap: 24, opacity: arrived, transform: `translateY(${(1 - arrived) * 24}px)`}}>
          <svg width="44" height="44" viewBox="0 0 44 44" style={{flexShrink: 0}} aria-label={done === 1 ? 'completed' : 'upcoming'}>
            <circle cx="22" cy="22" r="18" stroke={tokens.accentAlt} fill="none" strokeWidth="3" opacity={1 - done}/>
            <path d="m10 23 8 8 17-19" fill="none" stroke={tokens.accentAlt} strokeWidth="4" strokeDasharray="40" strokeDashoffset={40 * (1 - done)}/>
          </svg><div style={{flex: 1, display: portrait ? 'block' : 'flex', alignItems: 'center', gap: portrait ? 0 : 24}}>
            <div style={{fontSize: layout.labelFont, fontWeight: 700, lineHeight: 1.2, width: portrait ? undefined : '35%', flexShrink: 0, overflowWrap: 'anywhere'}}>{get(id).label}</div>
            <div style={{fontSize: layout.textFont, lineHeight: 1.35, color: tokens.muted, marginTop: portrait ? 12 : 0, overflowWrap: 'anywhere'}}>{get(id).text}</div>
          </div>
        </div>;
      })}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: layout.completionHeight,
        color: accent, fontFamily: tokens.displayFont, fontSize: layout.labelFont, fontWeight: 700,
        display: 'flex', alignItems: 'center', opacity: complete}}>{get(shot.slots.completion).label}</div>
    </>;
  } else {
    const phase = beat(shot.slots.total, 'focus');
    const t = interpolate(frame, [phase.start, phase.start + phase.duration], [0, 1], clamp);
    const segment = Math.min(2, Math.floor(t * 3));
    const local = Math.min(1, (t * 3 - segment) / .68);
    const morph = local * local * (3 - 2 * local);
    const headHeight = portrait ? 150 : 100, dotHeight = contentHeight - headHeight;
    const values = shot.slots.items.map(id => Number(get(id).value));
    const points = regroupPoints(values, contentWidth, dotHeight, portrait);
    const groupOpacity = interpolate(t, [.03, .2, .67, .85], [0, 1, 1, 0], clamp);
    const total = get(shot.slots.total), entry = progress(total.id);
    content = <>
      <div style={{fontSize: layout.labelFont, lineHeight: 1.3, color: ink, opacity: entry}}>{total.label} · {total.value} {scene.visual!.unit}
        <div style={{fontSize: layout.textFont, color: muted, marginTop: 12}}>每个点 = 1 {scene.visual!.unit}</div></div>
      <svg width={contentWidth} height={dotHeight} style={{position: 'absolute', top: headHeight, left: 0, overflow: 'hidden'}}>
        {shot.slots.items.map((id, index) => <text key={id} x={portrait ? 0 : contentWidth * ((index + .5) / values.length)}
          y={portrait ? dotHeight * ((index + .5) / values.length) : 45} textAnchor={portrait ? 'start' : 'middle'}
          fill={ink} fontFamily={tokens.bodyFont} fontSize={portrait ? 32 : 34} opacity={entry * groupOpacity}>
          {get(id).label} · {values[index]}</text>)}
        {points[0]!.map((_, index) => {
          const a = points[segment]![index]!, b = points[segment + 1]![index]!;
          return <circle key={index} data-group={a.group} cx={a.x + (b.x - a.x) * morph} cy={a.y + (b.y - a.y) * morph}
            r={portrait ? 8 : 9} fill={accent} opacity={entry}/>;
        })}
      </svg>
    </>;
  }
  return <ShotShell {...props}><div style={{position: 'relative', width: contentWidth, height: contentHeight, transform: `scale(${scale})`, transformOrigin: 'top left'}}>{content}</div></ShotShell>;
}
