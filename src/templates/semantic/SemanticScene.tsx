import React from 'react';
import {AbsoluteFill, Img, useCurrentFrame, useVideoConfig} from 'remotion';
import type {StoryboardLayer, StoryboardScene} from '../../schemas/storyboard';
import type {StyleTokens} from '../../styles/style-loader';
import {captionTextStyle} from '../../audio/caption-style';
import {splitCaptionWindow} from '../../audio/captions';
import {FocusedMedia} from './FocusedMedia';
import {ConceptGlyph} from './ConceptGlyph';
import {overlapHandoffOpacity} from '../../timeline/overlap-handoff';
import {getAttentionOpacity, getAttentionTarget} from '../../timeline/attention';
import {entranceProgress} from '../../timeline/motion-progress';

interface Props {
  scene: StoryboardScene;
  tokens: StyleTokens;
  showSceneCaptions: boolean;
  externalCaptions?: boolean;
  overlapOutFrames: number;
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const layerHeading = (layer: StoryboardLayer) => layer.label ?? layer.text ?? String(layer.value ?? '');

function beatProgress(scene: StoryboardScene, target: string, frame: number, actions: string[]): number {
  const beat = scene.beats.find((item) => item.target === target && actions.includes(item.action));
  if (!beat) return 1;
  const progress = clamp((frame - beat.start) / beat.duration);
  return 1 - (1 - progress) ** 3;
}

function contrastInk(hex: string): string {
  const value = hex.match(/^#([0-9a-f]{6})$/i)?.[1];
  if (!value) return '#ffffff';
  const channels = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16));
  return channels[0]! * 0.299 + channels[1]! * 0.587 + channels[2]! * 0.114 > 150 ? '#17211d' : '#ffffff';
}

function surface(tokens: StyleTokens, active: boolean, index: number): React.CSSProperties {
  const dark = tokens.id === 'signal' || tokens.id === 'signal-noir';
  const playful = tokens.id === 'scatterbrain';
  const zine = tokens.id === 'retro-zine';
  return {
    background: active ? tokens.accent : tokens.paper,
    color: active ? contrastInk(tokens.accent) : tokens.ink,
    border: tokens.surfaceBorder,
    borderRadius: tokens.surfaceRadius,
    boxShadow: active
      ? zine ? `10px 10px 0 ${tokens.accentAlt}` : dark ? `0 0 24px ${tokens.accent}55` : tokens.surfaceShadow
      : tokens.surfaceShadow,
    transform: playful ? `rotate(${index % 2 ? 1.3 : -1.3}deg)` : undefined
  };
}

function background(tokens: StyleTokens, scale: number): React.CSSProperties {
  if (tokens.id === 'retro-zine' || tokens.id === 'signal-noir') {
    return {backgroundImage: `linear-gradient(${tokens.grid}45 1px, transparent 1px),linear-gradient(90deg, ${tokens.grid}45 1px, transparent 1px)`, backgroundSize: `${72 * scale}px ${72 * scale}px`};
  }
  if (tokens.id === 'scatterbrain') {
    return {backgroundImage: `radial-gradient(${tokens.grid} 2px, transparent 2px)`, backgroundSize: `${38 * scale}px ${38 * scale}px`};
  }
  if (tokens.id === 'signal') return {backgroundImage: `radial-gradient(circle at 78% 35%, ${tokens.accent}1f, transparent 36%)`};
  return {};
}

function entranceStyle(progress: number, tokens: StyleTokens, scale: number): React.CSSProperties {
  return {opacity: clamp(progress), translate: `0 ${(1 - progress) * tokens.motion.enterOffset * scale}px`};
}

