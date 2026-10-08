import React from 'react';
import type {StoryboardScene} from '../../schemas/storyboard';
import type {StyleTokens} from '../../styles/style-loader';
import {entranceProgress} from '../../timeline/motion-progress';
import {getAttentionOpacity, getAttentionTarget} from '../../timeline/attention';
import {fittedSemanticFont, languageEntrance, styleLanguage} from './style-language';

interface Props {scene: StoryboardScene; tokens: StyleTokens; frame: number; scale: number; width: number; height: number; portrait: boolean}
export function StyleSequence({scene, tokens, frame, scale, width, height, portrait}: Props) {
  const family = styleLanguage(tokens.id)!;
  const items = scene.layers.filter(layer => layer.type === 'node' || layer.type === 'card');
  const focused = getAttentionTarget(scene, frame) ?? items[0]?.id;
  const gap = (portrait ? 28 : 40) * scale;
  const cellWidth = portrait ? width * .86 : (width - gap * (items.length - 1)) / Math.max(1, items.length);
  const cellHeight = portrait ? (height - gap * (items.length - 1)) / Math.max(1, items.length) : height * (family === 'blueprint' ? .48 : .76);
  const positions = items.map((_, index) => ({x: portrait ? width * .07 : index * (cellWidth + gap), y: portrait ? index * (cellHeight + gap) : height * (family === 'blueprint' ? index % 2 ? .42 : .08 : .12)}));
  return <div style={{position: 'relative', width, height}}>
    <svg aria-hidden width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{position: 'absolute', inset: 0}}>
      {scene.connections.map(connection => {
        const from = items.findIndex(item => item.id === connection.from); const to = items.findIndex(item => item.id === connection.to);
        if (from < 0 || to < 0) return null;
        const a = positions[from]!; const b = positions[to]!;
        const beat = scene.beats.find(item => item.target === connection.id && item.action === 'draw');
        const p = beat ? entranceProgress({frame, start: beat.start, duration: beat.duration, tokens, easing: tokens.motionRules.reveal.easing}) : 1;
        const x1 = a.x + (portrait ? cellWidth / 2 : cellWidth); const y1 = a.y + (portrait ? cellHeight : cellHeight / 2);
        const x2 = b.x + (portrait ? cellWidth / 2 : 0); const y2 = b.y + (portrait ? 0 : cellHeight / 2);
        const middle = (x1 + x2) / 2;
        const path = portrait ? `M${x1} ${y1} V${y2}` : family === 'blueprint' ? `M${x1} ${y1} H${middle} V${y2} H${x2}` : family === 'notes' ? `M${x1} ${y1} Q${middle} ${y1 - 24 * scale} ${x2} ${y2}` : `M${x1} ${y1} L${x2} ${y2}`;
        return <g key={connection.id} opacity={p}><path d={path} stroke={family === 'blueprint' ? tokens.accent : tokens.accentAlt} strokeWidth={3 * scale} fill="none" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - p} />{connection.label ? <text x={portrait ? x1 + 12 * scale : middle} y={portrait ? (y1 + y2) / 2 : Math.min(y1, y2) - 18 * scale} textAnchor={portrait ? 'start' : 'middle'} fill={tokens.muted} fontSize={22 * scale} fontFamily={tokens.bodyFont}>{connection.label}</text> : null}</g>;
      })}
    </svg>
    {items.map((layer, index) => {
      const point = positions[index]!; const active = focused === layer.id;
      const beat = scene.beats.find(item => item.target === layer.id && ['enter', 'reveal'].includes(item.action));
      const p = beat ? entranceProgress({frame, start: beat.start, duration: beat.duration, tokens}) : 1;
      const heading = layer.label ?? layer.text ?? '';
      const detail = layer.label ? layer.text : undefined;
      const textWidth = cellWidth - (portrait ? family === 'swiss' ? 180 : 100 : 48) * scale;
      const fontSize = fittedSemanticFont(heading, textWidth, cellHeight * .35, 58 * scale, 34 * scale);
      const card = family === 'notes' || family === 'swiss' || family === 'product' || family === 'blueprint' || family === 'signal';
      const fill = family === 'notes' ? index % 2 === 0 ? tokens.accent : tokens.paper
        : family === 'swiss' ? active ? tokens.accent : tokens.background
          : family === 'signal' ? active ? tokens.accent : tokens.background
            : family === 'blueprint' ? tokens.background : tokens.paper;
      const ink = family === 'swiss' && active ? '#ffffff' : family === 'signal' ? active ? '#16171d' : tokens.ink : family === 'blueprint' ? tokens.ink : '#23302b';
      const muted = family === 'swiss' && active ? '#ffffff' : family === 'signal' ? active ? '#35313f' : tokens.muted : family === 'blueprint' ? tokens.muted : '#526173';
      return <div key={layer.id} style={{position: 'absolute', left: point.x, top: point.y, width: cellWidth, height: cellHeight, padding: `${18 * scale}px ${24 * scale}px`, background: card ? fill : undefined, border: family === 'blueprint' ? `2px solid ${active ? tokens.accent : tokens.accentAlt}` : family === 'product' ? tokens.surfaceBorder : family === 'signal' && !active ? `2px solid ${tokens.grid}` : family === 'notes' && index % 2 ? `1px solid ${tokens.grid}` : undefined, borderLeft: family === 'editorial' && index ? `1px solid ${tokens.grid}` : undefined, borderRadius: family === 'signal' ? portrait ? 28 * scale : 120 * scale : family === 'product' ? 16 * scale : 0, boxShadow: family === 'notes' || family === 'product' ? tokens.surfaceShadow : undefined, color: ink, display: 'flex', flexDirection: portrait ? 'row' : 'column', alignItems: portrait ? 'center' : family === 'signal' ? 'center' : 'flex-start', justifyContent: 'center', gap: 16 * scale, rotate: family === 'notes' ? `${index % 2 ? 2 : -3}deg` : undefined, ...languageEntrance(p, tokens, scale, index), opacity: p * getAttentionOpacity(scene, layer.id, frame)}}>
        <span style={{fontFamily: tokens.font ? tokens.bodyFont : family === 'blueprint' ? 'monospace' : tokens.displayFont, fontSize: (family === 'swiss' ? 110 : family === 'editorial' ? 30 : 28) * scale, fontWeight: family === 'swiss' ? 800 : 500, lineHeight: 1, color: family === 'editorial' ? tokens.accentAlt : ink, flexShrink: 0}}>{family === 'blueprint' ? `0${index + 1}` : family === 'swiss' ? index + 1 : String(index + 1).padStart(2, '0')}</span>
        <div style={{minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 * scale, textAlign: family === 'signal' ? 'center' : 'left'}}><strong style={{fontFamily: tokens.displayFont, fontSize, lineHeight: 1.12, overflowWrap: 'anywhere'}}>{heading}</strong>{detail ? <span style={{fontSize: (portrait ? 29 : 31) * scale, color: muted, lineHeight: 1.25, overflowWrap: 'anywhere'}}>{detail}</span> : null}</div>
      </div>;
    })}
  </div>;
}
