export interface CaptionCue {
  startSec: number;
  endSec: number;
  text: string;
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
