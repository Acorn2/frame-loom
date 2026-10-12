// Adapted from simon-skills/whiteboard-video/lib/render.html (MIT, trustfuture).
// See references/licenses/simon-whiteboard-MIT.txt. Frame progress is immutable.
import rough from 'roughjs';
import type {Drawable, Op} from 'roughjs/bin/core';
import {pathData, pathLength, pointOnPath, type Point} from '../whiteboard/drawing';
import type {BoardElement, WhiteboardBoard} from './schema';
export const BOARD_FILLS = {none: 'transparent', blue: '#a5d8ff', yellow: '#ffec99', green: '#b2f2bb', red: '#ffc9c9'};
export const clamp = (n: number) => n >= 1 - 1e-8 ? 1 : n <= 1e-8 ? 0 : n;
export function textSeconds(text: string, size: number) {
  const per = Math.max(.06, Math.min(.2, size / 700));
  return [...text].reduce((sum, ch) => sum + per * (/\s/u.test(ch) ? .2 : /\p{Script=Han}|[\u3000-\u303f\uff00-\uffef]/u.test(ch) ? 1 : .5), 0);
}
function seedFor(id: string) {let n = 2166136261; for (const c of id) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return (n >>> 0) || 1;}
function splitOps(ops: Op[]): Point[][] {
  const result: Point[][] = [];
  for (const op of ops) {
    const d = op.data;
    if (op.op === 'move') result.push([{x: d[0]!, y: d[1]!}]);
    else {
      const line = result.at(-1)!;
      if (op.op === 'lineTo') line.push({x: d[0]!, y: d[1]!});
      else {
        const a = line.at(-1)!;
        for (let i = 1; i <= 32; i++) {const t = i / 32, v = 1 - t;
          line.push({x: v ** 3 * a.x + 3 * v ** 2 * t * d[0]! + 3 * v * t ** 2 * d[2]! + t ** 3 * d[4]!, y: v ** 3 * a.y + 3 * v ** 2 * t * d[1]! + 3 * v * t ** 2 * d[3]! + t ** 3 * d[5]!});
        }
      }
    }
  }
  return result.filter(p => p.length > 1);
}
export type StrokePart = {points: Point[]; second?: Point[]; length: number; d: string; secondD?: string; color: string; width: number; fill: boolean; dashed?: boolean};
function parts(drawables: Drawable[], outline: string, fill?: string, dashed = false): StrokePart[] {
  return drawables.flatMap(d => d.sets.flatMap(set => {
    const paths = splitOps(set.ops), filling = set.type !== 'path', out: StrokePart[] = [];
    for (let i = 0; i < paths.length; i += filling || dashed ? 1 : 2) {
      const points = paths[i]!, second = !filling && !dashed ? paths[i + 1] : undefined;
      out.push({points, second, length: pathLength(points), d: pathData(points), secondD: second && pathData(second), color: filling ? fill! : outline, width: filling ? 2.2 : 3, fill: filling, dashed});
    }
    return out;
  }));
}
export function boardShape(element: BoardElement, id: string, color: string): StrokePart[] {
  if (element.kind === 'text' || element.kind === 'sticker') return [];
  const gen = rough.generator(), options = {seed: seedFor(id), roughness: 1.2, stroke: color, strokeWidth: 3, preserveVertices: true, disableMultiStrokeFill: true, fill: element.fill === 'none' ? undefined : BOARD_FILLS[element.fill], fillStyle: 'hachure', hachureAngle: -41, hachureGap: 12};
  const {x, y, width: w, height: h} = element;
  const drawable = element.kind === 'checkbox' ? gen.rectangle(x, y + 8, 38, 38, options) : element.kind === 'ellipse' ? gen.ellipse(x + w / 2, y + h / 2, w, h, options) : gen.path(`M${x + 24} ${y} H${x + w - 24} Q${x + w} ${y} ${x + w} ${y + 24} V${y + h - 24} Q${x + w} ${y + h} ${x + w - 24} ${y + h} H${x + 24} Q${x} ${y + h} ${x} ${y + h - 24} V${y + 24} Q${x} ${y} ${x + 24} ${y}`, options);
  const result = parts([drawable], color, BOARD_FILLS[element.fill]);
  // Solid fill is explicit and revealed after the outline; hatch strokes stay separate.
  return element.fillStyle === 'solid' ? result.filter(p => !p.fill) : result;
}
export function boardArrow(route: WhiteboardBoard['routes'][string], id: string, color: string): StrokePart[] {
  const gen = rough.generator(), pts = route.points, options = {seed: seedFor(id), roughness: 1.2, stroke: color, strokeWidth: 3, disableMultiStroke: route.dashed, preserveVertices: true};
  const a = pts.at(-2)!, b = pts.at(-1)!, angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
  return parts([gen.linearPath(pts, options), ...[-1, 1].map(sign => gen.line(b[0], b[1], b[0] - 26 * Math.cos(angle + sign * .45), b[1] - 26 * Math.sin(angle + sign * .45), options))], color, undefined, route.dashed);
}
export function strokeProgress(parts: StrokePart[], progress: number) {
  const ordered = [...parts.filter(p => !p.fill), ...parts.filter(p => p.fill)], outline = ordered.filter(p => !p.fill), fills = ordered.filter(p => p.fill);
  const split = outline.length && fills.length ? .7 : outline.length ? 1 : 0;
  return ordered.map(part => {
    const list = part.fill ? fills : outline, total = list.reduce((sum, p) => sum + p.length, 0) || 1;
    const index = list.indexOf(part), start = list.slice(0, index).reduce((sum, p) => sum + p.length, 0) / total;
    const fraction = part.length / total || 1, phase = part.fill ? (progress - split) / (1 - split || 1) : progress / (split || 1);
    const p = clamp((phase - start) / fraction);
    return {...part, p, secondProgress: clamp((p - .06) / .94), tip: p > 0 && p < 1 ? pointOnPath(part.points, p) : undefined};
  });
}
export function travelTip(frame: number, list: {start: number; duration: number; first: Point; last: Point}[], fps: number): Point | undefined {
  const ordered = [...list].sort((a, b) => a.start - b.start);
  for (let i = 0; i < ordered.length; i++) {
    const b = ordered[i]!;
    if (frame < b.start) {
      const a = ordered[i - 1]; if (!a) return frame > b.start - .25 * fps ? b.first : undefined;
      const end = a.start + a.duration, gap = b.start - end;
      if (gap > 1.6 * fps) return frame < end + .35 * fps ? a.last : frame > b.start - .3 * fps ? b.first : undefined;
      const t = clamp((frame - end) / gap), eased = t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      return {x: a.last.x + (b.first.x - a.last.x) * eased, y: a.last.y + (b.first.y - a.last.y) * eased};
    }
    if (frame < b.start + b.duration) return undefined;
  }
  const last = ordered.at(-1); return last && frame < last.start + last.duration + .3 * fps ? last.last : undefined;
}
