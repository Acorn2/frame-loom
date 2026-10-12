import type {Rect} from '../../layout/scene-layout';
import {sceneRegions} from '../../layout/scene-layout';
import type {WhiteboardShot} from './schema';
export function whiteboardType(shot: WhiteboardShot) {
  return shot.id === 'whiteboard-explain' && shot.slots.items.length === 3
    ? {label: 32, text: 26, inset: 18, lineHeight: 1.35, gap: 12}
    : {label: 44, text: 30, inset: 28, lineHeight: 1.35, gap: 16};
}
export function whiteboardCanvas(width: number, height: number, safeArea: {left: number; right: number; top: number; bottom: number}, contentFirst: boolean) {
  const scale = width / 1920, regions = sceneRegions({width, height, safeArea, captions: true});
  return {width: regions.body.width / scale, height: (contentFirst ? regions.body.height : regions.content.height * .86) / scale, scale};
}
export function whiteboardLayout(shot: WhiteboardShot, width: number, height: number): Map<string, Rect> {
  const rects = new Map<string, Rect>(), count = shot.slots.items.length;
  if (shot.id === 'whiteboard-process') {
    const gap = 80, w = (width - gap * (count - 1) - 32) / count;
    shot.slots.items.forEach((id, i) => rects.set(id, {x: 16 + i * (w + gap), y: height * .18, width: w, height: height * .64}));
  } else if (shot.id === 'whiteboard-compare') {
    const w = (width - 112) / 2;
    shot.slots.items.forEach((id, i) => rects.set(id, {x: 16 + i * (w + 80), y: 18, width: w, height: height - 36}));
  } else {
    rects.set(shot.slots.subject, {x: 16, y: height * .12, width: width * .36, height: height * .76});
    const gap = 28, h = (height - 36 - gap * (count - 1)) / count;
    shot.slots.items.forEach((id, i) => rects.set(id, {x: width * .55, y: 18 + i * (h + gap), width: width * .45 - 16, height: h}));
  }
  return rects;
}
