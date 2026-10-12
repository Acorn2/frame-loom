import {z} from 'zod';
import type {StoryboardScene} from '../schemas/storyboard';
import {boardArrow, boardShape, textSeconds} from '../shots/whiteboard-board/drawing';
import {resolveShot} from '../shots/catalog';
import {hashNarration} from './text-hash';
import {speechText, speechWindows, type SpeechWord} from './speech-timing';

export const SpeechCuesSchema = z.object({schemaVersion: z.literal('1.0'), scenes: z.array(z.object({
  sceneId: z.string().min(1), textHash: z.string().regex(/^[a-f0-9]{64}$/),
  groups: z.array(z.object({text: z.string().min(1), targets: z.array(z.string().min(1)).min(1)}).strict()).min(1)
}).strict()).min(1)}).strict();
export type SpeechCues = z.infer<typeof SpeechCuesSchema>;
type SceneCues = SpeechCues['scenes'][number];
export interface WhiteboardTimingEvidence {sceneId: string; timingSource: 'provider' | 'estimated' | 'original-beats'; actions: Array<{target: string; start: number; duration: number}>}

export function scheduleWhiteboard(scene: StoryboardScene, fps: number, ratio: number, durationSec: number, words?: SpeechWord[], cues?: SceneCues) {
  const shot = scene.shot;
  if (shot?.id !== 'whiteboard-board') throw new Error(`${scene.id}: 语音分组仅支持 whiteboard-board。`);
  const recipe = resolveShot(shot.id, shot.version);
  let windows;
  let timingSource: WhiteboardTimingEvidence['timingSource'] = 'original-beats';
  if (cues) {
    const targets = cues.groups.flatMap(group => group.targets);
    if (cues.textHash !== hashNarration(scene.narration.trim()) || speechText(cues.groups.map(group => group.text).join('')) !== speechText(scene.narration)) throw new Error(`${scene.id}: 语音分组与当前旁白不一致。`);
    if (new Set(targets).size !== targets.length || JSON.stringify([...targets].sort()) !== JSON.stringify(scene.beats.map(beat => beat.target).sort())) throw new Error(`${scene.id}: 语音分组必须唯一覆盖所有绘制目标。`);
    windows = speechWindows(scene.narration, cues.groups.map(group => group.text), words, durationSec);
    timingSource = windows ? 'provider' : 'estimated';
    if (!windows) {
      let position = 0;
      const total = [...speechText(scene.narration)].length;
      windows = cues.groups.map(group => {
        const start = position / total * durationSec;
        position += [...speechText(group.text)].length;
        return {text: group.text, start, end: position / total * durationSec};
      });
    }
  }
  const ordered = cues ? cues.groups.flatMap((group, i) => group.targets.map(target => ({beat: scene.beats.find(beat => beat.target === target)!, earliest: Math.ceil(windows![i]!.start * fps), deadline: Math.floor(windows![i]!.end * fps)})))
    : [...scene.beats].sort((a, b) => a.start - b.start).map(beat => ({beat, earliest: Math.floor(beat.start * ratio), deadline: scene.durationFrames}));
  let cursor = 0;
  for (const {beat, earliest, deadline} of ordered) {
    const element = shot.elements[beat.target];
    const layer = scene.layers.find(item => item.id === beat.target);
    const route = shot.routes[beat.target];
    const strokeSeconds = (parts: ReturnType<typeof boardShape>) => parts.reduce((sum, part) => sum + part.length, 0) / 1800 + .15;
    const natural = element && layer ? textSeconds(`${layer.label}${layer.text ? `\n${layer.text}` : ''}`, element.kind === 'sticker' ? element.labelSize : element.fontSize)
      + (element.kind === 'sticker' ? .8 : element.kind === 'text' ? 0 : Math.max(.35, strokeSeconds(boardShape(element, beat.target, '#000'))))
      : route ? Math.max(.35, strokeSeconds(boardArrow(route, beat.target, '#000'))) : beat.duration / fps;
    const budget = recipe.timing.actions[beat.action];
    if (!budget || natural > budget.maxSec) throw new Error(`${scene.id}/${beat.target}: 自然书写超出动作预算，请缩短文字或拆镜头。`);
    beat.duration = Math.ceil(Math.max(natural, budget.minSec) * fps);
    beat.start = Math.max(cursor, earliest);
    if (beat.start + beat.duration > Math.min(deadline, scene.durationFrames - Math.ceil(recipe.timing.readingSec * fps))) throw new Error(`${scene.id}/${beat.target}: 旁白窗口不足以完成书写与阅读，请调整语音分组或拆镜头。`);
    cursor = beat.start + beat.duration + Math.ceil(recipe.timing.itemHoldSec * fps);
  }
  return {sceneId: scene.id, timingSource, actions: ordered.map(({beat}) => ({target: beat.target, start: beat.start, duration: beat.duration}))};
}
