import type {StoryboardScene} from '../../schemas/storyboard';
import {type DirectionShot, type DirectionBox, type DirectionCrop} from './schema';

export const directionEase = (n: number) => {const p = Math.max(0, Math.min(1, n)); return 1 - (1 - p) ** 3;};
export function directionProgress(scene: StoryboardScene, target: string, action: string, frame: number) {
  const b = scene.beats.find(b => b.target === target && b.action === action);
  return b ? directionEase((frame - b.start) / b.duration) : 0;
}
const full: DirectionCrop = {x: 0, y: 0, width: 1, height: 1};
export function directionPlacement(scene: StoryboardScene, shot: DirectionShot, id: string, frame: number) {
  const element = shot.elements[id]!;
  let box: DirectionBox = {...element}, crop = element.crop ?? full;
  if (shot.id === 'product-showcase') for (const focus of shot.focus.filter(f => f.target === id)) {
    const b = scene.beats.find(b => b.id === focus.trigger)!;
    if (frame < b.start) break;
    const raw = Math.max(0, Math.min(1, (frame - b.start) / b.duration)), p = directionEase(raw);
    const py = directionEase((raw - focus.verticalDelay) / (1 - focus.verticalDelay));
    const mix = (a: number, z: number, t = p) => a + (z - a) * t;
    // Keep the vertical edges on the same timeline so a delayed upward move
    // cannot grow the lower edge into captions before the camera catches up.
    box = {x: mix(box.x, focus.box.x), y: mix(box.y, focus.box.y, py), width: mix(box.width, focus.box.width), height: mix(box.height, focus.box.height, py)};
    crop = {x: mix(crop.x, focus.crop.x), y: mix(crop.y, focus.crop.y), width: mix(crop.width, focus.crop.width), height: mix(crop.height, focus.crop.height)};
  }
  return {...box, crop};
}
export function directionAnchor(box: DirectionBox, side: 'left' | 'right' | 'top' | 'bottom'): [number, number] {
  return side === 'left' ? [box.x, box.y + box.height / 2] : side === 'right' ? [box.x + box.width, box.y + box.height / 2]
    : side === 'top' ? [box.x + box.width / 2, box.y] : [box.x + box.width / 2, box.y + box.height];
}
export function directionInsets(kind: string, box?: DirectionBox) {
  return kind === 'plane' && box ? {x: box.width * .32, y: box.height * .34, width: box.width * .48, height: box.height * .4}
    : kind === 'text' ? {x: 0, y: 0, width: 0, height: 0} : kind === 'gate' ? {x: 20, y: 35, width: 40, height: 60} : {x: 22, y: 22, width: 44, height: 44};
}
