export interface CaptionCue {
  startSec: number;
  endSec: number;
  text: string;
}

const MAX_CAPTION_UNITS = 20;

function captionUnits(value: string): number {
  return [...value].reduce((total, char) => total + (/\p{Script=Han}/u.test(char) ? 1 : /[A-Za-z0-9]/u.test(char) ? 0.6 : /\s/u.test(char) ? 0.3 : 0.5), 0);
}

export function splitCaptionText(text: string, maxUnits = MAX_CAPTION_UNITS): string[] {
  const normalized = text.replace(/\s+/gu, ' ').trim();
  if (!normalized) return [];
  const clauses = normalized.match(/[^，。！？；、,.!?;]+[，。！？；、,.!?;]?/gu) ?? [normalized];
  const chunks: string[] = [];
  let current = '';
  for (const clause of clauses) {
    if (current && captionUnits(current + clause) > maxUnits) {
      chunks.push(current.trim());
      current = '';
    }
    for (const char of clause) {
      if (current && captionUnits(current + char) > maxUnits) {
        if (/[，。！？；、,.!?;]/u.test(char)) {
          chunks.push((current + char).trim());
          current = '';
          continue;
        }
        chunks.push(current.trim());
        current = '';
      }
      current += char;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

// A cue boundary already marks a pause. Keep punctuation within the cue, and
// retain a final question or exclamation mark when it carries spoken tone.
export function displayCaptionText(text: string): string {
  return text
    .replace(/^[\s，。！？；：、,.!?;:]+/u, '')
    .replace(/[\s，。；：、,.;:]+$/u, '')
    .trim();
}

export function splitCaptionWindow(text: string, start: number, end: number): Array<{start: number; end: number; text: string}> {
  const chunks = splitCaptionText(text).map(displayCaptionText).filter(Boolean);
  const weights = chunks.map((chunk) => Math.max(1, captionUnits(chunk)));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const duration = end - start;
  const minimum = duration >= chunks.length * 0.8 ? 0.8 : 0;
  let elapsedWeight = 0;
  return chunks.map((chunk, index) => {
    const cueStart = start + index * minimum + (duration - chunks.length * minimum) * elapsedWeight / total;
    elapsedWeight += weights[index] ?? 0;
    return {start: cueStart, end: index === chunks.length - 1 ? end : start + (index + 1) * minimum + (duration - chunks.length * minimum) * elapsedWeight / total, text: chunk};
  });
}

export function splitCaptionCues(cues: CaptionCue[]): CaptionCue[] {
  return cues.flatMap((cue) => splitCaptionWindow(cue.text, cue.startSec, cue.endSec).map(({start, end, text}) => ({startSec: start, endSec: end, text})));
}

function parseTimestamp(value: string): number {
  const match = value.trim().match(/(?:(\d+):)?(\d{2}):(\d{2})[,.](\d{3})/);
  if (!match) throw new Error(`无法解析字幕时间：${value}`);
  return Number(match[1] ?? 0) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
}

export function parseCaptions(input: string): CaptionCue[] {
  const normalized = input.replaceAll('\r\n', '\n').replace(/^WEBVTT[^\n]*\n+/, '').trim();
  if (!normalized) return [];
  const cues: CaptionCue[] = [];
  for (const block of normalized.split(/\n{2,}/)) {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    const timingIndex = lines.findIndex((line) => line.includes('-->'));
    if (timingIndex === -1) continue;
    const timingLine = lines[timingIndex];
    if (!timingLine) continue;
    const [startText, endWithSettings] = timingLine.split('-->').map((item) => item.trim());
    const endText = endWithSettings?.split(/\s+/)[0];
    if (!startText || !endText) throw new Error(`字幕时间行无效：${timingLine}`);
    const startSec = parseTimestamp(startText);
    const endSec = parseTimestamp(endText);
    const text = lines.slice(timingIndex + 1).join('\n').replace(/<[^>]+>/g, '').trim();
    if (!text || endSec <= startSec) throw new Error(`字幕 cue 无效：${block}`);
    cues.push({startSec, endSec, text});
  }
  return cues.sort((a, b) => a.startSec - b.startSec);
}
