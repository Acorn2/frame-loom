import {spring} from 'remotion';
import type {StyleTokens} from '../styles/style-loader';

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function entranceProgress({
  frame, start, duration, tokens, easing = tokens.motionRules.enter.easing
}: {
  frame: number;
  start: number;
  duration: number;
  tokens: StyleTokens;
  easing?: string;
}): number {
  if (frame <= start) return 0;
  if (frame >= start + duration) return 1;
  const progress = clamp((frame - start) / duration);
  if (easing === 'spring') {
    // Normalize the spring to the beat window, regardless of output frame rate.
    return spring({
      frame: progress * 30,
      fps: 30,
      durationInFrames: 30,
      config: {
        damping: tokens.motion.damping,
        stiffness: tokens.motion.stiffness,
        mass: tokens.motion.mass
      }
    });
  }
  if (easing === 'step-out') return 1;
  if (easing === 'linear') return progress;
  if (easing === 'ease-in-out') return progress * progress * (3 - 2 * progress);
  return 1 - (1 - progress) ** 3;
}