export function transitionStyle(scene: StoryboardScene, frame: number, overlapOutFrames: number): React.CSSProperties {
  const incoming = scene.transitionIn;
  const inProgress = incoming ? clamp(frame / incoming.durationFrames) : 1;
  const outgoingFrames = overlapOutFrames || (scene.outro?.fadeFrames ?? (scene.transitionOut ? 12 : 0));
  const outProgress = outgoingFrames ? clamp((frame - (scene.durationFrames - outgoingFrames)) / outgoingFrames) : 0;
  const opacity = overlapHandoffOpacity({
    frame, durationFrames: scene.durationFrames,
    overlapInFrames: incoming?.durationFrames ?? 0, overlapOutFrames
  }) * (overlapOutFrames > 0 ? 1 : 1 - outProgress);
  return {
    opacity,
    transform: incoming?.type === 'overlap-slide' ? `translateY(${(1 - inProgress) * 28}px)`
      : scene.transitionOut === 'slide' ? `translateX(${-8 * outProgress}%)`
        : scene.transitionOut === 'carry' ? `translateY(${-24 * outProgress}px)` : undefined,
    clipPath: scene.transitionOut === 'paper-wipe' && overlapOutFrames === 0 ? `inset(0 ${outProgress * 100}% 0 0)` : undefined
  };
}

function DiagramNode({layer, scene, tokens, frame, scale, active, compact = false}: {
  layer: StoryboardLayer;
  scene: StoryboardScene;
  tokens: StyleTokens;
  frame: number;
  scale: number;
  active: boolean;
  compact?: boolean;
}) {
  const beat = scene.beats.find((item) => item.target === layer.id && ['enter', 'reveal'].includes(item.action));
  const progress = beat ? entranceProgress({frame, start: beat.start, duration: beat.duration, tokens, easing: beat.action === 'reveal' ? tokens.motionRules.reveal.easing : undefined}) : 1;
  const diameter = (compact ? 122 : 158) * scale;
  return <div style={{...entranceStyle(progress, tokens, scale), width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 14 * scale, opacity: clamp(progress) * getAttentionOpacity(scene, layer.id, frame)}}>
    <div style={{width: diameter, height: diameter, borderRadius: '50%', border: `${4 * scale}px solid ${active ? tokens.accent : tokens.accentAlt}`, background: active ? tokens.accent : tokens.paper, boxShadow: active ? `0 0 0 ${12 * scale}px ${tokens.accent}22` : undefined, display: 'grid', placeItems: 'center', boxSizing: 'border-box'}}>
      {layer.glyph ? <ConceptGlyph glyph={layer.glyph} color={active ? contrastInk(tokens.accent) : tokens.accentAlt} size={diameter * 0.54} /> : <span style={{fontFamily: tokens.displayFont, fontSize: 57 * scale}}>{[...layerHeading(layer)][0]}</span>}
    </div>
    <strong style={{fontFamily: tokens.displayFont, fontSize: (compact ? 38 : 48) * scale, lineHeight: 1.1, overflowWrap: 'anywhere'}}>{layerHeading(layer)}</strong>
    {layer.label && layer.text ? <span style={{fontSize: (compact ? 23 : 27) * scale, lineHeight: 1.2, color: tokens.muted, overflowWrap: 'anywhere'}}>{layer.text}</span> : null}
  </div>;
}

