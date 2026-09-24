import React from 'react';
import {Img, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {StoryboardBeat, StoryboardLayer, StoryboardScene} from '../schemas/storyboard';
import {getBeatProgress} from '../motion/beat-progress';
import type {StyleTokens} from '../styles/style-loader';
import {getNodeState} from './node-state';

interface RenderLayerProps {
  layer: StoryboardLayer;
  scene: StoryboardScene;
  tokens: StyleTokens;
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));

function layerBeats(scene: StoryboardScene, layer: StoryboardLayer): StoryboardBeat[] {
  return scene.beats.filter((beat) => beat.target === layer.id);
}

function appearanceBeat(beats: StoryboardBeat[]): StoryboardBeat | undefined {
  return beats.find((beat) => ['enter', 'reveal', 'count'].includes(beat.action));
}

function emphasisBeat(beats: StoryboardBeat[]): StoryboardBeat | undefined {
  return beats.find((beat) => ['focus', 'highlight', 'camera-push'].includes(beat.action));
}

function layerOpacity(frame: number, beat: StoryboardBeat | undefined): number {
  if (!beat) {
    return 1;
  }
  return getBeatProgress(frame, beat);
}

function layerTransform(frame: number, appearance: StoryboardBeat | undefined, emphasis: StoryboardBeat | undefined, fps: number, tokens: StyleTokens): string {
  const eased = appearance ? spring({
    frame: Math.max(0, frame - appearance.start),
    fps,
    config: {
      damping: tokens.motion.damping,
      stiffness: tokens.motion.stiffness,
      mass: tokens.motion.mass
    }
  }) : 1;
  const offset = interpolate(clamp(eased), [0, 1], [tokens.motion.enterOffset, 0]);
  const emphasisProgress = getBeatProgress(frame, emphasis);
  const scale = 1 + tokens.motion.emphasisScale * emphasisProgress;
  return `translate3d(0, ${offset}px, 0) scale(${scale})`;
}

function layerRotation(layer: StoryboardLayer, tokens: StyleTokens): number {
  if (typeof layer.rotate === 'number') {
    return layer.rotate;
  }
  if (tokens.id === 'scatterbrain' && (layer.type === 'card' || layer.type === 'annotation')) {
    return layer.id.length % 2 === 0 ? -1.2 : 1.2;
  }
  return 0;
}

function layerStyle(layer: StoryboardLayer, tokens: StyleTokens): React.CSSProperties {
  const color = layer.color ?? tokens.ink;
  return {
    position: 'absolute',
    left: layer.x ?? 0,
    top: layer.y ?? 0,
    width: layer.width,
    height: layer.height,
    color,
    boxSizing: 'border-box'
  };
}

