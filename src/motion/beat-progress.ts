import {interpolate} from 'remotion';
import type {StoryboardBeat} from '../schemas/storyboard';

export function getBeatProgress(frame: number, beat: StoryboardBeat | undefined): number {
  if (!beat) {
    return 0;
  }
  return interpolate(frame, [beat.start, beat.start + beat.duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });
}

export function getTargetBeat(sceneBeats: StoryboardBeat[], target: string): StoryboardBeat | undefined {
  return sceneBeats.find((beat) => beat.target === target);
}
