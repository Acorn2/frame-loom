import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {ShotShell, type ShotRenderProps} from '../ShotShell';
import type {ShotPlan} from '../compile-shot';
import {beatProgress, curves} from '../motion';
import {actionProgress} from '../frame-state';
import {MarkerUnderline} from '../MarkerUnderline';

export function PaperTitle(props: ShotRenderProps & {plan: ShotPlan}) {
  const {scene, tokens, plan} = props;
  const frame = useCurrentFrame();
  const scale = useVideoConfig().width / 1920;
  if (scene.shot?.id !== 'paper-title') throw new Error('paper-title contract required');
  const {phrases, emphasis} = scene.shot.slots;
  return <ShotShell {...props} ownTitle><div style={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: '5%', boxSizing: 'border-box'}}><div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-start', gap: 18 * scale, maxWidth: '90%'}}>
    {phrases.map((id) => {
      const layer = scene.layers.find((item) => item.id === id)!;
      const p = beatProgress(plan, id, ['enter', 'reveal'], frame, curves.press);
      const line = actionProgress(plan, id, ['highlight'], frame);
      return <span key={id} style={{display: 'inline-block', position: 'relative', fontFamily: tokens.displayFont, fontSize: 144 * scale, lineHeight: 1.2, fontWeight: 600, opacity: p, transform: `scale(${1.28 - 0.28 * p})`, filter: `blur(${(1 - p) * 7 * scale}px)`, color: id === emphasis ? tokens.accentAlt : tokens.ink, fontStyle: id === emphasis ? 'italic' : undefined}}>{layer.label}{id === emphasis ? <MarkerUnderline progress={line} color={tokens.accent} /> : null}</span>;
    })}
  </div></div></ShotShell>;
}
