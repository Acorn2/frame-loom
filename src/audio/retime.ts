import {compileStoryboardShots} from '../shots/compile-shot';
import {resolveShot} from '../shots/catalog';
import type {StoryboardScene} from '../schemas/storyboard';
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
    if (result.schemaVersion === '2.4') retimeRecipe(scene, ratio, fps);
    else scene.beats = scene.beats.map((beat) => ({...beat, start: Math.floor(beat.start * ratio), duration: Math.max(1, Math.floor(beat.duration * ratio))}));
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
  if (result.schemaVersion === '2.4') compileStoryboardShots(result);
  return result;
}

function retimeRecipe(scene: StoryboardScene, ratio: number, fps: number) {
  if (!scene.shot) throw new Error(`${scene.id}: 缺少 shot。`);
  const recipe = resolveShot(scene.shot.id, scene.shot.version);
  scene.beats = scene.beats.map((beat) => {
    const budget = recipe.timing.actions[beat.action];
    if (!budget) throw new Error(`${scene.id}: 配方不支持 ${beat.action}。`);
    return {...beat, start: Math.floor(beat.start * ratio), duration: Math.min(Math.ceil(budget.maxSec * fps), Math.max(Math.ceil(budget.minSec * fps), beat.duration))};
  });
  const entry = (target: string) => scene.beats.find((beat) => beat.target === target && ['enter', 'reveal'].includes(beat.action));
  const end = (beat: NonNullable<ReturnType<typeof entry>>) => beat.start + beat.duration;
  let ready = 0;
  if (scene.shot.id === 'document-conclusions' || scene.shot.id === 'title-to-label') {
    const sourceId = scene.shot.id === 'document-conclusions' ? scene.shot.slots.source : scene.shot.slots.title;
    const first = entry(sourceId);
    const phase = scene.beats.find((beat) => beat.target === sourceId && beat.action === (scene.shot?.id === 'document-conclusions' ? 'dock' : 'demote'));
    if (!first || !phase) throw new Error(`${scene.id}: 缺少来源/标题阶段。`);
    const hold = scene.shot.id === 'document-conclusions' ? recipe.timing.sourceHoldSec : recipe.timing.titleHoldSec;
    phase.start = Math.max(phase.start, end(first) + Math.ceil(hold * fps));
    ready = end(phase);
  } else if (scene.shot.id === 'network-expand') {
    const first = entry(scene.shot.slots.anchor);
    if (first) ready = end(first);
  }
  if ('items' in scene.shot.slots) {
    let previous = -Infinity;
    for (const id of scene.shot.slots.items) {
      const beat = entry(id);
      if (!beat) throw new Error(`${scene.id}: 缺少 ${id} 入场。`);
      beat.start = Math.max(beat.start, ready, previous + Math.ceil(recipe.timing.itemHoldSec * fps));
      if (scene.shot.id === 'diagram-cascade') {
        const parent = scene.connections.find((item) => item.to === id)?.from;
        const parentEntry = parent && entry(parent);
        if (parentEntry) beat.start = Math.max(beat.start, end(parentEntry));
      }
      previous = beat.start;
      const link = scene.connections.find((item) => item.to === id);
      const draw = link && scene.beats.find((item) => item.target === link.id && item.action === 'draw');
      if (draw) {
        draw.start = Math.max(scene.shot.id === 'diagram-cascade' ? beat.start : ready, Math.min(draw.start, end(beat) - draw.duration));
      }
    }
  }
  if (scene.shot.id === 'card-stack') {
    const firstItem = scene.shot.slots.items[0];
    const focus = scene.beats.find((beat) => beat.action === 'focus' && beat.target === firstItem);
    if (focus) focus.start = Math.max(focus.start, ...scene.shot.slots.items.map((id) => end(entry(id)!)));
  }
  if (scene.shot.id === 'platform-hinge-rise' || scene.shot.id === 'source-converge') {
    const result = entry(scene.shot.slots.result);
    if (result) {
      const sourcesReady = Math.max(...scene.shot.slots.items.map((id) => end(entry(id)!))) + Math.ceil(recipe.timing.sourceHoldSec * fps);
      result.start = Math.max(result.start, sourcesReady);
      if (scene.shot.id === 'source-converge') {
        const draws = scene.beats.filter((item) => item.action === 'draw');
        if (scene.shot.version !== '1.0.0') {
          for (const beat of draws) beat.start = Math.max(sourcesReady, Math.min(beat.start, result.start - beat.duration));
          result.start = Math.max(result.start, ...draws.map(end));
        } else {
          for (const beat of draws) beat.start = Math.max(sourcesReady, Math.min(beat.start, end(result) - beat.duration));
        }
      }
    }
  }
  const shot = scene.shot;
  if (shot.id === 'lead-word-assemble') {
    const lead = entry(shot.slots.phrases[0]!)!;
    const focus = scene.beats.find((beat) => beat.action === 'focus')!;
    focus.start = Math.max(focus.start, end(lead) + Math.ceil(.6 * fps));
    for (const id of shot.slots.phrases.slice(1)) entry(id)!.start = Math.max(entry(id)!.start, end(focus));
  }
  if (['pill-slot-cycle', 'word-roll', 'text-column-converge', 'evidence-relay', 'timeline-travel'].includes(shot.id) && 'items' in shot.slots) {
    let previousEnd = 'prefix' in shot.slots ? end(entry(shot.slots.prefix)!) : -Infinity;
    if ('suffix' in shot.slots && shot.slots.suffix) previousEnd = Math.max(previousEnd, end(entry(shot.slots.suffix)!));
    shot.slots.items.forEach((id, i) => {
      const first = entry(id)!;
      first.start = Math.max(first.start, previousEnd + (i ? Math.ceil(.8 * fps) : 0));
      previousEnd = end(first);
      if (shot.id === 'evidence-relay') {const keyword = entry(shot.slots.keywords[i]!)!; keyword.start = first.start; keyword.duration = first.duration;}
    });
    if (shot.id === 'text-column-converge') {
      const focus = scene.beats.find((beat) => beat.action === 'focus')!;
      focus.start = Math.max(focus.start, previousEnd + Math.ceil(.8 * fps));
      entry(shot.slots.result)!.start = Math.max(entry(shot.slots.result)!.start, end(focus));
    }
  }
  if (shot.id === 'structure-then-text') {
    const closed = Math.max(...scene.beats.filter((beat) => beat.action === 'trace').map(end));
    for (const id of shot.slots.items) entry(id)!.start = Math.max(entry(id)!.start, closed);
  }
  if ((shot.id === 'row-embed' || shot.id === 'card-stack') && shot.treatment) {
    for (const beat of scene.beats.filter((beat) => beat.action === 'tape')) beat.start = Math.max(beat.start, end(entry(beat.target)!));
    if (shot.id === 'card-stack') {
      const focus = scene.beats.find((beat) => beat.action === 'focus')!;
      focus.start = Math.max(focus.start, ...scene.beats.filter((beat) => beat.action === 'tape').map(end));
    }
  }
  if (shot.id === 'concept-matrix' && shot.slots.fronts) shot.slots.items.forEach((id, i) => {entry(id)!.start = Math.max(entry(id)!.start, end(entry(shot.slots.fronts![i]!)!) + Math.ceil(.8 * fps));});
  if (shot.id === 'odometer-roll') {const count = scene.beats.find((beat) => beat.action === 'count')!; count.start = Math.max(count.start, end(entry(shot.slots.metric)!));}
  for (const beat of scene.beats.filter((item) => item.action === 'highlight')) {
    const first = entry(beat.target);
    if (['paper-title', 'blur-slide', 'split-text-stagger'].includes(scene.shot.id) && first) beat.start = Math.max(beat.start, end(first));
  }
}
