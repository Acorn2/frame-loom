import React, {type ReactNode} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import type {StoryboardScene} from '../schemas/storyboard';
import type {StyleTokens} from '../styles/style-loader';
import {captionTextStyle} from '../audio/caption-style';
import {splitCaptionWindow} from '../audio/captions';
import {transitionStyle} from '../templates/semantic/SemanticScene';
import type {RecipeAppearance} from './appearance';
import {shotContentLayout} from './layout';

export interface ShotRenderProps {
  scene: StoryboardScene;
  tokens: StyleTokens;
  showSceneCaptions: boolean;
  externalCaptions?: boolean;
  overlapOutFrames: number;
  chapterTransitionOut?: boolean;
  appearance?: RecipeAppearance;
}
export function ShotShell({scene, tokens, appearance, showSceneCaptions, externalCaptions, overlapOutFrames, chapterTransitionOut, children, ownTitle = false}: ShotRenderProps & {children: ReactNode; ownTitle?: boolean}) {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const scale = width / 1920;
  const caption = showSceneCaptions ? scene.captions.flatMap((cue) => splitCaptionWindow(cue.text, cue.start, cue.end)).find((cue) => frame >= cue.start && frame < cue.end) : undefined;
  const reserve = (showSceneCaptions && scene.captions.length > 0) || externalCaptions ? 125 * scale : 0;
  const contentHeight = height - tokens.safeArea.top - tokens.safeArea.bottom - reserve;
  const layout = shotContentLayout(scene.shot);
  return <AbsoluteFill style={{background: appearance?.background ?? tokens.background, color: appearance?.stageInk ?? tokens.ink, fontFamily: tokens.bodyFont, overflow: 'hidden', ...transitionStyle(scene, frame, overlapOutFrames, chapterTransitionOut)}}>
    {appearance?.decoration === 'paper' ? <div aria-hidden style={{position: 'absolute', inset: 36 * scale, borderTop: `2px solid ${tokens.ink}45`, pointerEvents: 'none'}} /> : null}
    {appearance?.decoration === 'grid' ? <div aria-hidden style={{position: 'absolute', inset: 0, backgroundImage: `linear-gradient(${appearance.lineInk}12 1px, transparent 1px), linear-gradient(90deg, ${appearance.lineInk}12 1px, transparent 1px)`, backgroundSize: `${64 * scale}px ${64 * scale}px`, maskImage: 'radial-gradient(ellipse, black, transparent 90%)', pointerEvents: 'none'}} /> : null}
    {appearance?.decoration === 'floor' ? <div aria-hidden style={{position: 'absolute', left: '12%', right: '12%', bottom: '16%', height: '10%', background: appearance.dark ? `${appearance.lineInk}20` : `${tokens.ink}14`, borderRadius: '50%', filter: `blur(${32 * scale}px)`, pointerEvents: 'none'}} /> : null}
    {appearance?.decoration === 'split' ? <div aria-hidden style={{position: 'absolute', left: '50%', top: '12%', bottom: '18%', width: scale, background: `${tokens.ink}15`}} /> : null}
    <div style={{position: 'absolute', left: tokens.safeArea.left, right: tokens.safeArea.right, top: tokens.safeArea.top, height: contentHeight}}>
      {!ownTitle ? <h1 style={{margin: 0, position: 'absolute', top: '2%', fontFamily: tokens.displayFont, fontSize: layout.titleFont * scale, lineHeight: 1.1, maxWidth: '96%'}}>{scene.title}</h1> : null}
      <div style={{position: 'absolute', left: 0, right: 0, top: ownTitle ? 0 : `${layout.bodyTop * 100}%`, height: ownTitle ? '100%' : `${layout.bodyHeight * 100}%`}}>{children}</div>
    </div>
    {caption ? <div style={{...captionTextStyle(tokens), position: 'absolute', left: tokens.safeArea.left, right: tokens.safeArea.right, bottom: tokens.safeArea.bottom + 10 * scale, fontSize: 28 * scale, lineHeight: 1.3}}>{caption.text}</div> : null}
  </AbsoluteFill>;
}
