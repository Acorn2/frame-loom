import type {Rect} from '../../layout/scene-layout';
import {overlaps} from '../../layout/scene-layout';
import type {IllustratedShot} from './schema';
export {whiteboardCanvas as illustratedCanvas} from '../whiteboard/layout';
export const illustratedType = {label: 38, text: 28, lineHeight: 1.35, gap: 14};

function flatLayout(shot: IllustratedShot, width: number, height: number): Map<string, Rect> {
  const rects = new Map<string, Rect>(), count = shot.slots.items.length;
  if (shot.id === 'illustrated-hero') {
    rects.set(shot.slots.subject, {x: width * .48, y: 16, width: width * .50, height: height - 32});
    rects.set(shot.slots.items[0]!, {x: 24, y: height * .12, width: width * .39, height: height * .76});
  } else if (shot.id === 'illustrated-compare' || shot.id === 'illustrated-process') {
    const gap = shot.id === 'illustrated-compare' ? 112 : 80, w = (width - 64 - gap * (count - 1)) / count;
    shot.slots.items.forEach((id, i) => rects.set(id, {x: 32 + i * (w + gap), y: 32 + (shot.id === 'illustrated-process' && i % 2 ? 20 : 0), width: w, height: height - 84}));
  } else if (shot.id === 'illustrated-explain') {
    rects.set(shot.slots.subject, {x: width * .32, y: height * .10, width: width * .34, height: height * .80});
    shot.slots.items.forEach((id, i) => rects.set(id, count === 2
      ? {x: i ? width * .73 : 16, y: height * .22, width: width * .26 - 16, height: height * .58}
      : {x: i ? width * .73 : 16, y: i ? (i === 1 ? 16 : height * .55) : height * .23, width: width * .26 - 16, height: i ? height * .41 : height * .54}));
  } else {
    rects.set(shot.slots.subject, {x: 16, y: height * .08, width: width * .43, height: height * .84});
    const columns = shot.id === 'illustrated-breakdown' ? 2 : 1, rows = Math.ceil(count / columns);
    const gap = 28, w = (width * .47 - gap * (columns - 1)) / columns, h = (height - 40 - gap * (rows - 1)) / rows;
    shot.slots.items.forEach((id, i) => rects.set(id, {x: width * .51 + (i % columns) * (w + gap), y: 20 + Math.floor(i / columns) * (h + gap), width: w, height: h}));
  }
  return rects;
}

function pixelLayout(shot: IllustratedShot, width: number, height: number): Map<string, Rect> {
  const rects = new Map<string, Rect>(), count = shot.slots.items.length;
  if (shot.id === 'illustrated-hero') {
    rects.set(shot.slots.subject, {x: 40, y: height * .13, width: width * .28, height: height * .74});
    rects.set(shot.slots.items[0]!, {x: width * .39, y: 40, width: width * .57 - 24, height: height - 80});
  } else if (shot.id === 'illustrated-compare' || shot.id === 'illustrated-process') {
    const gap = 28, h = (height - 56 - gap * (count - 1)) / count;
    shot.slots.items.forEach((id, i) => rects.set(id, {x: 64, y: 28 + i * (h + gap), width: width - 104, height: h}));
  } else if (shot.id === 'illustrated-metric') {
    rects.set(shot.slots.subject, {x: width * .73, y: height * .13, width: width * .23, height: height * .74});
    const gap = 20, h = (height - 40 - gap * (count - 1)) / count;
    shot.slots.items.forEach((id, i) => rects.set(id, {x: 40, y: 20 + i * (h + gap), width: width * .60, height: h}));
  } else {
    rects.set(shot.slots.subject, {x: 40, y: height * .13, width: width * .27, height: height * .74});
    const columns = shot.id === 'illustrated-breakdown' && count > 2 ? 2 : 1, rows = Math.ceil(count / columns);
    const gap = 24, w = (width * .57 - 32 - gap * (columns - 1)) / columns, h = (height - 56 - gap * (rows - 1)) / rows;
    shot.slots.items.forEach((id, i) => rects.set(id, {x: width * .40 + (i % columns) * (w + gap), y: 28 + Math.floor(i / columns) * (h + gap), width: w, height: h}));
  }
  return rects;
}

// Keep the existing whiteboard illustrated compatibility geometry unchanged.
function whiteboardLayout(shot: IllustratedShot, width: number, height: number): Map<string, Rect> {
  const rects = new Map<string, Rect>(), count = shot.slots.items.length;
  if (shot.id === 'illustrated-compare' || shot.id === 'illustrated-process') {
    const gap = shot.id === 'illustrated-process' ? 72 : 100, w = (width - 32 - gap * (count - 1)) / count;
    shot.slots.items.forEach((id, i) => rects.set(id, {x: 16 + i * (w + gap), y: 20, width: w, height: height - 40}));
  } else if (shot.id === 'illustrated-hero') {
    rects.set(shot.slots.subject, {x: width * .46, y: 0, width: width * .54 - 16, height});
    rects.set(shot.slots.items[0]!, {x: 24, y: height * .22, width: width * .4, height: height * .62});
  } else {
    rects.set(shot.slots.subject, {x: 16, y: 20, width: width * .39, height: height - 40});
    if (shot.id === 'illustrated-breakdown') {
      const gap = 32, w = (width * .48 - gap) / 2, h = (height - 60) / 2;
      shot.slots.items.forEach((id, i) => rects.set(id, {x: width * .52 + (i % 2) * (w + gap), y: 16 + Math.floor(i / 2) * (h + 28), width: w, height: h}));
    } else {
      const gap = 26, h = (height - 40 - gap * (count - 1)) / count;
      shot.slots.items.forEach((id, i) => rects.set(id, {x: width * .52, y: 20 + i * (h + gap), width: width * .48 - 16, height: h}));
    }
  }
  return rects;
}

