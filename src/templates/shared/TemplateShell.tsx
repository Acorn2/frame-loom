import React, {type ReactNode} from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {StoryboardScene} from '../../schemas/storyboard';
import type {StyleTokens} from '../../styles/style-loader';
import {captionTextStyle} from '../../audio/caption-style';
import {splitCaptionWindow} from '../../audio/captions';

interface TemplateShellProps {
  scene: StoryboardScene;
  tokens: StyleTokens;
  children: ReactNode;
  showSceneCaptions: boolean;
  overlapOutFrames: number;
  sectionLabel?: string;
}

export function TemplateShell({
  scene,
  tokens,
  children,
  showSceneCaptions,
  overlapOutFrames,
  sectionLabel = 'FRAMELOOM'
}: TemplateShellProps) {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const portrait = width < height;
  const exitFrames = overlapOutFrames > 0 ? overlapOutFrames : (scene.outro?.fadeFrames ?? 24);
  const outroStart = scene.durationFrames - exitFrames;
  const outroProgress = exitFrames > 0 ? interpolate(frame, [outroStart, scene.durationFrames], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp'
  }) : 0;
  const entering = scene.transitionIn;
  const enterProgress = entering ? interpolate(frame, [0, entering.durationFrames], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp'
  }) : 1;
  const titleEnterOpacity = entering
    ? entering.type === 'overlap-slide'
      ? Math.max(0, Math.min(1, (enterProgress - 0.85) / 0.15))
      : Math.max(0, Math.min(1, (enterProgress - 0.6) / 0.4))
    : 1;
  const titleExitOpacity = overlapOutFrames > 0 ? Math.max(0, 1 - outroProgress * 2) : 1;
  const transitionStyle: React.CSSProperties = overlapOutFrames > 0
    ? {opacity: 1 - outroProgress, transform: scene.transitionOut === 'slide' ? `translateX(${-5 * outroProgress}%)` : undefined}
    : scene.transitionOut === 'slide'
      ? {transform: `translateX(${-8 * outroProgress}%)`, opacity: 1 - outroProgress * 0.18}
      : scene.transitionOut === 'paper-wipe'
        ? {clipPath: `inset(0 ${outroProgress * 100}% 0 0)`}
        : scene.transitionOut === 'carry'
          ? {transform: `translateY(${-20 * outroProgress}px)`, opacity: 1 - outroProgress * 0.35}
          : {opacity: 1 - outroProgress};
  const activeCaption = showSceneCaptions
    ? scene.captions.flatMap((caption) => splitCaptionWindow(caption.text, caption.start, caption.end)).find((caption) => frame >= caption.start && frame < caption.end)
    : undefined;

  return (
    <AbsoluteFill style={{
      backgroundColor: tokens.background, color: tokens.ink, fontFamily: tokens.bodyFont,
      ...transitionStyle,
      opacity: (typeof transitionStyle.opacity === 'number' ? transitionStyle.opacity : 1) * (entering?.type === 'overlap-slide' ? 1 : enterProgress),
      clipPath: entering?.type === 'overlap-slide' ? `inset(0 ${(1 - enterProgress) * 100}% 0 0)` : transitionStyle.clipPath,
      transform: entering?.type === 'overlap-carry'
          ? `translateY(${(1 - enterProgress) * 24}px)`
          : transitionStyle.transform,
      overflow: 'hidden'
    }}>
      {tokens.pattern !== 'solid' ? <div style={{
        position: 'absolute', inset: 0, opacity: tokens.pattern === 'desktop' ? 0.24 : 0.6,
        backgroundImage: tokens.pattern === 'dots'
          ? `radial-gradient(${tokens.grid} 2px, transparent 2px)`
          : `linear-gradient(${tokens.grid} 1px, transparent 1px), linear-gradient(90deg, ${tokens.grid} 1px, transparent 1px)`,
        backgroundSize: tokens.pattern === 'dots' ? '34px 34px' : tokens.pattern === 'desktop' ? '48px 48px' : '64px 64px'
      }} /> : null}
      {tokens.pattern === 'desktop' ? (
        <div style={{position: 'absolute', left: 22, top: 22, right: 22, height: 48, background: tokens.accent, border: tokens.surfaceBorder, boxShadow: tokens.surfaceShadow}} />
      ) : (
        <>
          <div style={{position: 'absolute', left: 0, top: 0, width: tokens.pattern === 'dots' ? 20 : 34, height: '100%', background: tokens.accentAlt}} />
          <div style={{position: 'absolute', right: portrait ? 58 : 110, top: portrait ? 112 : 88, width: portrait ? 92 : 140, height: portrait ? 92 : 140, borderRadius: tokens.pattern === 'dots' ? '34% 66% 45% 55%' : '50%', background: tokens.accent, opacity: 0.86, transform: tokens.pattern === 'dots' ? 'rotate(11deg)' : undefined}} />
        </>
      )}
      <div style={{position: 'absolute', left: tokens.safeArea.left, top: tokens.safeArea.top, right: tokens.safeArea.right, bottom: tokens.safeArea.bottom + (scene.captions.length > 0 ? (portrait ? 160 : 120) : 0)}}>
        <div style={{
          position: 'absolute', top: 0, right: portrait ? 112 : 180,
          maxWidth: portrait ? '65%' : '42%',
          textAlign: 'right', overflowWrap: 'anywhere',
          fontSize: portrait ? 16 : 18, lineHeight: 1.25,
          letterSpacing: 2, color: tokens.muted, textTransform: 'uppercase',
          opacity: titleEnterOpacity * titleExitOpacity
        }}>
          {sectionLabel}
        </div>
        <h1 style={{
          position: 'absolute', left: 0, top: 128,
          maxWidth: portrait ? Math.max(520, width - tokens.safeArea.left - tokens.safeArea.right) : 1120,
          margin: 0, fontFamily: tokens.displayFont,
          fontSize: portrait ? Math.min(tokens.titleFontSize, 88) : tokens.titleFontSize,
          lineHeight: 0.98, opacity: titleEnterOpacity * titleExitOpacity
        }}>
          {scene.title}
        </h1>
        {children}
      </div>
      {activeCaption ? (
        <div style={{
          position: 'absolute', left: tokens.safeArea.left, right: tokens.safeArea.right,
          bottom: tokens.safeArea.bottom + 16, display: 'flex', justifyContent: 'center'
        }}>
          <div style={{
            ...captionTextStyle(tokens),
            maxWidth: portrait ? 850 : 1160, padding: portrait ? '18px 24px' : '14px 22px',
            fontSize: portrait ? 32 : 28, lineHeight: 1.3
          }}>{activeCaption.text}</div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
}
