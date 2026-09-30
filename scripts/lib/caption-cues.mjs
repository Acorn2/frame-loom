import {z} from 'zod';
import {displayCaptionText, splitCaptionText} from '../../src/audio/captions.ts';

const ManualCues = z.object({
  schemaVersion: z.literal('1.0'),
  scenes: z.array(z.object({
    sceneId: z.string(), textHash: z.string(),
    cues: z.array(z.object({startSec: z.number().nonnegative(), endSec: z.number().positive(), text: z.string().min(1)}).strict()).min(1)
  }).strict()).min(1)
}).strict();

const spokenText = (text) => text.replace(/[\s\p{P}]/gu, '');

export function resolveManualCues(value, segments) {
  const input = ManualCues.parse(value);
  if (input.scenes.length !== segments.length || new Set(input.scenes.map((scene) => scene.sceneId)).size !== input.scenes.length) throw new Error('手工字幕必须覆盖所有旁白镜头且不能重复。');
  return segments.flatMap((segment) => {
    const scene = input.scenes.find((scene) => scene.sceneId === segment.sceneId);
    if (!scene || scene.textHash !== segment.textHash) throw new Error(`${segment.sceneId}: 手工字幕讲稿指纹已过期。`);
    if (spokenText(scene.cues.map((cue) => cue.text).join('')) !== spokenText(segment.text)) throw new Error(`${segment.sceneId}: 手工字幕必须保持原稿文字和顺序。`);
    let previousEnd = 0;
    return scene.cues.map((cue) => {
      if (cue.startSec < previousEnd || cue.endSec <= cue.startSec || cue.endSec > segment.durationSec + 0.001) throw new Error(`${segment.sceneId}: 手工字幕重叠或超出实测语音。`);
      previousEnd = cue.endSec;
      if (splitCaptionText(cue.text).length !== 1) throw new Error(`${segment.sceneId}: 手工字幕需按短句单行分段，不再估算拆分时间。`);
      return {start: segment.startSec + cue.startSec, end: segment.startSec + cue.endSec, text: displayCaptionText(cue.text)};
    });
  });
}