export function illustratedLayout(shot: IllustratedShot, width: number, height: number, style = 'flat-explainer'): Map<string, Rect> {
  return style === 'paper-collage' ? pixelLayout(shot, width, height)
    : style === 'flat-explainer' ? flatLayout(shot, width, height) : whiteboardLayout(shot, width, height);
}

export function illustrationTextBox(shot: IllustratedShot, id: string, rect: Rect, style = 'whiteboard') {
  const subject = 'subject' in shot.slots && id === shot.slots.subject;
  const image = subject || ['illustrated-compare', 'illustrated-process', 'illustrated-breakdown'].includes(shot.id);
  const pixel = style === 'paper-collage', flat = style === 'flat-explainer', hero = shot.id === 'illustrated-hero' && !subject;
  const row = pixel && image && !subject;
  const compact = shot.id === 'illustrated-breakdown' || (shot.id === 'illustrated-process' && shot.slots.items.length === 4);
  const denseMetric = (flat || pixel) && shot.id === 'illustrated-metric' && shot.slots.items.length === 3;
  const label = subject ? (pixel ? 26 : 32) : hero && (flat || pixel) ? (pixel ? 52 : 56) : denseMetric ? 28 : compact ? (pixel ? 26 : flat ? 28 : 30) : pixel ? 34 : 38;
  const text = hero && (flat || pixel) ? 30 : compact ? pixel ? 22 : 24 : pixel ? 26 : 28;
  const inset = flat || pixel ? 20 : 8;
  const imageWidth = row ? Math.min(rect.width * .28, rect.height * 1.15) : rect.width;
  const imageHeight = !image ? 0 : row ? rect.height - 24 : subject ? Math.max(0, rect.height - (flat || pixel ? label * 1.5 + 24 : label * 1.3 + 8)) : rect.height * (flat ? .55 : .60);
  const left = row ? imageWidth + 32 : inset, top = row ? 12 : image ? imageHeight : flat || pixel ? 20 : 0;
  const bottom = flat || pixel ? 16 : 0;
  return {image, imageWidth, imageHeight, imageLeft: row ? 12 : 0, imageTop: row ? 12 : 0, row, label, text,
    width: rect.width - left - inset, height: rect.height - top - bottom, left, top, gap: subject ? 0 : pixel && compact ? 8 : illustratedType.gap,
    metricFont: denseMetric ? 48 : (flat || pixel) && shot.id === 'illustrated-metric' ? shot.slots.items.length === 1 ? pixel ? 160 : 144 : 80 : 64};
}

// Route between facing edges; vertical pixel sequences use a left-hand gutter.
export function illustratedConnection(a: Rect, b: Rect, pixel: boolean, obstacles: Rect[] = []) {
  const ac = {x: a.x + a.width / 2, y: a.y + a.height / 2}, bc = {x: b.x + b.width / 2, y: b.y + b.height / 2};
  if (pixel && Math.abs(a.x - b.x) < 1 && b.y >= a.y + a.height) {
    const ax = a.x - 8, ay = ac.y, bx = b.x - 8, by = bc.y, gutter = Math.min(a.x, b.x) - 28;
    return {path: `M${ax} ${ay} H${gutter} V${by} H${bx}`, x: bx, y: by, angle: 0};
  }
  const right = bc.x >= ac.x, ax = right ? a.x + a.width + 8 : a.x - 8, ay = ac.y;
  const bx = right ? b.x - 12 : b.x + b.width + 12, by = bc.y, direction = right ? 1 : -1;
  const corridor = {x: Math.min(ax, bx), y: Math.min(ay, by), width: Math.abs(ax - bx), height: Math.max(1, Math.abs(ay - by))};
  const blockers = obstacles.filter(rect => rect !== a && rect !== b && overlaps(rect, corridor, 0));
  if (blockers.length) {
    const top = Math.max(4, Math.min(a.y, b.y, ...blockers.map(rect => rect.y)) - 16);
    const bus = right ? Math.max(...obstacles.map(rect => rect.x + rect.width)) + 12 : Math.min(...obstacles.map(rect => rect.x)) - 12;
    const x = right ? b.x + b.width + 8 : b.x - 8, y = bc.y;
    return {path: pixel ? `M${ax} ${ay} H${ax + direction * 28} V${top} H${bus} V${y} H${x}`
      : `M${ax} ${ay} C${ax + direction * 28} ${ay},${ax + direction * 28} ${top},${ax + direction * 64} ${top} H${bus - direction * 8} Q${bus} ${top} ${bus} ${top + 8} V${y - 8} Q${bus} ${y} ${x} ${y}`,
      x, y, angle: right ? Math.PI : 0};
  }
  return {path: pixel ? `M${ax} ${ay} H${(ax + bx) / 2} V${by} H${bx}` : `M${ax} ${ay} C${ax + direction * 28} ${ay},${bx - direction * 28} ${by},${bx} ${by}`,
    x: bx, y: by, angle: right ? 0 : Math.PI};
}
