import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import type {StoryboardConnection, StoryboardLayer, StoryboardScene} from '../schemas/storyboard';
import {getBeatProgress} from '../motion/beat-progress';
import type {StyleTokens} from '../styles/style-loader';

interface RenderConnectionProps {
  connection: StoryboardConnection;
  scene: StoryboardScene;
  tokens: StyleTokens;
}

function center(layer: StoryboardLayer) {
  return {
    x: (layer.x ?? 0) + (layer.width ?? 240) / 2,
    y: (layer.y ?? 0) + (layer.height ?? 120) / 2
  };
}

export function RenderConnection({connection, scene, tokens}: RenderConnectionProps) {
  const frame = useCurrentFrame();
  const fromLayer = scene.layers.find((layer) => layer.id === connection.from);
  const toLayer = scene.layers.find((layer) => layer.id === connection.to);
  if (!fromLayer || !toLayer) return null;
  const from = center(fromLayer);
  const to = center(toLayer);
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const drawBeat = scene.beats.find((beat) => beat.target === connection.id && beat.action === 'draw');
  const highlightBeat = scene.beats.find((beat) => beat.target === connection.id && beat.action === 'highlight');
  const drawProgress = drawBeat ? getBeatProgress(frame, drawBeat) : 1;
  const highlightProgress = getBeatProgress(frame, highlightBeat);
  const strokeWidth = interpolate(highlightProgress, [0, 1], [3, 7]);
  const stroke = highlightProgress > 0 ? tokens.accent : tokens.accentAlt;
  const labelX = (from.x + to.x) / 2;
  const labelY = (from.y + to.y) / 2 - 14;

  return (
    <svg style={{position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none'}}>
      <line
        x1={from.x} y1={from.y} x2={to.x} y2={to.y}
        stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round"
        strokeDasharray={length} strokeDashoffset={length * (1 - drawProgress)}
      />
      {connection.label && drawProgress > 0.75 ? (
        <text x={labelX} y={labelY} textAnchor="middle" fill={tokens.muted} fontFamily={tokens.bodyFont} fontSize={18}>
          {connection.label}
        </text>
      ) : null}
    </svg>
  );
}
