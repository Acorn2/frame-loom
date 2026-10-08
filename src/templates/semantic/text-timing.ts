import type {StoryboardScene} from '../../schemas/storyboard';

// Renderer and QA use the same implicit text windows for the basic recipe.
export function semanticTextTiming(scene: StoryboardScene, fps: number, overlapOutFrames = 0) {
  const duration = Math.max(1, Math.round(fps * .6));
  const lastAction = Math.max(duration, ...scene.beats.map(beat => beat.start + beat.duration));
  const outgoing = overlapOutFrames || (scene.outro?.fadeFrames ?? (scene.transitionOut ? 12 : 0));
  const latestClaim = Math.max(0, scene.durationFrames - outgoing - duration - Math.ceil(fps * .8));
  return {duration, claimStart: Math.min(lastAction, latestClaim)};
}
