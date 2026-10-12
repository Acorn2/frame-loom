import {z} from 'zod';
import {displayCaptionText, splitCaptionText, splitCaptionWindow} from './captions';

// Seconds relative to the individual speech take, never the project timeline.
export const SpeechWordSchema = z.object({text: z.string().min(1), startSec: z.number().nonnegative(), endSec: z.number().nonnegative()}).strict();
export type SpeechWord = z.infer<typeof SpeechWordSchema>;
export const speechText = (text: string) => text.normalize('NFC').replace(/[\s\p{P}]/gu, '');

export function validateSpeechWords(text: string, words: SpeechWord[], durationSec: number): boolean {
  if (!words.length || !Number.isFinite(durationSec) || durationSec <= 0) return false;
  let previousEnd = 0;
  for (const word of words) {
    if (!SpeechWordSchema.safeParse(word).success || word.endSec <= word.startSec || word.startSec < previousEnd - .001 || word.endSec > durationSec + .001) return false;
    previousEnd = word.endSec;
  }
  return speechText(words.map(word => word.text).join('')) === speechText(text);
}

// Require exact word boundaries. TN substitutions, partial lists and an internal
// word split cannot be advertised as provider-measured timing.
export function speechWindows(text: string, chunks: string[], words: SpeechWord[] | undefined, durationSec: number) {
  if (chunks.some(chunk => !speechText(chunk)) || speechText(chunks.join('')) !== speechText(text)) throw new Error('语音片段必须按顺序完整覆盖原旁白。');
  if (!words || !validateSpeechWords(text, words, durationSec)) return undefined;
  let offset = 0;
  const spans = words.filter(word => speechText(word.text)).map(word => {
    const start = offset;
    offset += [...speechText(word.text)].length;
    return {...word, start, end: offset};
  });
  offset = 0;
  const windows = chunks.map(chunk => {
    const start = offset;
    offset += [...speechText(chunk)].length;
    const first = spans.find(word => word.start === start), last = spans.find(word => word.end === offset);
    return first && last ? {text: chunk, start: first.startSec, end: last.endSec} : undefined;
  });
  return windows.every(window => window !== undefined) ? windows : undefined;
}

export function speechCaptions(text: string, startSec: number, durationSec: number, words?: SpeechWord[]) {
  const measured = speechWindows(text, splitCaptionText(text), words, durationSec);
  if (measured) return {source: 'provider' as const, cues: measured.map(cue => ({start: startSec + cue.start, end: startSec + cue.end, text: displayCaptionText(cue.text)}))};
  return {source: 'estimated' as const, cues: splitCaptionWindow(text, startSec, startSec + durationSec)};
}
