import React, {useMemo} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {splitCaptionCues, type CaptionCue} from './captions';
import {captionTextStyle} from './caption-style';
import type {StyleTokens} from '../styles/style-loader';

export interface CaptionOverlayLayout {
  left: number;
  right: number;
  bottom: number;
  maxWidth: number;
  fontSize: number;
  paddingX: number;
  paddingY: number;
}

export function getCaptionOverlayLayout({
  width,
  height,
  safeArea
}: {
  width: number;
  height: number;
  safeArea: StyleTokens['safeArea'];
}): CaptionOverlayLayout {
  const portrait = width < height;
  const contentWidth = Math.max(0, width - safeArea.left - safeArea.right);
  return {
    left: safeArea.left,
    right: safeArea.right,
    bottom: safeArea.bottom + (portrait ? 20 : 16),
    maxWidth: Math.min(contentWidth, portrait ? 860 : 1180),
    fontSize: portrait ? 34 : 30,
    paddingX: portrait ? 24 : 20,
    paddingY: portrait ? 18 : 14
  };
}

export function CaptionOverlay({captions, tokens}: {captions: CaptionCue[]; tokens: StyleTokens}) {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const seconds = frame / fps;
  const shortCues = useMemo(() => splitCaptionCues(captions), [captions]);
  const cue = shortCues.find((item) => seconds >= item.startSec && seconds < item.endSec);
  if (!cue) return null;
  const layout = getCaptionOverlayLayout({width, height, safeArea: tokens.safeArea});
  return (
    <div style={{
      position: 'absolute', left: layout.left, right: layout.right, bottom: layout.bottom,
      display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 100
    }}>
      <div style={{
        ...captionTextStyle(tokens),
        width: '100%', maxWidth: layout.maxWidth, boxSizing: 'border-box',
        padding: `${layout.paddingY}px ${layout.paddingX}px`,
        fontSize: layout.fontSize, lineHeight: 1.35
      }}>
        {cue.text}
      </div>
    </div>
  );
}
