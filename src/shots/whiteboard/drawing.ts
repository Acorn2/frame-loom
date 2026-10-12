// Method reference: simon-skills whiteboard-video. Pure geometry, independent
// implementation: no mutable playback state, screenshot renderer or dependency.
export type Point = {x: number; y: number};
export function seededOffset(seed: string, index: number): number {
  let value = 2166136261;
  for (const char of `${seed}:${index}`) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return ((value >>> 0) / 4294967295 - .5) * 2;
}
export function roughPolyline(points: Point[], seed: string, roughness: number): Point[] {
  return points.flatMap((point, index) => {
    if (!index) return [point];
    const previous = points[index - 1]!;
    return [{x: (previous.x + point.x) / 2 + seededOffset(seed, index * 2) * roughness,
      y: (previous.y + point.y) / 2 + seededOffset(seed, index * 2 + 1) * roughness}, point];
  });
}
export function pathData(points: Point[]): string {
  return points.map((point, i) => `${i ? 'L' : 'M'}${point.x.toFixed(3)} ${point.y.toFixed(3)}`).join(' ');
}
export function pathLength(points: Point[]): number {
  return points.slice(1).reduce((length, point, i) => length + Math.hypot(point.x - points[i]!.x, point.y - points[i]!.y), 0);
}
export function pointOnPath(points: Point[], progress: number): Point {
  let distance = Math.max(0, Math.min(1, progress)) * pathLength(points);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!, b = points[i]!, segment = Math.hypot(b.x - a.x, b.y - a.y);
    if (distance <= segment) {
      const t = segment ? distance / segment : 0;
      return {x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t};
    }
    distance -= segment;
  }
  return points.at(-1)!;
}
export function drawingProgress(frame: number, start: number, duration: number): number {
  return Math.max(0, Math.min(1, (frame - start) / duration));
}
export function penPosition(frame: number, stages: {start: number; duration: number; points: Point[]}[], maxTravelFrames = 24): Point | undefined {
  const ordered = [...stages].sort((a, b) => a.start - b.start);
  for (let i = 0; i < ordered.length; i++) {
    const stage = ordered[i]!, end = stage.start + stage.duration;
    if (frame >= stage.start && frame < end) return pointOnPath(stage.points, drawingProgress(frame, stage.start, stage.duration));
    const next = ordered[i + 1];
    if (next && frame >= end && frame < next.start && next.start - end <= maxTravelFrames) {
      return pointOnPath([stage.points.at(-1)!, next.points[0]!], drawingProgress(frame, end, next.start - end));
    }
  }
  return undefined;
}
