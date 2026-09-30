import {getTimelineDuration} from '../timeline/scene-timeline';
import type {Storyboard} from '../schemas/storyboard';

// Explicit proposal only. Never mutate the source or preserve an old approval.
export function proposeAudioTiming(source: Storyboard, measured: Array<{sceneId: string; durationSec: number}>): Storyboard {
  const result = structuredClone(source);
  const fps = result.project.fps;
  for (const [index, scene] of result.scenes.entries()) {
    if (!scene.narration.trim()) continue;
    const duration = measured.find((segment) => segment.sceneId === scene.id)?.durationSec;
    if (!duration || !Number.isFinite(duration) || duration <= 0) throw new Error(`${scene.id}: 缺少实测语音时长。`);
    const oldDuration = scene.durationFrames;
    scene.durationFrames = Math.ceil(duration * fps) + Math.ceil(0.15 * fps);
    const ratio = Math.ceil(duration * fps) / oldDuration;
    if (scene.visual?.mediaFocus) {
      scene.visual.mediaFocus.start = Math.floor(scene.visual.mediaFocus.start * ratio);
      scene.visual.mediaFocus.duration = Math.max(1, Math.floor(scene.visual.mediaFocus.duration * ratio));
    }
    scene.beats = scene.beats.map((beat) => ({...beat, start: Math.floor(beat.start * ratio), duration: Math.max(1, Math.floor(beat.duration * ratio))}));
    scene.captions = scene.captions.map((cue) => ({...cue, start: Math.floor(cue.start * ratio), end: Math.max(Math.floor(cue.start * ratio) + 1, Math.floor(cue.end * ratio))}));
    for (const layer of scene.layers) {
      if (layer.visibleFrom !== undefined) layer.visibleFrom = Math.floor(layer.visibleFrom * ratio);
      if (layer.visibleUntil !== undefined) layer.visibleUntil = Math.ceil(layer.visibleUntil * ratio);
    }
    delete scene.transitionIn;
    delete scene.transitionOut;
    delete scene.outro;
    if (index > 0) delete result.scenes[index - 1]!.transitionOut;
    if (result.scenes[index + 1]) delete result.scenes[index + 1]!.transitionIn;
  }
  result.project.status = 'generated';
  result.project.durationFrames = getTimelineDuration(result);
  result.project.durationSec = result.project.durationFrames / fps;
  return result;
}