function StatementVisual({scene, tokens, frame, scale}: {scene: StoryboardScene; tokens: StyleTokens; frame: number; scale: number}) {
  const labels = scene.layers.filter((layer) => layer.type === 'label');
  const titleProgress = scene.transitionIn ? 1 : 0.12 + 0.88 * clamp(frame / 18);
  return <div style={{height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', gap: 38 * scale}}>
    <div style={{width: 116 * scale * titleProgress, height: 9 * scale, background: tokens.accent}} />
    <div style={{...entranceStyle(titleProgress, tokens, scale), fontFamily: tokens.displayFont, fontSize: 120 * scale, fontWeight: 800, lineHeight: 1.06, maxWidth: '83%', overflowWrap: 'anywhere'}}>{scene.title}</div>
    {labels.length ? <div style={{display: 'flex', flexWrap: 'wrap', gap: 15 * scale}}>{labels.map((layer, index) => {
      const beat = scene.beats.find((item) => item.target === layer.id && ['enter', 'reveal'].includes(item.action));
      const progress = beat ? entranceProgress({frame, start: beat.start, duration: beat.duration, tokens, easing: beat.action === 'reveal' ? tokens.motionRules.reveal.easing : undefined}) : 1;
      return <div key={layer.id} style={{...surface(tokens, false, index), ...entranceStyle(progress, tokens, scale), padding: `${12 * scale}px ${20 * scale}px`, fontSize: 26 * scale, fontWeight: 700}}>{layerHeading(layer)}</div>;
    })}</div> : null}
  </div>;
}

function CompareVisual({scene, tokens, frame, scale}: {scene: StoryboardScene; tokens: StyleTokens; frame: number; scale: number}) {
  const items = scene.layers.filter((layer) => layer.type === 'node' || layer.type === 'card');
  const focused = getAttentionTarget(scene, frame);
  return <div style={{height: '100%', display: 'grid', gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`, gap: 14 * scale, alignItems: 'stretch'}}>
    {items.map((layer, index) => <div key={layer.id} style={{minWidth: 0, position: 'relative', borderTop: `${7 * scale}px solid ${focused === layer.id ? tokens.accent : tokens.grid}`, borderRight: index < items.length - 1 ? `2px solid ${tokens.grid}` : undefined, padding: `0 ${26 * scale}px`}}>
      <span style={{position: 'absolute', left: 26 * scale, top: 17 * scale, color: tokens.accentAlt, fontSize: 28 * scale, fontWeight: 800}}>0{index + 1}</span>
      <DiagramNode layer={layer} scene={scene} tokens={tokens} frame={frame} scale={scale} active={focused === layer.id} />
    </div>)}
  </div>;
}

function SequenceVisual({scene, tokens, frame, scale}: {scene: StoryboardScene; tokens: StyleTokens; frame: number; scale: number}) {
  const items = scene.layers.filter((layer) => layer.type === 'node' || layer.type === 'card');
  const focused = getAttentionTarget(scene, frame) ?? items[0]?.id;
  return <div style={{height: '100%', display: 'flex', alignItems: 'center', position: 'relative'}}>
    {items.map((layer, index) => {
      const next = items[index + 1];
      const link = next && scene.connections.find((connection) => connection.from === layer.id && connection.to === next.id);
      const progress = link ? beatProgress(scene, link.id, frame, ['draw']) : 0;
      return <React.Fragment key={layer.id}>
        <div style={{flex: 1, minWidth: 0, height: '92%'}}><DiagramNode layer={layer} scene={scene} tokens={tokens} frame={frame} scale={scale} active={focused === layer.id} compact={items.length > 3} /></div>
        {link ? <div style={{width: 120 * scale, flexShrink: 0, textAlign: 'center', color: tokens.accentAlt, opacity: progress, marginTop: -60 * scale}}>
          <svg width={120 * scale} height={40 * scale} viewBox="0 0 120 40" aria-hidden="true"><path d="M0 20h110m-12-12 12 12-12 12" fill="none" stroke="currentColor" strokeWidth="4" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - progress} /></svg>
          {link.label ? <div style={{fontSize: 19 * scale, color: tokens.muted, whiteSpace: 'nowrap'}}>{link.label}</div> : null}
        </div> : null}
      </React.Fragment>;
    })}
  </div>;
}

function branchPositions(count: number): Array<[number, number]> {
  if (count === 2) return [[0.18, 0.5], [0.82, 0.5]];
  if (count === 3) return [[0.18, 0.23], [0.82, 0.23], [0.5, 0.74]];
  if (count === 4) return [[0.18, 0.23], [0.82, 0.23], [0.18, 0.74], [0.82, 0.74]];
  return [[0.16, 0.23], [0.84, 0.23], [0.16, 0.74], [0.84, 0.74], [0.5, 0.79]];
}

function ConvergenceVisual({scene, tokens, frame, scale}: {scene: StoryboardScene; tokens: StyleTokens; frame: number; scale: number}) {
  const {width, height} = useVideoConfig();
  const portrait = width < height;
  const anchor = scene.layers.find((layer) => layer.id === scene.visual?.anchorId);
  const branches = scene.layers.filter((layer) => layer.id !== anchor?.id);
  const markerId = `arrow-${React.useId().replace(/[^a-z0-9]/gi, '')}`;
  const anchorX = portrait ? 50 : 78;
  const anchorY = portrait ? 78 : 50;
  return <div style={{position: 'relative', height: '100%'}}>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}>
      <defs><marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10" fill={tokens.accentAlt} /></marker></defs>
      {branches.map((branch, i) => {
        const link = scene.connections.find((item) => item.from === branch.id && item.to === anchor?.id);
        const progress = link ? beatProgress(scene, link.id, frame, ['draw']) : 0;
        const x = portrait ? 100 * (i + 0.5) / branches.length : 23;
        const y = portrait ? 35 : 100 * (i + 0.5) / branches.length;
        return <path key={branch.id} d={`M${x} ${y} L${portrait ? anchorX : anchorX - 6} ${portrait ? anchorY - 22 : anchorY}`} fill="none" stroke={tokens.accentAlt} strokeWidth="0.65" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - progress} opacity={progress} markerEnd={`url(#${markerId})`} />;
      })}
    </svg>
    {branches.map((branch, i) => <div key={branch.id} style={{position: 'absolute', left: portrait ? `${100 * i / branches.length}%` : 0, top: portrait ? 0 : `${100 * i / branches.length}%`, width: portrait ? `${100 / branches.length}%` : '34%', height: portrait ? '38%' : `${100 / branches.length}%`}}><DiagramNode layer={branch} scene={scene} tokens={tokens} frame={frame} scale={scale * (branches.length > 3 ? 0.6 : 0.8)} active={getAttentionTarget(scene, frame) === branch.id} compact /></div>)}
    {anchor ? <div style={{position: 'absolute', left: `${anchorX}%`, top: `${anchorY}%`, transform: 'translate(-50%, -50%)', width: portrait ? '76%' : '40%', height: portrait ? '40%' : '90%'}}><DiagramNode layer={anchor} scene={scene} tokens={tokens} frame={frame} scale={scale} active={getAttentionTarget(scene, frame) === anchor.id} /></div> : null}
  </div>;
}

function NetworkVisual({scene, tokens, frame, scale}: {scene: StoryboardScene; tokens: StyleTokens; frame: number; scale: number}) {
  if (scene.visual?.networkDirection === 'inward') return <ConvergenceVisual scene={scene} tokens={tokens} frame={frame} scale={scale} />;
  const items = scene.layers.filter((layer) => layer.type === 'node' || layer.type === 'card');
  const anchor = items.find((layer) => layer.id === scene.visual?.anchorId);
  const branches = items.filter((layer) => layer.id !== anchor?.id);
  const positions = branchPositions(branches.length);
  const focused = getAttentionTarget(scene, frame) ?? anchor?.id;
  return <div style={{position: 'relative', height: '100%'}}>
    <svg viewBox="0 0 1000 600" preserveAspectRatio="none" style={{position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible'}} aria-hidden="true">
      {branches.map((branch, index) => {
        const link = scene.connections.find((connection) => connection.from === anchor?.id && connection.to === branch.id);
        const point = positions[index] ?? [0.5, 0.74];
        const progress = link ? beatProgress(scene, link.id, frame, ['draw']) : 0;
        return <path key={branch.id} d={`M500 300 L${point[0] * 1000} ${point[1] * 600}`} fill="none" stroke={tokens.accentAlt} strokeWidth="4" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - progress} opacity={0.9} />;
      })}
    </svg>
    {anchor ? <div style={{position: 'absolute', left: '50%', top: '50%', width: '26%', height: '46%', transform: 'translate(-50%, -50%)'}}><DiagramNode layer={anchor} scene={scene} tokens={tokens} frame={frame} scale={scale} active={focused === anchor.id} compact /></div> : null}
    {branches.map((branch, index) => {
      const point = positions[index] ?? [0.5, 0.74];
      return <div key={branch.id} style={{position: 'absolute', left: `${point[0] * 100}%`, top: `${point[1] * 100}%`, width: '22%', height: '44%', transform: 'translate(-50%, -50%)'}}><DiagramNode layer={branch} scene={scene} tokens={tokens} frame={frame} scale={scale} active={focused === branch.id} compact /></div>;
    })}
  </div>;
}

function ChangeVisual({scene, tokens, frame, scale}: {scene: StoryboardScene; tokens: StyleTokens; frame: number; scale: number}) {
  const before = scene.layers.find((layer) => layer.id === scene.visual?.beforeId);
  const after = scene.layers.find((layer) => layer.id === scene.visual?.afterId);
  const change = after ? beatProgress(scene, after.id, frame, ['enter', 'reveal']) : 0;
  if (scene.visual?.changeMode === 'replace' && before && after) {
    const current = change < 0.5 ? before : after;
    const entrance = beatProgress(scene, before.id, frame, ['enter', 'reveal']);
    return <div style={{height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 * scale, opacity: entrance}}>
      <div style={{width: 210 * scale, height: 210 * scale, borderRadius: 28 * scale, border: `${5 * scale}px solid ${tokens.accent}`, background: change < 0.5 ? tokens.paper : tokens.accent, display: 'grid', placeItems: 'center', transform: `scale(${1 + 0.06 * Math.sin(change * Math.PI)})`}}><ConceptGlyph glyph={before.glyph ?? 'document'} color={change < 0.5 ? tokens.accent : contrastInk(tokens.accent)} size={120 * scale} /></div>
      <strong style={{fontSize: 44 * scale, textAlign: 'center'}}>{current.label}</strong>
      <span style={{fontSize: 27 * scale, textAlign: 'center', maxWidth: '85%', color: tokens.muted}}>{current.text}</span>
      <span style={{fontSize: 20 * scale, color: tokens.accentAlt}}>{change < 0.5 ? '之前' : '之后'}</span>
    </div>;
  }
  return <div style={{height: '100%', display: 'grid', gridTemplateColumns: '1fr 160px 1fr', alignItems: 'center', gap: 16 * scale}}>
    <div style={{height: '94%', position: 'relative', borderTop: `${7 * scale}px solid ${tokens.grid}`, opacity: 1 - change * 0.45}}>
      <span style={{position: 'absolute', top: 14 * scale, left: 12 * scale, fontSize: 25 * scale, fontWeight: 700, color: tokens.muted}}>之前</span>
      {before ? <DiagramNode layer={before} scene={scene} tokens={tokens} frame={frame} scale={scale} active={false} /> : null}
    </div>
    <svg width={120 * scale} height={48 * scale} viewBox="0 0 120 48" aria-hidden="true"><path d="M0 24h108m-15-15 15 15-15 15" fill="none" stroke={tokens.accentAlt} strokeWidth="5" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - change} /></svg>
    <div style={{height: '94%', position: 'relative', borderTop: `${7 * scale}px solid ${tokens.accent}`}}>
      <span style={{position: 'absolute', top: 14 * scale, left: 12 * scale, fontSize: 25 * scale, fontWeight: 700, color: tokens.accentAlt, opacity: change}}>之后</span>
      {after ? <DiagramNode layer={after} scene={scene} tokens={tokens} frame={frame} scale={scale} active /> : null}
    </div>
  </div>;
}

function MetricVisual({scene, tokens, frame, scale}: {scene: StoryboardScene; tokens: StyleTokens; frame: number; scale: number}) {
  const metrics = scene.layers.filter((layer) => layer.type === 'metric');
  const values = metrics.map((layer) => typeof layer.value === 'number' ? Math.max(0, layer.value) : 0);
  const max = Math.max(1, ...values);
  const focused = getAttentionTarget(scene, frame);
  if (metrics.length === 1) {
    const layer = metrics[0]!;
    const progress = beatProgress(scene, layer.id, frame, ['enter', 'reveal', 'count']);
    const value = typeof layer.value === 'number' ? layer.value : 0;
    return <div style={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 60 * scale, borderTop: `${5 * scale}px solid ${tokens.grid}`}}>
      <strong style={{fontFamily: tokens.displayFont, fontSize: 230 * scale, lineHeight: 1, color: tokens.accentAlt}}>{(value * progress).toFixed(String(value).split('.')[1]?.length ?? 0)}</strong>
      <div style={{height: '52%', borderLeft: `${6 * scale}px solid ${tokens.accent}`, paddingLeft: 36 * scale, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18 * scale}}><span style={{fontSize: 67 * scale, fontWeight: 800}}>{scene.visual?.unit ?? ''}</span><span style={{fontSize: 41 * scale}}>{layer.label}</span><span style={{fontSize: 19 * scale, color: tokens.muted, maxWidth: 740 * scale, overflowWrap: 'anywhere'}}>来源：{scene.visual?.source}</span></div>
    </div>;
  }
  return <div style={{height: '100%', display: 'grid', gridTemplateColumns: `repeat(${metrics.length}, minmax(0, 1fr))`, alignItems: 'end', gap: 28 * scale, borderBottom: `${4 * scale}px solid ${tokens.ink}`, padding: `20px ${20 * scale}px 0`, boxSizing: 'border-box', position: 'relative'}}>
    <span style={{position: 'absolute', right: 0, top: 0, maxWidth: '46%', textAlign: 'right', fontSize: 18 * scale, color: tokens.muted, overflowWrap: 'anywhere'}}>来源：{scene.visual?.source}</span>
    {metrics.map((layer) => {
      const progress = beatProgress(scene, layer.id, frame, ['enter', 'reveal', 'count']);
      const value = typeof layer.value === 'number' ? layer.value : 0;
      return <div key={layer.id} style={{height: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 9 * scale}}>
        <strong style={{fontSize: 46 * scale, lineHeight: 1}}>{(value * progress).toFixed(String(value).split('.')[1]?.length ?? 0)}<small style={{fontSize: 20 * scale, marginLeft: 5 * scale}}>{scene.visual?.unit}</small></strong>
        <div style={{width: '72%', height: `${Math.max(6, value / max * progress * 58)}%`, background: focused === layer.id ? tokens.accent : tokens.accentAlt, border: tokens.surfaceBorder}} />
        <span style={{fontSize: 27 * scale, fontWeight: 700, minHeight: 35 * scale, textAlign: 'center'}}>{layer.label}</span>
      </div>;
    })}
  </div>;
}

function MediaVisual({scene, tokens, frame, scale, width, height}: {scene: StoryboardScene; tokens: StyleTokens; frame: number; scale: number; width: number; height: number}) {
  const layer = scene.layers.find((item) => item.type === 'screenshot' || item.type === 'object');
  if (!layer) return null;
  const beat = scene.beats.find((item) => item.target === layer.id && ['enter', 'reveal'].includes(item.action));
  const progress = beat ? entranceProgress({frame, start: beat.start, duration: beat.duration, tokens, easing: beat.action === 'reveal' ? tokens.motionRules.reveal.easing : undefined}) : 1;
  const focus = scene.visual?.mediaFocus;
  const focusProgress = focus ? 1 - (1 - clamp((frame - focus.start) / focus.duration)) ** 3 : 0;
  return <div style={{...surface(tokens, false, 0), ...entranceStyle(progress, tokens, scale), height: '100%', padding: 25 * scale, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative'}}>
    {layer.assetDataUri ? focus ? <FocusedMedia src={layer.assetDataUri} focus={focus} frame={frame} width={width - 50 * scale} height={height - 50 * scale} /> : <Img src={layer.assetDataUri} style={{maxWidth: '100%', maxHeight: '100%', width: '100%', height: '100%', objectFit: layer.fit ?? 'contain'}} /> : null}
    {focus ? <span style={{position: 'absolute', left: 24 * scale, bottom: 16 * scale, fontSize: 21 * scale, fontWeight: 700, color: tokens.ink, opacity: focusProgress}}>{focus.label}</span> : null}
  </div>;
}

export function SemanticScene({scene, tokens, showSceneCaptions, externalCaptions, overlapOutFrames}: Props) {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const visual = scene.visual;
  if (!visual) return null;
  const portrait = width < height;
  const scale = portrait ? width / 1080 : width / 1920;
  const caption = showSceneCaptions ? scene.captions.flatMap((item) => splitCaptionWindow(item.text, item.start, item.end)).find((item) => frame >= item.start && frame < item.end) : undefined;
  const captionReserve = ((scene.captions.length > 0 && showSceneCaptions) || externalCaptions) ? (portrait ? 170 : 125) * scale : 0;
  const contentWidth = width - tokens.safeArea.left - tokens.safeArea.right;
  const contentHeight = height - tokens.safeArea.top - tokens.safeArea.bottom - captionReserve;
  const extended = visual.networkDirection || visual.changeMode || visual.mediaFocus;
  const titleSize = Math.max(38, Math.min(portrait ? 82 : 78, (portrait ? 75 : 76) * 14 / Math.max(8, [...scene.title].length), extended ? contentWidth * 0.94 / scale / Math.max(1, [...scene.title].length) : Infinity)) * scale;
  const body = visual.kind === 'statement' ? <StatementVisual scene={scene} tokens={tokens} frame={frame} scale={scale} />
    : visual.kind === 'compare' ? <CompareVisual scene={scene} tokens={tokens} frame={frame} scale={scale} />
      : visual.kind === 'sequence' ? <SequenceVisual scene={scene} tokens={tokens} frame={frame} scale={scale} />
        : visual.kind === 'network' ? <NetworkVisual scene={scene} tokens={tokens} frame={frame} scale={scale} />
          : visual.kind === 'change' ? <ChangeVisual scene={scene} tokens={tokens} frame={frame} scale={scale} />
            : visual.kind === 'metric' ? <MetricVisual scene={scene} tokens={tokens} frame={frame} scale={scale} />
              : <MediaVisual scene={scene} tokens={tokens} frame={frame} scale={scale} width={contentWidth} height={contentHeight * (portrait ? 0.56 : 0.55)} />;
  const kindLabel = {statement: '观点', compare: '对照', sequence: '顺序', network: '关联', change: '变化', metric: '数据', media: '素材'}[visual.kind];
  const headingProgress = scene.transitionIn ? 1 : 0.12 + 0.88 * clamp(frame / 18);
  const claimProgress = clamp((frame - 12) / 18);
  return <AbsoluteFill style={{backgroundColor: tokens.background, color: tokens.ink, fontFamily: tokens.bodyFont, overflow: 'hidden', ...background(tokens, scale), ...transitionStyle(scene, frame, overlapOutFrames)}}>
    <div style={{position: 'absolute', left: tokens.safeArea.left, top: tokens.safeArea.top, width: contentWidth, height: contentHeight}}>
      {visual.kind !== 'statement' ? <>
        <div style={{position: 'absolute', left: 0, top: 0, right: 0, display: 'flex', justifyContent: 'space-between', borderBottom: `2px solid ${tokens.grid}`, paddingBottom: 14 * scale, color: tokens.muted, fontSize: 17 * scale, letterSpacing: 2 * scale}}><span>{kindLabel}</span><span>{visual.representation === 'diagram' ? '示意图' : '来源素材'}</span></div>
        <h1 style={{...entranceStyle(headingProgress, tokens, scale), position: 'absolute', left: 0, top: contentHeight * 0.075, margin: 0, width: '96%', fontFamily: tokens.displayFont, fontSize: titleSize, lineHeight: 1.1, overflowWrap: 'anywhere'}}>{scene.title}</h1>
        <div style={{position: 'absolute', left: 0, right: 0, top: contentHeight * (portrait ? 0.26 : 0.29), height: contentHeight * (portrait ? 0.56 : 0.55)}}>{body}</div>
        <div style={{...entranceStyle(claimProgress, tokens, scale), position: 'absolute', left: 0, right: 0, bottom: 0, borderTop: `2px solid ${tokens.grid}`, paddingTop: 14 * scale, fontSize: 25 * scale, lineHeight: 1.25, color: tokens.muted}}>{scene.primaryClaim}</div>
      </> : <>
        <div style={{position: 'absolute', inset: 0}}>{body}</div>
        <div style={{...entranceStyle(claimProgress, tokens, scale), position: 'absolute', left: 0, bottom: 0, borderTop: `2px solid ${tokens.grid}`, paddingTop: 17 * scale, fontSize: 26 * scale, color: tokens.muted}}>{scene.primaryClaim}</div>
      </>}
    </div>
    {caption ? <div style={{...captionTextStyle(tokens), position: 'absolute', left: tokens.safeArea.left, right: tokens.safeArea.right, bottom: tokens.safeArea.bottom + 10 * scale, padding: `${12 * scale}px ${18 * scale}px`, fontSize: (portrait ? 32 : 28) * scale, lineHeight: 1.3}}>{caption.text}</div> : null}
  </AbsoluteFill>;
}