export function RenderLayer({layer, scene, tokens}: RenderLayerProps) {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const beats = layerBeats(scene, layer);
  const appearance = appearanceBeat(beats);
  const emphasis = emphasisBeat(beats);
  const nodeState = getNodeState(layer, scene, frame);
  const rotateBeat = beats.find((beat) => beat.action === 'rotate');
  const insideVisibilityWindow = (layer.visibleFrom === undefined || frame >= layer.visibleFrom)
    && (layer.visibleUntil === undefined || frame < layer.visibleUntil);
  const opacity = insideVisibilityWindow ? layerOpacity(frame, appearance) : 0;
  const rotation = layerRotation(layer, tokens) + (layer.rotationDegrees ?? 0) * getBeatProgress(frame, rotateBeat);
  const transform = `${layerTransform(frame, appearance, emphasis, fps, tokens)} rotate(${rotation}deg)`;
  const baseStyle = layerStyle(layer, tokens);
  const sharedStyle: React.CSSProperties = {
    ...baseStyle,
    opacity,
    transform,
    willChange: 'opacity, transform'
  };

  if (layer.type === 'label') {
    return (
      <div style={{
        ...sharedStyle,
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 42,
        padding: '0 18px',
        background: tokens.id === 'scatterbrain' ? tokens.paper : tokens.accent,
        color: tokens.id === 'scatterbrain' ? tokens.ink : tokens.paper,
        border: tokens.surfaceBorder,
        borderRadius: tokens.labelRadius,
        boxShadow: tokens.id === 'retro-windows' ? `4px 4px 0 ${tokens.ink}` : 'none',
        fontFamily: tokens.bodyFont,
        fontSize: 19,
        fontWeight: 700,
        letterSpacing: 2,
        textTransform: 'uppercase'
      }}>
        {layer.text ?? layer.label}
      </div>
    );
  }

  if (layer.type === 'annotation') {
    return (
      <div style={{
        ...sharedStyle,
        fontFamily: tokens.bodyFont,
        fontSize: 25,
        lineHeight: 1.35,
        borderLeft: tokens.id === 'retro-windows' ? 'none' : `4px solid ${tokens.accentAlt}`,
        borderBottom: tokens.id === 'retro-windows' ? `4px solid ${tokens.accent}` : undefined,
        paddingLeft: 18
      }}>
        {layer.text}
      </div>
    );
  }

  if (layer.type === 'metric') {
    const targetBeat = beats.find((item) => item.action === 'count');
    const progress = getBeatProgress(frame, targetBeat);
    const numericValue = typeof layer.value === 'number' ? layer.value : Number(layer.value ?? 0);
    const displayValue = Number.isFinite(numericValue) ? Math.round(numericValue * progress) : layer.value;
    return (
      <div style={{
        ...sharedStyle,
        padding: 28,
        background: tokens.paper,
        border: tokens.surfaceBorder,
        borderRadius: tokens.surfaceRadius,
        boxShadow: tokens.surfaceShadow,
        fontFamily: tokens.bodyFont
      }}>
        <div style={{fontSize: 18, color: tokens.muted, textTransform: 'uppercase', letterSpacing: 2}}>
          {layer.label}
        </div>
        <div style={{fontFamily: tokens.displayFont, fontSize: 86, lineHeight: 1, marginTop: 12}}>
          {displayValue}{typeof layer.value === 'number' ? '%' : ''}
        </div>
      </div>
    );
  }

  if (layer.type === 'screenshot') {
    return (
      <div style={{
        ...sharedStyle, background: tokens.paper, border: tokens.surfaceBorder,
        borderRadius: tokens.surfaceRadius, boxShadow: tokens.surfaceShadow,
        overflow: 'hidden', fontFamily: tokens.bodyFont
      }}>
        {layer.assetDataUri ? (
          <Img src={layer.assetDataUri} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
        ) : (
          <div style={{padding: 32, fontSize: 24, color: tokens.muted}}>Missing screenshot asset</div>
        )}
        {layer.label ? (
          <div style={{position: 'absolute', left: 16, top: 14, padding: '6px 10px', background: tokens.accent, color: tokens.paper, fontSize: 14, letterSpacing: 1}}>
            {layer.label}
          </div>
        ) : null}
      </div>
    );
  }

  if (layer.type === 'object') {
    return (
      <div style={{...sharedStyle, background: tokens.paper, border: tokens.surfaceBorder, boxShadow: tokens.surfaceShadow, overflow: 'hidden'}}>
        {layer.assetDataUri ? <Img src={layer.assetDataUri} style={{width: '100%', height: '100%', objectFit: layer.fit ?? 'contain'}} /> : null}
        <div style={{position: 'absolute', left: 12, bottom: 12, padding: '7px 11px', background: tokens.ink, color: tokens.paper, fontSize: 18}}>
          {layer.label ?? '示意对象'}
        </div>
      </div>
    );
  }

  if (layer.type === 'callout') {
    const target = scene.layers.find((item) => item.id === layer.target);
    return (
      <div style={{...sharedStyle, border: `4px solid ${tokens.accent}`, background: tokens.paper, boxShadow: tokens.surfaceShadow, overflow: 'hidden'}}>
        {target?.assetDataUri ? <Img src={target.assetDataUri} style={{width: '100%', height: '72%', objectFit: 'cover', objectPosition: 'center', transform: 'scale(1.7)'}} /> : null}
        <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, background: tokens.ink, color: tokens.paper, fontSize: 22}}>
          {layer.text ?? layer.label}
        </div>
      </div>
    );
  }

  if (layer.type === 'card' || layer.type === 'node') {
    const stateOpacity = nodeState === 'upcoming' ? 0.45 : nodeState === 'completed' ? 0.72 : 1;
    const stateBackground = nodeState === 'current' || nodeState === 'resolved' ? tokens.accent : tokens.paper;
    const stateColor = nodeState === 'current' || nodeState === 'resolved' ? tokens.paper : baseStyle.color;
    return (
      <div style={{
        ...sharedStyle,
        opacity: opacity * stateOpacity,
        padding: 32,
        background: stateBackground,
        color: stateColor,
        border: nodeState === 'current' || nodeState === 'resolved' ? `5px solid ${tokens.ink}` : tokens.surfaceBorder,
        borderRadius: tokens.surfaceRadius,
        boxShadow: tokens.surfaceShadow,
        fontFamily: tokens.bodyFont
      }}>
        <div style={{fontSize: 18, color: nodeState === 'current' || nodeState === 'resolved' ? tokens.paper : tokens.muted, opacity: nodeState === 'current' || nodeState === 'resolved' ? 0.86 : 1, letterSpacing: 1.5, textTransform: 'uppercase'}}>
          {layer.label}
        </div>
        <div style={{
          marginTop: 16,
          fontFamily: tokens.displayFont,
          fontSize: layer.type === 'node' ? (nodeState === 'current' || nodeState === 'resolved' ? 44 : 34) : 40,
          lineHeight: 1.12
        }}>
          {layer.text}
        </div>
      </div>
    );
  }

  return null;
}
