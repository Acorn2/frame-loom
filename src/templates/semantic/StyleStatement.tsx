import React from 'react';
import type {StoryboardScene} from '../../schemas/storyboard';
import type {StyleTokens} from '../../styles/style-loader';
import {entranceProgress} from '../../timeline/motion-progress';
import {fittedSemanticFont, languageEntrance, statementTitleLayout, styleLanguage} from './style-language';

interface Props {
  scene: StoryboardScene; tokens: StyleTokens; frame: number; scale: number;
  width: number; height: number; portrait: boolean; titleProgress: number;
}
export function StyleStatement({scene, tokens, frame, scale, width, height, portrait, titleProgress}: Props) {
  const family = styleLanguage(tokens.id)!;
  const labels = scene.layers.filter(layer => layer.type === 'label');
  const slot = statementTitleLayout(tokens.id, width, height, portrait, scale);
  const size = fittedSemanticFont(scene.title, slot.width, slot.height, slot.max, slot.min);
  const progress = (id: string) => {
    const beat = scene.beats.find(item => item.target === id && ['enter', 'reveal'].includes(item.action));
    return beat ? entranceProgress({frame, start: beat.start, duration: beat.duration, tokens}) : 1;
  };
  const meta = scene.purpose === 'closing' ? '结语' : scene.purpose === 'claim' ? '观点' : '开篇';
  const title: React.CSSProperties = {position: 'absolute', left: slot.left, top: slot.top, width: slot.width, margin: 0, fontFamily: tokens.displayFont, fontSize: size, fontWeight: family === 'editorial' || family === 'notes' ? 700 : 800, lineHeight: 1.12, overflowWrap: 'anywhere', textWrap: 'balance', textAlign: family === 'signal' ? 'center' : 'left', ...languageEntrance(titleProgress, tokens, scale)};
  const metaStyle: React.CSSProperties = {position: 'absolute', left: width * .02, top: height * .025, right: width * .02, fontSize: 25 * scale, color: tokens.muted, fontFamily: tokens.bodyFont, letterSpacing: 3 * scale};
  const footerLabels = (style: React.CSSProperties = {}) => <div style={{position: 'absolute', left: width * .02, right: width * .02, bottom: height * .17, display: 'flex', flexWrap: 'wrap', gap: 26 * scale, ...style}}>{labels.map((layer, index) => <span key={layer.id} style={{fontSize: 31 * scale, ...languageEntrance(progress(layer.id), tokens, scale, index)}}>{layer.label ?? layer.text}</span>)}</div>;
  if (family === 'editorial') return <div style={{position: 'relative', width, height}}>
    <div style={{...metaStyle, borderBottom: `2px solid ${tokens.ink}`, paddingBottom: 25 * scale}}>{meta}</div>
    <h1 style={title}>{scene.title}</h1>
    <div aria-hidden style={{position: 'absolute', left: slot.left, top: slot.top + slot.height + 16 * scale, width: 24 * scale, height: 24 * scale, background: tokens.accent, opacity: titleProgress}} />
    {labels[0] && !portrait ? <div style={{position: 'absolute', right: width * .01, top: height * .25, padding: 22 * scale, border: `3px solid ${tokens.accent}`, color: tokens.accentAlt, fontFamily: tokens.displayFont, fontSize: 31 * scale, rotate: '-8deg', ...languageEntrance(progress(labels[0].id), tokens, scale)}}>{labels[0].label ?? labels[0].text}</div> : null}
    {footerLabels()}
  </div>;
  if (family === 'swiss') return <div style={{position: 'relative', width, height}}>
    <div aria-hidden style={{position: 'absolute', right: 0, top: 0, width: portrait ? width * .09 : width * .29, height: height * .80, background: tokens.accent, opacity: titleProgress, display: 'grid', placeItems: 'center', color: tokens.onAccent ?? '#ffffff', fontSize: 280 * scale}}>{portrait ? '' : '→'}</div>
    <div style={{...metaStyle, right: width * .33, fontFamily: tokens.font ? tokens.bodyFont : 'monospace'}}>{meta}</div>
    <h1 style={title}>{scene.title}</h1>
    {footerLabels({right: width * (portrait ? .15 : .34), fontWeight: 700, color: tokens.accentText ?? tokens.accent})}
  </div>;
  if (family === 'notes') return <div style={{position: 'relative', width, height}}>
    <div style={{...metaStyle, color: tokens.accentAlt}}>{meta}</div>
    <div aria-hidden style={{position: 'absolute', left: width * .025, top: height * .15, width: slot.width + width * .045, height: height * .50, background: tokens.accent, rotate: '-3deg', boxShadow: `${12 * scale}px ${14 * scale}px 0 ${tokens.ink}12`, ...languageEntrance(titleProgress, tokens, scale)}} />
    <h1 style={{...title, color: tokens.onAccent ?? '#292929', rotate: '-3deg'}}>{scene.title}</h1>
    {footerLabels({bottom: height * .18, gap: 20 * scale, fontFamily: tokens.displayFont, color: tokens.accentAlt})}
    <svg aria-hidden width={width * .68} height={24 * scale} style={{position: 'absolute', left: width * .06, top: height * .68, color: tokens.accentAlt}} viewBox="0 0 600 24"><path d="M2 14 Q150 3 310 13 T590 7" fill="none" stroke="currentColor" strokeWidth="3" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - titleProgress} /></svg>
  </div>;
  if (family === 'signal') {
    const diameter = Math.min(width * .67, height * .76);
    return <div style={{position: 'relative', width, height}}>
      <div style={{...metaStyle, textAlign: 'center'}}>{meta}</div>
      <div aria-hidden style={{position: 'absolute', left: (width - diameter) / 2, top: height * .13, width: diameter, height: diameter, border: `2px solid ${tokens.accent}45`, borderRadius: '50%', opacity: titleProgress}} />
      <div aria-hidden style={{position: 'absolute', left: width * .49, top: height * .17, width: 22 * scale, height: 22 * scale, borderRadius: '50%', background: tokens.accent, opacity: titleProgress}} />
      <h1 style={title}>{scene.title}</h1>
      {footerLabels({bottom: height * .19, justifyContent: 'center', color: tokens.accentAlt})}
    </div>;
  }
  if (family === 'blueprint') return <div style={{position: 'relative', width, height}}>
    <div style={{...metaStyle, fontFamily: tokens.font ? tokens.bodyFont : 'monospace', color: tokens.accentAlt}}>{meta} / {labels.length ? `${String(labels.length).padStart(2, '0')} ITEMS` : 'STATEMENT'}</div>
    <h1 style={title}>{scene.title}</h1>
    <div style={{position: 'absolute', left: width * .02, right: width * .02, top: height * .61, height: height * .20, display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, Math.min(labels.length, 3))}, minmax(0, 1fr))`, gap: 30 * scale}}>{labels.map((layer, index) => <div key={layer.id} style={{border: `2px solid ${tokens.accentAlt}`, background: tokens.background, padding: 18 * scale, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 * scale, ...languageEntrance(progress(layer.id), tokens, scale, index)}}><span style={{font: `${24 * scale}px ${tokens.font ? tokens.bodyFont : "monospace"}`, color: tokens.accentAlt}}>{String(index + 1).padStart(2, '0')}</span><strong style={{fontSize: 37 * scale}}>{layer.label ?? layer.text}</strong></div>)}</div>
  </div>;
  return <div style={{position: 'relative', width, height}}>
    <div style={metaStyle}>{meta}</div>
    <h1 style={title}>{scene.title}</h1>
    {labels.length ? <div style={{position: 'absolute', left: portrait ? width * .02 : width * .43, top: portrait ? height * .46 : height * .18, width: portrait ? width * .96 : width * .55, height: portrait ? height * .34 : height * .58, border: tokens.surfaceBorder, borderRadius: 18 * scale, background: tokens.paper, boxShadow: tokens.surfaceShadow, overflow: 'hidden', ...languageEntrance(titleProgress, tokens, scale)}}>
      <div style={{height: '19%', display: 'flex', alignItems: 'center', padding: `0 ${24 * scale}px`, borderBottom: `1px solid ${tokens.grid}`, color: tokens.muted, fontSize: 26 * scale}}>图解</div>
      <div style={{height: '81%', display: 'grid', gridTemplateRows: `repeat(${labels.length}, 1fr)`}}>{labels.map((layer, index) => <div key={layer.id} style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${30 * scale}px`, background: index === 1 ? tokens.accent : tokens.paper, color: tokens.palette ? index === 1 ? tokens.onAccent : tokens.paperInk : '#23302b', borderBottom: `1px solid ${tokens.grid}`, fontSize: 35 * scale, fontWeight: 600, ...languageEntrance(progress(layer.id), tokens, scale, index)}}><span>{layer.label ?? layer.text}</span><span style={{font: `${24 * scale}px ${tokens.font ? tokens.bodyFont : "monospace"}`}}>{String(index + 1).padStart(2, '0')}</span></div>)}</div>
    </div> : <div aria-hidden style={{position: 'absolute', left: portrait ? width * .12 : width * .47, right: width * .04, top: height * .26, height: height * .35, border: `2px solid ${tokens.grid}`, borderRadius: 18 * scale, background: tokens.paper}} />}
  </div>;
}
