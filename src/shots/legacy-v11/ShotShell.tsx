import React, {type ReactNode} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import type {StoryboardScene} from '../../schemas/storyboard';
import type {StyleTokens} from '../../styles/style-loader';
import {captionTextStyle} from '../../audio/caption-style';
import {splitCaptionWindow} from '../../audio/captions';
import {transitionStyle} from '../../templates/semantic/SemanticScene';

export interface ShotRenderProps {
  scene: StoryboardScene;
  tokens: StyleTokens;
  showSceneCaptions: boolean;
  externalCaptions?: boolean;
  overlapOutFrames: number;
  chapterTransitionOut?: boolean;
}
export function ShotShell({scene, tokens, showSceneCaptions, externalCaptions, overlapOutFrames, chapterTransitionOut, children, ownTitle = false}: ShotRenderProps & {children: ReactNode; ownTitle?: boolean}) {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const scale = width / 1920;
  const caption = showSceneCaptions ? scene.captions.flatMap((cue) => splitCaptionWindow(cue.text, cue.start, cue.end)).find((cue) => frame >= cue.start && frame < cue.end) : undefined;
  const reserve = (showSceneCaptions && scene.captions.length > 0) || externalCaptions ? 125 * scale : 0;
  const contentHeight = height - tokens.safeArea.top - tokens.safeArea.bottom - reserve;
  return <AbsoluteFill style={{background: tokens.background, color: tokens.ink, fontFamily: tokens.bodyFont, overflow: 'hidden', ...transitionStyle(scene, frame, overlapOutFrames, chapterTransitionOut)}}>
    <div style={{position: 'absolute', left: tokens.safeArea.left, right: tokens.safeArea.right, top: tokens.safeArea.top, height: contentHeight}}>
      {!ownTitle ? <h1 style={{margin: 0, position: 'absolute', top: '2%', fontFamily: tokens.displayFont, fontSize: 54 * scale, lineHeight: 1.1, maxWidth: '96%'}}>{scene.title}</h1> : null}
      <div style={{position: 'absolute', left: 0, right: 0, top: ownTitle ? 0 : '18%', height: ownTitle ? '100%' : '82%'}}>{children}</div>
    </div>
    {caption ? <div style={{...captionTextStyle(tokens), position: 'absolute', left: tokens.safeArea.left, right: tokens.safeArea.right, bottom: tokens.safeArea.bottom + 10 * scale, fontSize: 28 * scale, lineHeight: 1.3}}>{caption.text}</div> : null}
  </AbsoluteFill>;
}
