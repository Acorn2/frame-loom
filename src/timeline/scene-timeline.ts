import type {Storyboard, StoryboardScene} from '../schemas/storyboard';

export interface SceneTiming {
  scene: StoryboardScene;
  startFrame: number;
  endFrame: number;
  overlapInFrames: number;
  overlapOutFrames: number;
}

export function getSceneTimeline(storyboard: Storyboard): SceneTiming[] {
  let startFrame = 0;
  return storyboard.scenes.map((scene, index) => {
    const overlapInFrames = index === 0 ? 0 : scene.transitionIn?.durationFrames ?? 0;
    startFrame -= overlapInFrames;
    const timing = {
      scene,
      startFrame,
      endFrame: startFrame + scene.durationFrames,
      overlapInFrames,
      overlapOutFrames: storyboard.scenes[index + 1]?.transitionIn?.durationFrames ?? 0
    };
    startFrame = timing.endFrame;
    return timing;
  });
}

export function getTimelineDuration(storyboard: Storyboard): number {
  return getSceneTimeline(storyboard).at(-1)?.endFrame ?? 0;
}
