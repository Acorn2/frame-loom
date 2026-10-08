import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {ShotShell, type ShotRenderProps} from '../ShotShell';
import type {ShotPlan} from '../../compile-shot';
import {actionProgress} from '../frame-state';
import {MarkerUnderline} from '../MarkerUnderline';

export function TitleEntrance(props: ShotRenderProps & {plan: ShotPlan}) {
  const {scene, tokens, plan} = props;
  const frame = useCurrentFrame();
  const scale = useVideoConfig().width / 1920;
  const shot = scene.shot;
  if (shot?.id !== 'blur-slide' && shot?.id !== 'split-text-stagger') throw new Error('title entrance contract required');
  const subtitle = shot.id === 'blur-slide' ? scene.layers.find((layer) => layer.id === shot.slots.subtitle) : undefined;
  const subtitleProgress = subtitle ? actionProgress(plan, subtitle.id, ['enter', 'reveal'], frame) : 0;
  return <ShotShell {...props} ownTitle><div style={{height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 48 * scale}}>
    <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 * scale, maxWidth: '92%'}}>
      {shot.slots.phrases.map((id) => {
        const layer = scene.layers.find((item) => item.id === id)!;
        const p = actionProgress(plan, id, ['enter', 'reveal'], frame);
        const rise = actionProgress(plan, id, ['enter', 'reveal'], frame, 'back');
        return <div key={id} style={{overflow: shot.id === 'split-text-stagger' ? 'hidden' : 'visible', fontSize: 96 * scale, padding: '0.2em 0.04em'}}><span style={{display: 'inline-block', position: 'relative', fontFamily: tokens.displayFont, fontSize: 96 * scale, lineHeight: 1.2, fontWeight: 800, opacity: p, transform: shot.id === 'blur-slide' ? `translateY(${(1 - p) * 40 * scale}px)` : `translateY(${(1 - rise) * 115}%)`, filter: shot.id === 'blur-slide' ? `blur(${(1 - p) * 10 * scale}px)` : undefined}}>
          {layer.label}{shot.slots.emphasis === id ? <MarkerUnderline progress={actionProgress(plan, id, ['highlight'], frame)} color={tokens.accent} /> : null}
        </span></div>;
      })}
    </div>
    {subtitle ? <div style={{fontSize: 40 * scale, color: tokens.muted, maxWidth: '84%', textAlign: 'center', opacity: subtitleProgress, transform: `translateY(${(1 - subtitleProgress) * 26 * scale}px)`, filter: `blur(${(1 - subtitleProgress) * 7 * scale}px)`}}>{subtitle.label}</div> : null}
  </div></ShotShell>;
}
