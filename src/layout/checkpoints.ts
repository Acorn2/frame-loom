import type {Storyboard} from '../schemas/storyboard';
import {compileStoryboardShots} from '../shots/compile-shot';
import {getSceneTimeline} from '../timeline/scene-timeline';

export function layoutCheckpoints(board: Storyboard): number[] {
  if (!board.layoutPolicy) return [];
  const timeline = getSceneTimeline(board);
  const plans = compileStoryboardShots(board);
  const frames = timeline.flatMap((item, i) => [
    ...plans[i]!.checkpoints.map(point => item.startFrame + point.frame),
    item.startFrame, item.endFrame - 1,
    ...(item.overlapInFrames ? [item.startFrame + Math.floor(item.overlapInFrames / 2), item.startFrame + item.overlapInFrames] : [])
  ]);
  return [...new Set(frames.filter(frame => frame >= 0 && frame < board.project.durationFrames).map(Math.round))].sort((a, b) => a - b);
}
