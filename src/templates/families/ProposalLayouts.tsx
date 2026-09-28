import React from 'react';
import {Img} from 'remotion';
import type {StoryboardLayer, StoryboardScene} from '../../schemas/storyboard';
import type {StyleTokens} from '../../styles/style-loader';

export interface ProposalLayoutProps {
  scene: StoryboardScene;
  tokens: StyleTokens;
  frame: number;
  width: number;
  height: number;
  scale: number;
  portrait: boolean;
}

const text = (layer: StoryboardLayer) => layer.label ?? layer.text ?? String(layer.value ?? '');
const description = (layer: StoryboardLayer) => layer.label ? layer.text : undefined;
const itemsFor = (scene: StoryboardScene) => scene.layers.filter((layer) => scene.purpose === 'evidence' ? layer.type === 'metric' : layer.type === 'card' || layer.type === 'node');
const mediaFor = (scene: StoryboardScene) => scene.layers.find((layer) => layer.type === 'screenshot' || layer.type === 'object');
const noteFor = (scene: StoryboardScene) => scene.layers.find((layer) => layer.semanticRole === 'subtitle' || layer.type === 'annotation')?.text;
const caption = (scene: StoryboardScene) => scene.purpose?.toUpperCase() ?? scene.template.toUpperCase();

function metricValue(scene: StoryboardScene, layer: StoryboardLayer, frame: number): string {
  const value = layer.value ?? layer.text ?? '';
  const count = scene.beats.find((beat) => beat.target === layer.id && beat.action === 'count');
  if (!count || typeof value !== 'number') return String(value);
  const progress = Math.max(0, Math.min(1, (frame - count.start) / count.duration));
  const decimals = String(value).split('.')[1]?.length ?? 0;
  return (value * progress).toFixed(decimals);
}

function appear(scene: StoryboardScene, layer: StoryboardLayer | undefined, index: number, frame: number, tokens: StyleTokens, axis: 'x' | 'y' = 'y'): React.CSSProperties {
  const beat = layer ? scene.beats.find((candidate) => candidate.target === layer.id && ['enter', 'reveal', 'count'].includes(candidate.action)) : undefined;
  const start = beat?.start ?? 7 + index * 12;
  const duration = beat?.duration ?? tokens.motionRules.enter.durationFrames;
  const progress = Math.max(0, Math.min(1, (frame - start) / duration));
  const offset = (1 - progress) * tokens.motion.enterOffset;
  return {opacity: progress, transform: axis === 'x' ? `translateX(${offset}px)` : `translateY(${offset}px)`};
}

function headingSize(value: string, width: number, height: number, large: number, small: number) {
  const units = [...value].reduce((sum, char) => sum + (/\p{Script=Han}/u.test(char) ? 1 : 0.6), 0);
  for (let size = large; size >= small; size -= 2) {
    if (Math.ceil(units * size / Math.max(width, 1)) * size * 1.16 <= height) return size;
  }
  return small;
}

function FrameHeader({scene, tokens, label, scale}: {scene: StoryboardScene; tokens: StyleTokens; label: string; scale: number}) {
  return <div style={{position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${tokens.grid}`, paddingBottom: 13 * scale, color: tokens.muted, fontSize: 15 * scale, letterSpacing: 2 * scale, fontWeight: 700}}><span>FRAMELOOM / {label}</span><span>{caption(scene)}</span></div>;
}

function FrameFooter({tokens, label, scale}: {tokens: StyleTokens; label: string; scale: number}) {
  return <div style={{position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${tokens.grid}`, paddingTop: 12 * scale, color: tokens.muted, fontSize: 14 * scale, letterSpacing: 2 * scale}}><span>{label}</span><span>◆</span></div>;
}

