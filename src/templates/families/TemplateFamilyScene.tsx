import React from 'react';
import {AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {StoryboardCaption, StoryboardLayer, StoryboardScene} from '../../schemas/storyboard';
import type {StyleTokens} from '../../styles/style-loader';
import {captionTextStyle} from '../../audio/caption-style';
import {splitCaptionWindow} from '../../audio/captions';
import type {TemplateFamilyId as FamilyId} from './family-registry';
import {BlueprintLayout, CleanEditorialLayout, ProductFrameLayout} from './ProposalLayouts';

interface Props {
  scene: StoryboardScene;
  tokens: StyleTokens;
  showSceneCaptions: boolean;
  externalCaptions?: boolean;
  overlapOutFrames: number;
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));

function textUnits(value: string): number {
  return [...value].reduce((sum, char) => sum + (/\p{Script=Han}|[\u3000-\uffef]/u.test(char) ? 1 : /\s/u.test(char) ? 0.35 : 0.6), 0);
}

function fittedFont(text: string, width: number, height: number, largest: number, smallest: number, lineHeight = 1.12): number {
  for (let size = largest; size >= smallest; size -= 2) {
    const lines = Math.max(1, Math.ceil(textUnits(text) * size / Math.max(1, width)));
    if (lines * size * lineHeight <= height) return size;
  }
  return smallest;
}

function layerText(layer: StoryboardLayer): string {
  return layer.text ?? String(layer.value ?? layer.label ?? '');
}

function entry(scene: StoryboardScene, layer: StoryboardLayer | undefined, index: number, frame: number, family: FamilyId, tokens: StyleTokens): React.CSSProperties {
  const beat = layer ? scene.beats.find((item) => item.target === layer.id && ['enter', 'reveal', 'count'].includes(item.action)) : undefined;
  const playful = family === 'scatterbrain';
  const editorial = family === 'retro-zine' || family === 'archive-grid';
  const start = beat?.start ?? 4 + index * (playful ? 16 : 10);
  const duration = beat?.duration ?? tokens.motionRules.enter.durationFrames;
  const raw = clamp((frame - start) / Math.max(1, duration));
  const eased = 1 - Math.pow(1 - raw, playful ? 3 : 2);
  const translate = (1 - eased) * tokens.motion.enterOffset * (playful ? 1.25 : editorial ? 1.5 : 1);
  return {
    opacity: eased,
    transform: editorial
      ? `translateX(${-translate}px)`
      : playful
        ? `translateY(${translate}px) rotate(${(index % 2 === 0 ? -1 : 1) * (1 - eased) * 5}deg)`
        : `translateY(${translate}px)`
  };
}

function rootTransition(scene: StoryboardScene, frame: number, overlapOutFrames: number): React.CSSProperties {
  const exitFrames = overlapOutFrames > 0
    ? overlapOutFrames
    : (scene.outro?.fadeFrames ?? (scene.transitionOut ? 12 : 0));
  const out = exitFrames > 0 ? interpolate(frame, [scene.durationFrames - exitFrames, scene.durationFrames], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp'
  }) : 0;
  const incoming = scene.transitionIn;
  const entering = incoming ? clamp(frame / incoming.durationFrames) : 1;
  return {
    opacity: (1 - out) * (incoming?.type === 'overlap-slide' ? 1 : entering),
    clipPath: incoming?.type === 'overlap-slide'
      ? `inset(0 ${(1 - entering) * 100}% 0 0)`
      : scene.transitionOut === 'paper-wipe' && overlapOutFrames === 0
        ? `inset(0 ${out * 100}% 0 0)`
        : undefined,
    transform: incoming?.type === 'overlap-carry'
      ? `translateY(${(1 - entering) * 24}px)`
      : scene.transitionOut === 'slide'
        ? `translateX(${-8 * out}%)`
        : scene.transitionOut === 'carry'
          ? `translateY(${-20 * out}px)`
          : undefined
  };
}

function subtitle(scene: StoryboardScene): string | undefined {
  return scene.layers.find((layer) => layer.semanticRole === 'subtitle')?.text
    ?? scene.layers.find((layer) => layer.type === 'annotation')?.text;
}

function roleContent(scene: StoryboardScene): StoryboardLayer[] {
  if (scene.purpose === 'evidence') return scene.layers.filter((layer) => layer.type === 'metric');
  return scene.layers.filter((layer) => layer.type === 'node' || layer.type === 'card');
}

