import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import type {StoryboardConnection, StoryboardScene} from '../schemas/storyboard';
import {getBeatProgress} from '../motion/beat-progress';
import type {StyleTokens} from '../styles/style-loader';
import {getNodeState} from './node-state';
import {getConnectionGeometry} from './connection-geometry';

interface RenderConnectionProps {
  connection: StoryboardConnection;
  scene: StoryboardScene;
  tokens: StyleTokens;
}

export function RenderConnection({connection, scene, tokens}: RenderConnectionProps) {
  const frame = useCurrentFrame();
  const fromLayer = scene.layers.find((layer) => layer.id === connection.from);
  const toLayer = scene.layers.find((layer) => layer.id === connection.to);
  if (!fromLayer || !toLayer) return null;
  const geometry = getConnectionGeometry(fromLayer, toLayer);
  const drawBeat = scene.beats.find((beat) => beat.target === connection.id && beat.action === 'draw');
  const highlightBeat = scene.beats.find((beat) => beat.target === connection.id && beat.action === 'highlight');
  const drawProgress = drawBeat ? getBeatProgress(frame, drawBeat) : 1;
  const highlightProgress = getBeatProgress(frame, highlightBeat);
  const fromState = getNodeState(fromLayer, scene, frame);
  const toState = getNodeState(toLayer, scene, frame);
  const strokeWidth = interpolate(highlightProgress, [0, 1], [3.5, 6]);
  const stroke = highlightProgress > 0 || toState === 'current' || toState === 'resolved' ? tokens.accent : tokens.accentAlt;
  const labelWidth = connection.label
    ? [...connection.label].reduce((width, character) => width + (character.charCodeAt(0) > 255 ? 18 : 10), 24)
    : 0;
  const labelX = geometry.direction === 'down' || geometry.direction === 'up'
    ? geometry.label.x + labelWidth / 2 + 20
    : geometry.label.x;

  return (
    <svg style={{position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none', opacity: fromState === 'upcoming' || toState === 'upcoming' ? 0.78 : 1}}>
      <path
        d={geometry.path} pathLength={1} fill="none"
        stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round"
        strokeDasharray={1} strokeDashoffset={1 - drawProgress}
      />
      {drawProgress >= 0.98 ? <polygon points={geometry.arrow} fill={stroke} /> : null}
      {connection.label && drawProgress >= 0.95 ? (
        <g>
          <rect
            x={labelX - labelWidth / 2} y={geometry.label.y - 15}
            width={labelWidth} height={30} rx={tokens.labelRadius}
            fill={tokens.paper} stroke={stroke} strokeWidth={1.5}
          />
          <text x={labelX} y={geometry.label.y + 6} textAnchor="middle" fill={tokens.ink} fontFamily={tokens.bodyFont} fontSize={18} fontWeight={700}>
            {connection.label}
          </text>
        </g>
      ) : null}
    </svg>
  );
}
