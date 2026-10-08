import React from 'react';
import type {StoryboardScene} from '../../schemas/storyboard';
import type {StyleTokens} from '../../styles/style-loader';
import {entranceProgress} from '../../timeline/motion-progress';

// Inspired by video-shotcraft's doc-park-left-pill-deal recipe. The source stays
// visible while three document-supported conclusions arrive in narration order.
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => value * value * (3 - 2 * value);

function progressFor(scene: StoryboardScene, target: string, action: 'enter' | 'draw', frame: number, tokens: StyleTokens): number {
  const beat = scene.beats.find((item) => item.target === target && item.action === action);
  if (!beat) return 0;
  return entranceProgress({frame, start: beat.start, duration: beat.duration, tokens});
}

export function DocumentConclusionDeal({scene, tokens, frame, scale}: {
  scene: StoryboardScene;
  tokens: StyleTokens;
  frame: number;
  scale: number;
}) {
  const source = scene.layers.find((layer) => layer.id === scene.visual?.anchorId);
  if (!source) return null;
  const conclusions = scene.layers.filter((layer) => layer.id !== source.id && (layer.type === 'node' || layer.type === 'card'));
  const park = ease(clamp((frame - 9) / 38));
  const sourceEntrance = progressFor(scene, source.id, 'enter', frame, tokens);

  return <div style={{position: 'relative', width: '100%', height: '100%', overflow: 'hidden'}}>
    <div style={{
      position: 'absolute', top: '2%', left: `${25 * (1 - park)}%`, width: `${54 - 18 * park}%`, height: '94%',
      boxSizing: 'border-box', padding: `${28 * scale}px ${31 * scale}px`, overflow: 'hidden',
      background: tokens.paper, border: tokens.surfaceBorder, boxShadow: tokens.surfaceShadow,
      opacity: clamp(sourceEntrance), transform: `translateY(${(1 - sourceEntrance) * 28 * scale}px)`
    }}>
      <div style={{fontSize: 17 * scale, letterSpacing: 2 * scale, color: tokens.accentAlt, borderBottom: `2px solid ${tokens.grid}`, paddingBottom: 10 * scale}}>原文摘录 / {source.label}</div>
      <div style={{fontFamily: tokens.displayFont, fontSize: 29 * scale, lineHeight: 1.38, fontWeight: 700, marginTop: 24 * scale, overflowWrap: 'anywhere'}}>{source.text}</div>
      <div style={{position: 'absolute', left: 31 * scale, right: 31 * scale, bottom: 19 * scale, borderTop: `2px solid ${tokens.grid}`, paddingTop: 10 * scale, fontSize: 17 * scale, color: tokens.muted}}>来源：{scene.visual?.source}</div>
    </div>
    {conclusions.map((conclusion, index) => {
      const reveal = progressFor(scene, conclusion.id, 'enter', frame, tokens);
      const connection = scene.connections.find((item) => item.from === source.id && item.to === conclusion.id);
      const line = connection ? progressFor(scene, connection.id, 'draw', frame, tokens) : 0;
      const top = 2 + index * 32;
      return <React.Fragment key={conclusion.id}>
        <div style={{position: 'absolute', left: '36%', top: `${top + 14}%`, width: '12%', height: 3 * scale, background: tokens.accentAlt, transform: `scaleX(${clamp(line)})`, transformOrigin: 'left center'}} />
        <div style={{
          position: 'absolute', left: '49%', top: `${top}%`, width: '50%', height: '27%',
          boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 23 * scale,
          padding: `${12 * scale}px ${24 * scale}px`, background: tokens.paper,
          border: tokens.surfaceBorder, borderLeft: `${8 * scale}px solid ${tokens.accent}`,
          opacity: clamp(reveal), transform: `translateY(${(1 - clamp(reveal)) * 24 * scale}px) scale(${0.96 + 0.04 * clamp(reveal)})`
        }}>
          <span style={{fontFamily: tokens.displayFont, fontSize: 48 * scale, lineHeight: 1, color: tokens.accentAlt}}>{String(index + 1).padStart(2, '0')}</span>
          <div style={{minWidth: 0}}>
            <div style={{fontSize: 31 * scale, fontWeight: 800, lineHeight: 1.1}}>{conclusion.label}</div>
            <div style={{fontSize: 21 * scale, lineHeight: 1.25, color: tokens.muted, marginTop: 7 * scale, overflowWrap: 'anywhere'}}>{conclusion.text}</div>
          </div>
        </div>
      </React.Fragment>;
    })}
  </div>;
}