function itemHeading(item: StoryboardLayer, purpose: StoryboardScene['purpose'], scene: StoryboardScene, frame: number): string {
  if (purpose !== 'evidence') return item.label ?? layerText(item);
  const raw = item.value ?? '';
  const count = scene.beats.find((beat) => beat.target === item.id && beat.action === 'count');
  if (!count || typeof raw !== 'number') return String(raw);
  const decimals = String(raw).split('.')[1]?.length ?? 0;
  return (raw * clamp((frame - count.start) / count.duration)).toFixed(decimals);
}

function itemDescription(item: StoryboardLayer, purpose: StoryboardScene['purpose']): string | undefined {
  return purpose === 'evidence' ? item.label ?? item.text : item.label ? item.text : undefined;
}

interface LayoutProps {
  scene: StoryboardScene;
  tokens: StyleTokens;
  frame: number;
  width: number;
  height: number;
  scale: number;
  portrait: boolean;
  activeCaption?: StoryboardCaption;
}

const full: React.CSSProperties = {position: 'absolute', inset: 0};

function ZineLayout({scene, tokens, frame, width, height, scale, portrait, activeCaption}: LayoutProps) {
  const purpose = scene.purpose;
  const items = roleContent(scene);
  const media = scene.layers.find((layer) => layer.type === 'screenshot' || layer.type === 'object');
  const note = subtitle(scene);
  const accent = tokens.accent;
  const masthead = <div style={{position: 'absolute', top: 0, left: 0, right: 0, height: 36 * scale, borderBottom: `3px solid ${tokens.ink}`, display: 'flex', justifyContent: 'space-between', fontSize: 17 * scale, letterSpacing: 3 * scale, fontWeight: 800}}><span>FIELD NOTES</span><span>{purpose?.toUpperCase()}</span></div>;
  const footer = <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, borderTop: `2px solid ${tokens.ink}`, paddingTop: 14 * scale, display: 'flex', justifyContent: 'space-between', fontSize: 16 * scale, letterSpacing: 2 * scale}}><span>VISUAL STORY</span><span>◆</span></div>;

  let body: React.ReactNode;
  const sequenceScene = purpose === 'process'
    || purpose === 'opening'
    || purpose === 'claim'
    || purpose === 'closing';
  if (sequenceScene || purpose === 'evidence') {
    const sidebarWidth = portrait ? width : width * 0.32;
    const sidebarHeight = portrait ? height * 0.22 : height * 0.69;
    const sideFont = fittedFont(scene.title, sidebarWidth * 0.9, sidebarHeight * 0.75, 76 * scale, 34 * scale, 1.08);
    if (sequenceScene) {
      const routeWidth = portrait ? width : width * 0.62;
      const routeHeight = portrait ? height * 0.5 : height * 0.62;
      const routeTop = portrait ? height * 0.33 : height * 0.22;
      const routeLeft = portrait ? 0 : width * 0.36;
      const routeLabel = scene.primaryClaim ?? '沿着一个入口继续回查，不必重新搜索。';
      const routeLabelSize = fittedFont(routeLabel, sidebarWidth * 0.88, sidebarHeight * 0.25, 25 * scale, 16 * scale, 1.25);
      const segmentWidth = 100 / Math.max(1, items.length);
      const activeFocus = scene.beats
        .filter((beat) => ['focus', 'highlight'].includes(beat.action) && beat.start <= frame)
        .sort((a, b) => b.start - a.start)[0];
      const activeIndex = Math.max(0, items.findIndex((item) => item.id === activeFocus?.target));

      body = <>
        <div style={{position: 'absolute', left: 0, top: height * 0.18, width: sidebarWidth, height: sidebarHeight, borderRight: portrait ? undefined : `3px solid ${tokens.ink}`, borderBottom: portrait ? `3px solid ${tokens.ink}` : undefined, paddingRight: 24 * scale}}>
          <div style={{fontFamily: tokens.displayFont, fontSize: sideFont, lineHeight: 1.08, fontWeight: 700}}>{scene.title}</div>
          <div style={{marginTop: 28 * scale, maxWidth: sidebarWidth * 0.88, fontSize: routeLabelSize, lineHeight: 1.25, color: tokens.muted}}>{routeLabel}</div>
          <div style={{position: 'absolute', left: 0, bottom: 0, fontSize: 16 * scale, letterSpacing: 2 * scale, fontWeight: 800, color: tokens.accent}}>FOLLOW THE THREAD</div>
        </div>
        <div style={{position: 'absolute', left: routeLeft, top: routeTop, width: routeWidth, height: routeHeight}}>
          <div style={{position: 'absolute', left: 0, right: 0, top: '50%', height: 3 * scale, background: tokens.grid, transform: 'translateY(-50%)'}} />
          {items.slice(0, -1).map((item, index) => {
            const nextItem = items[index + 1];
            if (!nextItem) return null;
            const enterBeat = scene.beats.find((beat) => beat.target === nextItem.id && ['enter', 'reveal'].includes(beat.action));
            const reveal = clamp((frame - (enterBeat?.start ?? 8 + (index + 1) * 13)) / 18);
            const active = index <= activeIndex;
            const connection = scene.connections.find((candidate) => candidate.from === item.id && candidate.to === nextItem.id);
            const lineColor = active ? tokens.accentAlt : tokens.grid;
            return <div key={`${item.id}-${nextItem.id}`} style={{position: 'absolute', left: `${(index + 0.5) * segmentWidth}%`, top: '50%', width: `${segmentWidth}%`, height: 14 * scale, transform: 'translateY(-50%)', opacity: reveal}}>
              <div style={{position: 'absolute', left: 0, top: 5 * scale, width: '100%', height: 4 * scale, background: lineColor}} />
              <div style={{position: 'absolute', right: -2 * scale, top: 1 * scale, width: 10 * scale, height: 10 * scale, borderTop: `4px solid ${lineColor}`, borderRight: `4px solid ${lineColor}`, transform: 'rotate(45deg)'}} />
              {connection?.label ? <div style={{position: 'absolute', left: '50%', top: -29 * scale, transform: 'translateX(-50%)', whiteSpace: 'nowrap', fontSize: 14 * scale, color: tokens.muted}}>{connection.label}</div> : null}
            </div>;
          })}
          <div style={{position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, items.length)}, minmax(0, 1fr))`, gap: 10 * scale, alignItems: 'center'}}>
            {items.map((item, index) => {
              const enterBeat = scene.beats.find((beat) => beat.target === item.id && ['enter', 'reveal'].includes(beat.action));
              const appearance = clamp((frame - (enterBeat?.start ?? 8 + index * 13)) / Math.max(1, enterBeat?.duration ?? tokens.motionRules.enter.durationFrames));
              const completed = index < activeIndex;
              const current = index === activeIndex;
              const itemTitle = itemHeading(item, purpose, scene, frame);
              const itemNote = itemDescription(item, purpose);
              const nodeFont = fittedFont(itemTitle, routeWidth / Math.max(1, items.length) * 0.72, routeHeight * 0.25, 34 * scale, 18 * scale, 1.1);
              const borderColor = current ? tokens.ink : completed ? tokens.accentAlt : tokens.grid;
              return <div key={item.id} style={{minWidth: 0, minHeight: routeHeight * 0.52, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: `${20 * scale}px ${14 * scale}px`, background: current ? tokens.accent : completed ? '#dce7d3' : tokens.paper, color: current ? tokens.paper : tokens.ink, border: `3px solid ${borderColor}`, boxShadow: current ? `${8 * scale}px ${8 * scale}px 0 ${tokens.accentAlt}` : `4px 4px 0 ${tokens.grid}`, opacity: appearance, transform: `translateY(${(1 - appearance) * tokens.motion.enterOffset}px) scale(${current ? 1.025 : 1})`, zIndex: 1}}>
                <div style={{fontSize: 15 * scale, letterSpacing: 2 * scale, fontWeight: 800, color: current ? tokens.paper : tokens.accentAlt}}>0{index + 1}</div>
                <div style={{marginTop: 12 * scale, fontFamily: tokens.displayFont, fontSize: nodeFont, lineHeight: 1.1, fontWeight: 800, overflowWrap: 'anywhere'}}>{itemTitle}</div>
                {itemNote ? <div style={{marginTop: 12 * scale, fontSize: 16 * scale, lineHeight: 1.25, color: current ? '#fffaf0' : tokens.muted, overflowWrap: 'anywhere'}}>{itemNote}</div> : null}
              </div>;
            })}
          </div>
        </div>
      </>;
    } else {
      body = <>
        <div style={{position: 'absolute', left: 0, top: height * 0.19, width: sidebarWidth, height: sidebarHeight, borderRight: portrait ? undefined : `3px solid ${tokens.ink}`, borderBottom: portrait ? `3px solid ${tokens.ink}` : undefined, paddingRight: 24 * scale, fontFamily: tokens.displayFont, fontSize: sideFont, lineHeight: 1.08, fontWeight: 700}}>{scene.title}</div>
        <div style={{position: 'absolute', top: portrait ? height * 0.45 : height * 0.18, right: 0, width: portrait ? width : width * 0.61, height: portrait ? height * 0.42 : height * 0.69, display: 'grid', gridTemplateRows: `repeat(${Math.max(1, items.length)}, minmax(0, 1fr))`, gap: 10 * scale}}>
          {items.map((item, index) => {
            const activeBeat = scene.beats
              .filter((beat) => ['focus', 'highlight'].includes(beat.action) && beat.start <= frame)
              .sort((a, b) => b.start - a.start)[0];
            const focused = activeBeat ? activeBeat.target === item.id : index === 0;
            return <div key={item.id} style={{minHeight: 0, display: 'flex', alignItems: 'center', gap: 24 * scale, background: focused ? '#dce7d3' : tokens.paper, borderLeft: focused ? `8px solid ${tokens.accentAlt}` : '8px solid transparent', borderBottom: `3px solid ${tokens.ink}`, padding: `8px ${22 * scale}px`, ...entry(scene, item, index, frame, 'retro-zine', tokens)}}>
            <strong style={{fontFamily: tokens.displayFont, fontSize: 58 * scale, color: accent, flexShrink: 0}}>{itemHeading(item, purpose, scene, frame)}</strong>
            <div style={{minWidth: 0}}><div style={{fontWeight: 800, fontSize: fittedFont(itemDescription(item, purpose) ?? '', portrait ? width * 0.67 : width * 0.42, height * 0.12 / Math.max(1, items.length / 3), 38 * scale, 22 * scale)}}>{itemDescription(item, purpose)}</div></div>
          </div>})}
        </div>
      </>;
    }
  } else if (purpose === 'media' && media) {
    body = <>
      <div style={{position: 'absolute', left: 0, top: height * 0.18, width: portrait ? width : width * 0.67, height: portrait ? height * 0.48 : height * 0.65, padding: 18 * scale, border: `3px solid ${tokens.ink}`, background: tokens.paper, boxShadow: `${18 * scale}px ${18 * scale}px 0 ${accent}`, ...entry(scene, media, 0, frame, 'retro-zine', tokens)}}>{media.assetDataUri ? <Img src={media.assetDataUri} style={{width: '100%', height: '100%', objectFit: media.fit ?? 'contain'}} /> : null}</div>
      <div style={{position: 'absolute', left: portrait ? 0 : width * 0.73, top: portrait ? height * 0.7 : height * 0.26, width: portrait ? width : width * 0.26, fontFamily: tokens.displayFont, fontSize: fittedFont(scene.title, portrait ? width : width * 0.26, height * 0.3, 63 * scale, 28 * scale), lineHeight: 1.08}}>{scene.title}</div>
      {media.label ? <div style={{position: 'absolute', left: 0, bottom: height * 0.08, fontSize: 18 * scale}}>SOURCE / {media.label}</div> : null}
    </>;
  } else {
    const statementSupport = scene.primaryClaim && scene.primaryClaim !== note ? scene.primaryClaim : undefined;
    const labels = scene.layers.filter((layer) => layer.type === 'label');
    body = <>
      <div style={{position: 'absolute', left: 0, top: height * 0.21, padding: `${10 * scale}px ${16 * scale}px`, color: tokens.paper, background: accent, fontSize: 20 * scale, fontWeight: 800, ...entry(scene, undefined, 0, frame, 'retro-zine', tokens)}}>VISUAL ESSAY</div>
      {statementSupport ? <div style={{position: 'absolute', left: width * 0.04, top: height * 0.3, maxWidth: width * 0.72, color: tokens.muted, borderLeft: `7px solid ${tokens.accentAlt}`, paddingLeft: 18 * scale, fontSize: fittedFont(statementSupport, width * 0.7, height * 0.12, 22 * scale, 16 * scale, 1.25), lineHeight: 1.25, ...entry(scene, undefined, 1, frame, 'retro-zine', tokens)}}>{statementSupport}</div> : null}
      <h1 style={{position: 'absolute', left: 0, top: height * 0.39, width: portrait ? width * 0.92 : width * 0.64, height: height * 0.32, margin: 0, fontFamily: tokens.displayFont, fontSize: fittedFont(scene.title, width * (portrait ? 0.92 : 0.64), height * 0.32, (portrait ? 105 : 146) * scale, 46 * scale, 1.06), lineHeight: 1.06, overflowWrap: 'anywhere', ...entry(scene, undefined, 0, frame, 'retro-zine', tokens)}}>{scene.title}</h1>
      {labels.length > 0 ? <div style={{position: 'absolute', right: portrait ? 0 : width * 0.03, top: height * 0.31, width: portrait ? width * 0.86 : width * 0.23, display: 'flex', flexDirection: 'column', gap: 12 * scale}}>
        {labels.map((label, index) => <div key={label.id} style={{display: 'flex', alignItems: 'center', gap: 10 * scale, ...entry(scene, label, index, frame, 'retro-zine', tokens)}}>
          <span style={{width: 14 * scale, height: 14 * scale, flexShrink: 0, borderRadius: '50%', background: index % 2 === 0 ? accent : tokens.accentAlt, border: `2px solid ${tokens.ink}`}} />
          <span style={{flex: 1, padding: `${10 * scale}px ${12 * scale}px`, border: `3px solid ${tokens.ink}`, background: index % 2 === 0 ? tokens.paper : '#dce7d3', fontSize: 20 * scale, fontWeight: 800, lineHeight: 1.15, overflowWrap: 'anywhere'}}>{label.label ?? layerText(label)}</span>
        </div>)}
      </div> : null}
      {!portrait ? <div style={{position: 'absolute', right: width * 0.06, top: height * 0.43, width: width * 0.14, aspectRatio: '1', borderRadius: '50%', border: `5px solid ${tokens.ink}`, boxShadow: `${14 * scale}px ${14 * scale}px 0 ${accent}`}} /> : null}
    </>;
  }
  return <div style={{...full, color: tokens.ink}}>{masthead}{body}{footer}</div>;
}

function SignalLayout({scene, tokens, frame, width, height, scale, portrait}: LayoutProps) {
  const purpose = scene.purpose;
  const items = roleContent(scene);
  const media = scene.layers.find((layer) => layer.type === 'screenshot' || layer.type === 'object');
  const note = subtitle(scene);
  const titleSize = fittedFont(scene.title, width * 0.8, height * 0.36, (portrait ? 108 : 136) * scale, 42 * scale);
  const edge: React.CSSProperties = {fontSize: 17 * scale, letterSpacing: 3 * scale, fontWeight: 800, color: '#bad0d0'};
  let body: React.ReactNode;
  if (purpose === 'process' || purpose === 'evidence') {
    const columns = portrait ? (items.length > 3 ? 2 : 1) : Math.min(3, Math.max(1, items.length));
    body = <>
      <h1 style={{position: 'absolute', left: 0, top: height * 0.2, width: width * 0.95, margin: 0, fontSize: fittedFont(scene.title, width * 0.95, height * 0.17, 74 * scale, 34 * scale), lineHeight: 1.1}}>{scene.title}</h1>
      <div style={{position: 'absolute', top: portrait ? height * 0.38 : height * 0.46, left: 0, right: 0, bottom: height * 0.12, display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 24 * scale, alignContent: 'stretch'}}>
        {items.map((item, index) => <div key={item.id} style={{minWidth: 0, borderTop: `6px solid ${index % 3 === 1 ? '#f2cf79' : index % 3 === 2 ? '#849ddd' : tokens.accent}`, paddingTop: 24 * scale, ...entry(scene, item, index, frame, 'signal', tokens)}}>
          <div style={{fontSize: 64 * scale, fontWeight: 700, lineHeight: 1, color: index % 3 === 1 ? '#f2cf79' : index % 3 === 2 ? '#849ddd' : tokens.accent}}>{purpose === 'evidence' ? itemHeading(item, purpose, scene, frame) : String(index + 1).padStart(2, '0')}</div>
          <div style={{fontSize: 39 * scale, fontWeight: 800, marginTop: 16 * scale, lineHeight: 1.13}}>{purpose === 'evidence' ? itemDescription(item, purpose) : itemHeading(item, purpose, scene, frame)}</div>
          {purpose !== 'evidence' && item.label && item.text ? <div style={{fontSize: 22 * scale, color: '#bdd0cf', marginTop: 12 * scale, lineHeight: 1.25}}>{item.text}</div> : null}
        </div>)}
      </div>
    </>;
  } else if (purpose === 'media' && media) {
    body = <>
      <div style={{position: 'absolute', left: 0, top: height * 0.2, width: portrait ? width : width * 0.7, height: portrait ? height * 0.51 : height * 0.64, border: `2px solid #7d9da0`, overflow: 'hidden', ...entry(scene, media, 0, frame, 'signal', tokens)}}>{media.assetDataUri ? <Img src={media.assetDataUri} style={{width: '100%', height: '100%', objectFit: media.fit ?? 'contain'}} /> : null}</div>
      <div style={{position: 'absolute', left: portrait ? 0 : width * 0.75, top: portrait ? height * 0.75 : height * 0.35, width: portrait ? width : width * 0.24, borderTop: `5px solid ${tokens.accent}`, paddingTop: 18 * scale, fontSize: fittedFont(scene.title, portrait ? width : width * 0.24, portrait ? height * 0.14 : height * 0.25, portrait ? 52 * scale : 58 * scale, 27 * scale), lineHeight: 1.12, fontWeight: 800}}>{scene.title}</div>
      {media.label ? <div style={{position: 'absolute', left: 0, bottom: portrait ? height * 0.27 : height * 0.07, ...edge}}>SOURCE / {media.label}</div> : null}
    </>;
  } else {
    body = <>
      <div style={{position: 'absolute', left: 0, top: height * 0.3, width: 20 * scale, height: height * 0.35, background: tokens.accent, ...entry(scene, undefined, 0, frame, 'signal', tokens)}} />
      <h1 style={{position: 'absolute', left: 56 * scale, top: height * 0.3, width: width * 0.78, margin: 0, fontSize: titleSize, fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.04em', overflowWrap: 'anywhere', ...entry(scene, undefined, 1, frame, 'signal', tokens)}}>{scene.title}</h1>
      {note ? <div style={{position: 'absolute', left: 56 * scale, bottom: height * 0.12, maxWidth: width * 0.8, color: '#bdd0cf', fontSize: 27 * scale, ...entry(scene, scene.layers.find((item) => item.text === note), 2, frame, 'signal', tokens)}}>{note}</div> : null}
      {!portrait ? <div style={{position: 'absolute', right: width * 0.04, top: height * 0.35, width: width * 0.12, aspectRatio: '1', border: `3px solid ${tokens.accent}`, borderRadius: '50%', boxShadow: `inset 0 0 0 ${25 * scale}px #44e0d318, 0 0 ${56 * scale}px #44e0d344`}} /> : null}
    </>;
  }
  return <div style={{...full, color: tokens.ink}}><div style={{position: 'absolute', top: 0, left: 0, right: 0, borderBottom: '1px solid #748b8c', paddingBottom: 18 * scale, display: 'flex', justifyContent: 'space-between', ...edge}}><span>SIGNAL / {purpose?.toUpperCase()}</span><span style={{color: tokens.accent}}>● FRAME</span></div>{body}<div style={{position: 'absolute', bottom: 0, left: 0, right: 0, borderTop: '1px solid #748b8c', paddingTop: 16 * scale, display: 'flex', justifyContent: 'space-between', ...edge}}><span>ONE IDEA / ONE FRAME</span><span>◆</span></div></div>;
}

function ScatterLayout({scene, tokens, frame, width, height, scale, portrait}: LayoutProps) {
  const purpose = scene.purpose;
  const items = roleContent(scene);
  const media = scene.layers.find((layer) => layer.type === 'screenshot' || layer.type === 'object');
  const note = subtitle(scene);
  let body: React.ReactNode;
  if (purpose === 'process' || purpose === 'evidence') {
    const columns = portrait ? (items.length > 3 ? 2 : 1) : Math.min(3, Math.max(1, items.length));
    body = <>
      <h1 style={{position: 'absolute', top: height * 0.08, left: width * 0.04, width: width * 0.92, margin: 0, fontFamily: tokens.displayFont, fontSize: fittedFont(scene.title, width * 0.92, height * 0.18, 68 * scale, 34 * scale), lineHeight: 1.12, transform: 'rotate(-2deg)'}}>{scene.title}</h1>
      <div style={{position: 'absolute', top: height * 0.31, left: width * 0.03, right: width * 0.03, bottom: height * 0.08, display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 20 * scale, alignItems: 'stretch'}}>
        {items.map((item, index) => <div key={item.id} style={{position: 'relative', minWidth: 0, background: [tokens.accent, '#d8e9fa', '#e8efc8'][index % 3], border: `4px solid ${tokens.ink}`, borderRadius: 8 * scale, boxShadow: `${9 * scale}px ${11 * scale}px 0 #24211f33`, padding: 27 * scale, rotate: `${index % 2 ? 2 : -2}deg`, ...entry(scene, item, index, frame, 'scatterbrain', tokens)}}>
          <div style={{position: 'absolute', left: '48%', top: -11 * scale, width: 20 * scale, height: 20 * scale, borderRadius: '50%', background: '#e65335', border: `2px solid ${tokens.ink}`}} />
          <div style={{fontSize: 23 * scale, fontWeight: 900}}>{purpose === 'evidence' ? 'DATA' : String(index + 1).padStart(2, '0')}</div>
          <div style={{fontFamily: tokens.displayFont, fontWeight: 800, fontSize: fittedFont(itemHeading(item, purpose, scene, frame), width / columns * 0.7, height * 0.18, 48 * scale, 25 * scale), lineHeight: 1.12, marginTop: 20 * scale}}>{itemHeading(item, purpose, scene, frame)}</div>
          {itemDescription(item, purpose) ? <div style={{fontSize: 22 * scale, lineHeight: 1.2, marginTop: 16 * scale}}>{itemDescription(item, purpose)}</div> : null}
        </div>)}
      </div>
    </>;
  } else if (purpose === 'media' && media) {
    body = <>
      <div style={{position: 'absolute', left: portrait ? width * 0.07 : width * 0.04, top: height * 0.17, width: portrait ? width * 0.85 : width * 0.67, height: portrait ? height * 0.51 : height * 0.66, background: tokens.paper, border: `5px solid ${tokens.ink}`, padding: 21 * scale, boxShadow: `${16 * scale}px ${18 * scale}px 0 ${tokens.accent}`, rotate: '-2deg', ...entry(scene, media, 0, frame, 'scatterbrain', tokens)}}>{media.assetDataUri ? <Img src={media.assetDataUri} style={{width: '100%', height: '100%', objectFit: media.fit ?? 'contain'}} /> : null}</div>
      <div style={{position: 'absolute', left: portrait ? width * 0.07 : width * 0.76, top: portrait ? height * 0.77 : height * 0.28, width: portrait ? width * 0.85 : width * 0.22, fontFamily: tokens.displayFont, fontSize: fittedFont(scene.title, portrait ? width * 0.85 : width * 0.22, portrait ? height * 0.13 : height * 0.32, portrait ? 52 * scale : 62 * scale, 28 * scale), lineHeight: 1.12, rotate: '3deg'}}>{scene.title}</div>
      {media.label ? <div style={{position: 'absolute', left: width * 0.05, bottom: portrait ? height * 0.27 : height * 0.05, fontSize: 18 * scale}}>SOURCE / {media.label}</div> : null}
    </>;
  } else {
    const titleSize = fittedFont(scene.title, width * 0.71, height * 0.42, (portrait ? 110 : 136) * scale, 42 * scale);
    body = <>
      <div style={{position: 'absolute', left: portrait ? width * 0.05 : width * 0.13, top: height * 0.18, width: portrait ? width * 0.9 : width * 0.73, height: height * 0.64, background: purpose === 'closing' ? tokens.paper : tokens.accent, border: `5px solid ${tokens.ink}`, borderRadius: 16 * scale, boxShadow: `${18 * scale}px ${21 * scale}px 0 ${tokens.accentAlt}`, rotate: '-2deg', padding: 45 * scale, ...entry(scene, undefined, 0, frame, 'scatterbrain', tokens)}}>
        <div style={{position: 'absolute', width: width * 0.14, height: 30 * scale, top: -18 * scale, left: '42%', background: '#a8c8e7aa', rotate: '-6deg'}} />
        <h1 style={{margin: 0, fontFamily: tokens.displayFont, fontSize: titleSize, lineHeight: 1.12, overflowWrap: 'anywhere'}}>{scene.title}</h1>
        {note ? <div style={{fontSize: 26 * scale, lineHeight: 1.25, marginTop: 25 * scale}}>{note}</div> : null}
        {purpose === 'closing' ? <div style={{height: 7 * scale, background: tokens.accentAlt, width: '66%', marginTop: 24 * scale, rotate: '-2deg'}} /> : null}
      </div>
    </>;
  }
  return <div style={{...full, color: tokens.ink}}>{body}</div>;
}

const familyLayouts: Record<FamilyId, React.ComponentType<LayoutProps>> = {
  'retro-zine': ZineLayout,
  signal: SignalLayout,
  scatterbrain: ScatterLayout,
  'archive-grid': CleanEditorialLayout,
  'signal-noir': BlueprintLayout,
  'studio-frame': ProductFrameLayout
};

export function TemplateFamilyScene({scene, tokens, showSceneCaptions, externalCaptions, overlapOutFrames}: Props) {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const portrait = width < height;
  const family = tokens.id as FamilyId;
  const activeCaption = showSceneCaptions ? scene.captions.flatMap((caption) => splitCaptionWindow(caption.text, caption.start, caption.end)).find((caption) => frame >= caption.start && frame < caption.end) : undefined;
  const captionReserve = ((scene.captions.length > 0 && showSceneCaptions) || externalCaptions)
    ? (portrait ? 170 : 125)
    : 0;
  const innerWidth = width - tokens.safeArea.left - tokens.safeArea.right;
  const innerHeight = height - tokens.safeArea.top - tokens.safeArea.bottom - captionReserve;
  const scale = portrait ? width / 1080 : width / 1920;
  const layoutProps = {scene, tokens, frame, width: innerWidth, height: innerHeight, scale, portrait, activeCaption: undefined};
  const Layout = familyLayouts[family];
  return <AbsoluteFill style={{backgroundColor: tokens.background, color: tokens.ink, fontFamily: tokens.bodyFont, overflow: 'hidden', ...rootTransition(scene, frame, overlapOutFrames)}}>
    {family === 'retro-zine' ? <AbsoluteFill style={{backgroundImage: `linear-gradient(${tokens.grid}55 1px, transparent 1px), linear-gradient(90deg, ${tokens.grid}55 1px, transparent 1px)`, backgroundSize: `${64 * scale}px ${64 * scale}px`, opacity: 0.65}} /> : null}
    {family === 'scatterbrain' ? <AbsoluteFill style={{backgroundImage: `radial-gradient(${tokens.grid} 2px, transparent 2px)`, backgroundSize: `${34 * scale}px ${34 * scale}px`, opacity: 0.62}} /> : null}
    {family === 'signal' ? <AbsoluteFill style={{backgroundImage: `radial-gradient(circle at 82% 32%, ${tokens.accent}27, transparent 26%)`}} /> : null}
    {family === 'signal-noir' ? <AbsoluteFill style={{backgroundImage: `linear-gradient(${tokens.grid}30 1px, transparent 1px), linear-gradient(90deg, ${tokens.grid}30 1px, transparent 1px)`, backgroundSize: `${56 * scale}px ${56 * scale}px`}} /> : null}
    <div style={{position: 'absolute', left: tokens.safeArea.left, right: tokens.safeArea.right, top: tokens.safeArea.top, bottom: tokens.safeArea.bottom + captionReserve}}>
      <Layout {...layoutProps} />
    </div>
    {activeCaption ? <div style={{position: 'absolute', left: tokens.safeArea.left, right: tokens.safeArea.right, bottom: tokens.safeArea.bottom + 12 * scale, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', pointerEvents: 'none'}}>
      <div style={{...captionTextStyle(tokens), maxWidth: portrait ? 850 : 980, fontSize: (portrait ? 29 : 21) * scale, lineHeight: 1.25, padding: `${7 * scale}px ${16 * scale}px`}}>{activeCaption.text}</div>
    </div> : null}
  </AbsoluteFill>;
}