export function CleanEditorialLayout({scene, tokens, frame, width, height, scale, portrait}: ProposalLayoutProps) {
  const items = itemsFor(scene);
  const media = mediaFor(scene);
  const note = noteFor(scene);
  const title: React.CSSProperties = {fontFamily: tokens.displayFont, fontSize: headingSize(scene.title, portrait ? width * 0.94 : width * 0.62, height * 0.37, (portrait ? 94 : 124) * scale, 38 * scale), fontWeight: 800, lineHeight: 1.12, margin: 0, overflowWrap: 'anywhere'};
  let body: React.ReactNode;
  if (scene.purpose === 'process' && items.length) {
    body = <>
      <h1 style={{...title, position: 'absolute', top: height * 0.14, left: 0, width: portrait ? width : width * 0.33}}>{scene.title}</h1>
      <div style={{position: 'absolute', left: portrait ? 0 : width * 0.38, right: 0, top: portrait ? height * 0.43 : height * 0.2, bottom: height * 0.11, display: 'grid', gridTemplateColumns: portrait ? '1fr' : `repeat(${items.length}, minmax(0, 1fr))`, gridTemplateRows: portrait ? `repeat(${items.length}, minmax(0, 1fr))` : undefined, borderTop: `5px solid ${tokens.accent}`}}>
        {items.map((item, index) => <div key={item.id} style={{minWidth: 0, borderLeft: `1px solid ${tokens.grid}`, padding: 20 * scale, ...appear(scene, item, index, frame, tokens, 'x')}}><div style={{color: tokens.accent, fontSize: 26 * scale, fontWeight: 700}}>0{index + 1}</div><div style={{marginTop: portrait ? 8 * scale : 36 * scale, fontSize: 35 * scale, fontWeight: 800}}>{text(item)}</div>{description(item) && <div style={{marginTop: 12 * scale, fontSize: 21 * scale, color: tokens.muted, lineHeight: 1.35}}>{description(item)}</div>}</div>)}
      </div>
    </>;
  } else if (scene.purpose === 'evidence' && items.length) {
    body = <>
      <h1 style={{...title, position: 'absolute', top: height * 0.14, left: 0, width: portrait ? width : width * 0.36}}>{scene.title}</h1>
      <div style={{position: 'absolute', left: portrait ? 0 : width * 0.42, right: 0, top: portrait ? height * 0.45 : height * 0.18, bottom: height * 0.13, display: 'grid', gridTemplateColumns: portrait ? '1fr' : `repeat(${items.length}, minmax(0, 1fr))`, gap: 28 * scale}}>
        {items.map((item, index) => <div key={item.id} style={{borderLeft: `5px solid ${tokens.accent}`, paddingLeft: 22 * scale, ...appear(scene, item, index, frame, tokens)}}><strong style={{display: 'block', fontSize: 100 * scale, lineHeight: 1.05}}>{metricValue(scene, item, frame)}</strong><span style={{fontSize: 22 * scale, color: tokens.muted}}>{item.label}</span></div>)}
      </div>
    </>;
  } else if (scene.purpose === 'media' && media) {
    body = <>
      <div style={{position: 'absolute', left: 0, top: height * 0.14, width: portrait ? width : width * 0.7, height: portrait ? height * 0.49 : height * 0.69, background: tokens.paper, border: `1px solid ${tokens.grid}`, padding: 18 * scale, ...appear(scene, media, 0, frame, tokens)}}>{media.assetDataUri && <Img src={media.assetDataUri} style={{width: '100%', height: '100%', objectFit: media.fit ?? 'contain'}} />}</div>
      <div style={{position: 'absolute', left: portrait ? 0 : width * 0.75, top: portrait ? height * 0.7 : height * 0.29, width: portrait ? width : width * 0.24}}><div style={{color: tokens.accent, fontSize: 17 * scale, letterSpacing: 2 * scale}}>MATERIAL</div><h1 style={{...title, fontSize: headingSize(scene.title, portrait ? width : width * 0.24, height * 0.35, 66 * scale, 29 * scale)}}>{scene.title}</h1>{media.label && <p style={{color: tokens.muted, fontSize: 19 * scale}}>{media.label}</p>}</div>
    </>;
  } else {
    body = <>
      <div style={{position: 'absolute', top: height * 0.16, left: 0, color: tokens.muted, fontSize: 18 * scale, letterSpacing: 2 * scale}}>{scene.purpose === 'closing' ? 'FINAL THOUGHT' : 'VISUAL ESSAY'}</div>
      <div style={{position: 'absolute', top: height * 0.1, right: width * 0.04, color: tokens.grid, fontSize: 260 * scale, lineHeight: 1, fontWeight: 900}}>{scene.purpose === 'closing' ? '✓' : '01'}</div>
      <h1 style={{...title, position: 'absolute', left: width * 0.04, top: height * 0.32, width: portrait ? width * 0.91 : width * 0.72, borderLeft: `${7 * scale}px solid ${tokens.accent}`, paddingLeft: 22 * scale, ...appear(scene, undefined, 0, frame, tokens)}}>{scene.title}</h1>
      {note && <div style={{position: 'absolute', right: width * 0.03, bottom: height * 0.13, maxWidth: width * 0.55, paddingLeft: 16 * scale, borderLeft: `5px solid ${tokens.accentAlt}`, fontSize: 23 * scale, lineHeight: 1.35}}>{note}</div>}
    </>;
  }
  return <div style={{position: 'absolute', inset: 0, color: tokens.ink}}><FrameHeader scene={scene} tokens={tokens} label="CLEAN EDITORIAL" scale={scale} />{body}<FrameFooter tokens={tokens} label="ONE IDEA / CLEARLY TOLD" scale={scale} /></div>;
}

