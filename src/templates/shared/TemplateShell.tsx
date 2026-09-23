import React, {type ReactNode} from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {StoryboardScene} from '../../schemas/storyboard';
import type {StyleTokens} from '../../styles/style-loader';

interface TemplateShellProps {
  scene: StoryboardScene;
  tokens: StyleTokens;
  children: ReactNode;
  showSceneCaptions: boolean;
  sectionLabel?: string;
}

export function TemplateShell({
  scene,
  tokens,
  children,
  showSceneCaptions,
  sectionLabel = 'FRAMELOOM'
}: TemplateShellProps) {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const portrait = width < height;
  const outroStart = Math.max(0, scene.durationFrames - 24);
  const outroProgress = interpolate(frame, [outroStart, scene.durationFrames], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp'
  });
  const transitionStyle: React.CSSProperties = scene.transitionOut === 'slide'
    ? {transform: `translateX(${-8 * outroProgress}%)`, opacity: 1 - outroProgress * 0.18}
    : scene.transitionOut === 'paper-wipe'
      ? {clipPath: `inset(0 ${outroProgress * 100}% 0 0)`}
      : scene.transitionOut === 'carry'
        ? {transform: `translateY(${-20 * outroProgress}px)`, opacity: 1 - outroProgress * 0.35}
        : {opacity: 1 - outroProgress};
  const activeCaption = showSceneCaptions
    ? scene.captions.find((caption) => frame >= caption.start && frame < caption.end)
    : undefined;

  return (
    <AbsoluteFill style={{
      backgroundColor: tokens.background, color: tokens.ink, fontFamily: tokens.bodyFont,
      ...transitionStyle, overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute', inset: 0, opacity: tokens.pattern === 'desktop' ? 0.24 : 0.6,
        backgroundImage: tokens.pattern === 'dots'
          ? `radial-gradient(${tokens.grid} 2px, transparent 2px)`
          : `linear-gradient(${tokens.grid} 1px, transparent 1px), linear-gradient(90deg, ${tokens.grid} 1px, transparent 1px)`,
        backgroundSize: tokens.pattern === 'dots' ? '34px 34px' : tokens.pattern === 'desktop' ? '48px 48px' : '64px 64px'
      }} />
      {tokens.pattern === 'desktop' ? (
        <div style={{position: 'absolute', left: 22, top: 22, right: 22, height: 48, background: tokens.accent, border: tokens.surfaceBorder, boxShadow: tokens.surfaceShadow}} />
      ) : (
        <>
          <div style={{position: 'absolute', left: 0, top: 0, width: tokens.pattern === 'dots' ? 20 : 34, height: '100%', background: tokens.accentAlt}} />
          <div style={{position: 'absolute', right: portrait ? 58 : 110, top: portrait ? 112 : 88, width: portrait ? 92 : 140, height: portrait ? 92 : 140, borderRadius: tokens.pattern === 'dots' ? '34% 66% 45% 55%' : '50%', background: tokens.accent, opacity: 0.86, transform: tokens.pattern === 'dots' ? 'rotate(11deg)' : undefined}} />
        </>
      )}
      <div style={{position: 'absolute', left: tokens.safeArea.left, top: tokens.safeArea.top, right: tokens.safeArea.right, bottom: tokens.safeArea.bottom}}>
        <div style={{position: 'absolute', top: 0, right: 0, fontSize: portrait ? 16 : 18, letterSpacing: 2, color: tokens.muted, textTransform: 'uppercase'}}>
          {sectionLabel}
        </div>
        <h1 style={{
          position: 'absolute', left: 0, top: 128,
          maxWidth: portrait ? Math.max(520, width - tokens.safeArea.left - tokens.safeArea.right) : 1120,
          margin: 0, fontFamily: tokens.displayFont,
          fontSize: portrait ? Math.min(tokens.titleFontSize, 88) : tokens.titleFontSize,
          lineHeight: 0.98
        }}>
          {scene.title}
        </h1>
        {children}
        {activeCaption ? (
          <div style={{
            position: 'absolute', left: 0, bottom: 0, maxWidth: portrait ? '100%' : 980,
            fontSize: portrait ? 22 : 24, lineHeight: 1.35, color: tokens.muted,
            whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word'
          }}>
            {activeCaption.text}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
}