export function BlueprintLayout({scene, tokens, frame, width, height, scale, portrait}: ProposalLayoutProps) {
  const items = itemsFor(scene);
  const media = mediaFor(scene);
  const note = noteFor(scene);
  const label: React.CSSProperties = {color: tokens.accent, fontSize: 16 * scale, letterSpacing: 2 * scale};
  const title: React.CSSProperties = {fontSize: headingSize(scene.title, width * 0.88, height * 0.27, (portrait ? 72 : 105) * scale, 34 * scale), lineHeight: 1.13, margin: 0, fontWeight: 700};
  let body: React.ReactNode;
  if (scene.purpose === 'process' && items.length) {
    body = <><h1 style={{...title, position: 'absolute', top: height * 0.15}}>{scene.title}</h1><div style={{position: 'absolute', left: 0, right: 0, top: portrait ? height * 0.38 : height * 0.45, bottom: height * 0.1, display: 'grid', gridTemplateColumns: portrait ? '1fr' : `repeat(${items.length}, minmax(0, 1fr))`, gridTemplateRows: portrait ? `repeat(${items.length}, minmax(0, 1fr))` : undefined, gap: 24 * scale}}>{items.map((item, index) => <div key={item.id} style={{minWidth: 0, padding: 22 * scale, border: `2px solid ${index === 1 ? tokens.accentAlt : tokens.grid}`, background: tokens.paper, ...appear(scene, item, index, frame, tokens)}}><div style={{...label, color: tokens.accentAlt}}>NODE 0{index + 1}</div><strong style={{display: 'block', marginTop: 20 * scale, fontSize: 35 * scale}}>{text(item)}</strong>{description(item) && <div style={{marginTop: 10 * scale, color: tokens.muted, fontSize: 19 * scale}}>{description(item)}</div>}</div>)}</div></>;
  } else if (scene.purpose === 'evidence' && items.length) {
    body = <><h1 style={{...title, position: 'absolute', top: height * 0.15}}>{scene.title}</h1><div style={{position: 'absolute', left: portrait ? 0 : width * 0.07, right: 0, top: portrait ? height * 0.41 : height * 0.43, display: 'grid', gridTemplateColumns: portrait ? '1fr' : `repeat(${items.length}, minmax(0, 1fr))`, gap: 30 * scale}}>{items.map((item, index) => <div key={item.id} style={{borderLeft: `4px solid ${tokens.accent}`, borderBottom: `1px solid ${tokens.grid}`, padding: 20 * scale, ...appear(scene, item, index, frame, tokens)}}><strong style={{display: 'block', color: tokens.accentAlt, fontSize: 92 * scale, lineHeight: 1}}>{metricValue(scene, item, frame)}</strong><span style={{color: tokens.muted, fontSize: 20 * scale}}>{item.label}</span></div>)}</div></>;
  } else if (scene.purpose === 'media' && media) {
    body = <><div style={{position: 'absolute', left: 0, top: height * 0.13, width: portrait ? width : width * 0.7, height: portrait ? height * 0.51 : height * 0.68, border: `2px solid ${tokens.accent}`, padding: 16 * scale, background: '#eef4ef', ...appear(scene, media, 0, frame, tokens)}}>{media.assetDataUri && <Img src={media.assetDataUri} style={{width: '100%', height: '100%', objectFit: media.fit ?? 'contain'}} />}</div><div style={{position: 'absolute', left: portrait ? 0 : width * 0.75, top: portrait ? height * 0.71 : height * 0.26, width: portrait ? width : width * 0.24}}><div style={label}>FOCUS OBJECT</div><h1 style={{...title, fontSize: headingSize(scene.title, portrait ? width : width * 0.24, height * 0.28, 60 * scale, 28 * scale)}}>{scene.title}</h1>{media.label && <p style={{color: tokens.muted, fontSize: 19 * scale}}>{media.label}</p>}</div></>;
  } else {
    body = <><div style={{...label, position: 'absolute', top: height * 0.23}}>{scene.purpose === 'closing' ? 'FINAL TAKEAWAY' : 'SYSTEM STUDY'}</div><div style={{position: 'absolute', top: height * 0.21, right: width * 0.06, width: width * 0.21, height: width * 0.21, maxHeight: height * 0.33, border: `2px solid ${tokens.accent}`, opacity: 0.65}} /><h1 style={{...title, position: 'absolute', top: height * 0.38, left: width * 0.05, width: width * 0.82, borderLeft: `7px solid ${tokens.accentAlt}`, paddingLeft: 24 * scale, ...appear(scene, undefined, 0, frame, tokens)}}>{scene.title}</h1>{note && <div style={{position: 'absolute', left: width * 0.07, bottom: height * 0.12, fontSize: 22 * scale, color: tokens.muted}}>{note}</div>}</>;
  }
  return <div style={{position: 'absolute', inset: 0, color: tokens.ink}}><FrameHeader scene={scene} tokens={tokens} label="BLUEPRINT" scale={scale} />{body}<FrameFooter tokens={tokens} label="SOURCE → STRUCTURE → FRAME" scale={scale} /></div>;
}

export function ProductFrameLayout({scene, tokens, frame, width, height, scale, portrait}: ProposalLayoutProps) {
  const items = itemsFor(scene);
  const media = mediaFor(scene);
  const note = noteFor(scene);
  const shell: React.CSSProperties = {position: 'absolute', top: height * 0.11, bottom: height * 0.08, left: 0, right: 0, border: `1px solid ${tokens.grid}`, borderRadius: 12 * scale, background: tokens.paper, boxShadow: tokens.surfaceShadow, overflow: 'hidden'};
  const pane: React.CSSProperties = {background: '#f8faf8', border: `1px solid ${tokens.grid}`, borderRadius: 8 * scale, padding: 26 * scale};
  const label: React.CSSProperties = {color: tokens.muted, fontSize: 17 * scale, letterSpacing: 1.5 * scale};
  let body: React.ReactNode;
  if (scene.purpose === 'process' && items.length) {
    body = <div style={{padding: 40 * scale, height: `calc(100% - ${58 * scale}px)`, display: 'grid', gridTemplateColumns: portrait ? '1fr' : '1fr 0.45fr', gap: 24 * scale}}><div style={pane}><div style={label}>WORKFLOW / {items.length} STEPS</div><h1 style={{fontSize: headingSize(scene.title, portrait ? width * 0.8 : width * 0.55, height * 0.17, 70 * scale, 32 * scale), lineHeight: 1.1}}>{scene.title}</h1><div style={{display: 'grid', gap: 12 * scale}}>{items.map((item, index) => <div key={item.id} style={{display: 'grid', gridTemplateColumns: `${44 * scale}px 1fr`, gap: 12 * scale, padding: 15 * scale, background: index === 1 ? '#edf6d2' : '#fff', borderLeft: `${5 * scale}px solid ${index === 1 ? tokens.accent : tokens.grid}`, ...appear(scene, item, index, frame, tokens)}}><strong style={{color: tokens.accentAlt}}>0{index + 1}</strong><div><strong style={{fontSize: 24 * scale}}>{text(item)}</strong>{description(item) && <div style={{color: tokens.muted, fontSize: 18 * scale}}>{description(item)}</div>}</div></div>)}</div></div>{!portrait && <div style={{...pane, display: 'flex', flexDirection: 'column', justifyContent: 'space-between'}}><span style={label}>SEQUENCE</span><strong style={{fontSize: 88 * scale, color: tokens.accentAlt}}>{String(items.length).padStart(2, '0')}</strong><div style={{height: 8 * scale, background: tokens.grid}}><div style={{width: `${Math.min(100, frame / Math.max(1, scene.durationFrames) * 100)}%`, height: '100%', background: tokens.accent}} /></div></div>}</div>;
  } else if (scene.purpose === 'evidence' && items.length) {
    body = <div style={{padding: 40 * scale}}><div style={label}>CONTENT OVERVIEW</div><h1 style={{fontSize: headingSize(scene.title, width * 0.8, height * 0.17, 68 * scale, 32 * scale)}}>{scene.title}</h1><div style={{display: 'grid', gridTemplateColumns: portrait ? '1fr' : `repeat(${items.length}, minmax(0, 1fr))`, gap: 18 * scale}}>{items.map((item, index) => <div key={item.id} style={{...pane, background: index % 2 ? '#edf6d2' : '#f8faf8', ...appear(scene, item, index, frame, tokens)}}><div style={label}>{item.label}</div><strong style={{display: 'block', fontSize: 94 * scale, lineHeight: 1.2}}>{metricValue(scene, item, frame)}</strong></div>)}</div></div>;
  } else if (scene.purpose === 'media' && media) {
    body = <div style={{padding: 30 * scale, height: `calc(100% - ${58 * scale}px)`, display: 'grid', gridTemplateColumns: portrait ? '1fr' : '1fr 0.36fr', gridTemplateRows: portrait ? '1fr auto' : undefined, gap: 22 * scale}}><div style={{...pane, minHeight: 0, ...appear(scene, media, 0, frame, tokens)}}><div style={{...label, marginBottom: 14 * scale}}>MATERIAL / PREVIEW</div>{media.assetDataUri && <Img src={media.assetDataUri} style={{width: '100%', height: `calc(100% - ${38 * scale}px)`, objectFit: media.fit ?? 'contain'}} />}</div><div style={pane}><div style={label}>INSPECTOR</div><h1 style={{fontSize: headingSize(scene.title, portrait ? width * 0.8 : width * 0.27, height * 0.25, 51 * scale, 27 * scale)}}>{scene.title}</h1>{media.label && <p style={{color: tokens.muted, fontSize: 20 * scale}}>{media.label}</p>}</div></div>;
  } else {
    body = <div style={{padding: 56 * scale, height: `calc(100% - ${58 * scale}px)`, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}><div style={label}>{scene.purpose === 'closing' ? 'FINAL FRAME' : 'PROJECT FRAME'}</div><h1 style={{fontSize: headingSize(scene.title, width * 0.83, height * 0.41, (portrait ? 84 : 116) * scale, 37 * scale), lineHeight: 1.1, maxWidth: width * 0.82, margin: `${25 * scale}px 0`, ...appear(scene, undefined, 0, frame, tokens)}}>{scene.title}</h1>{note && <div style={{fontSize: 24 * scale, color: tokens.muted}}>{note}</div>}</div>;
  }
  return <div style={{position: 'absolute', inset: 0, color: tokens.ink}}><FrameHeader scene={scene} tokens={tokens} label="PRODUCT FRAME" scale={scale} /><div style={shell}><div style={{height: 58 * scale, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${25 * scale}px`, borderBottom: `1px solid ${tokens.grid}`, fontSize: 17 * scale, fontWeight: 800}}><span><span style={{display: 'inline-block', width: 13 * scale, height: 13 * scale, background: tokens.accent, marginRight: 12 * scale}} />FRAMELOOM STUDIO</span><span style={{color: tokens.muted, fontSize: 14 * scale, fontWeight: 500}}>VISUAL PREVIEW</span></div>{body}</div><FrameFooter tokens={tokens} label="INPUT → STRUCTURE → OUTPUT" scale={scale} /></div>;
}
