import type {StoryboardScene} from '../../schemas/storyboard';
import type {ImageCrop, ImageLedShot} from './schema';
export const fullCrop: ImageCrop = {x: 0, y: 0, width: 1, height: 1};
export const imageEase = (n: number) => {const p = Math.max(0, Math.min(1, n)); return 1 - (1 - p) ** 3;};
export function imageProgress(scene: StoryboardScene, target: string, action: string, frame: number) {
  const b = scene.beats.find(b => b.target === target && b.action === action);
  return b ? imageEase((frame - b.start) / b.duration) : 0;
}
export function imageCropAt(scene: StoryboardScene, shot: ImageLedShot, id: string, frame: number): ImageCrop {
  let crop = shot.elements[id]!.crop ?? fullCrop;
  for (const focus of shot.focus.filter(f => f.target === id)) {
    const beat = scene.beats.find(b => b.id === focus.trigger)!;
    if (frame < beat.start) break;
    const p = imageEase((frame - beat.start) / beat.duration), mix = (a: number, b: number) => a + (b - a) * p;
    crop = {x: mix(crop.x, focus.crop.x), y: mix(crop.y, focus.crop.y), width: mix(crop.width, focus.crop.width), height: mix(crop.height, focus.crop.height)};
  }
  return crop;
}
// A single source-to-canvas transform drives pixels, region marks and leaders.
export function imageProjection(size: {width: number; height: number}, box: {x: number; y: number; width: number; height: number}, crop: ImageCrop) {
  const scale = Math.min(box.width / (size.width * crop.width), box.height / (size.height * crop.height));
  const width = size.width * scale, height = size.height * scale;
  const x = box.x + (box.width - crop.width * width) / 2 - crop.x * width;
  const y = box.y + (box.height - crop.height * height) / 2 - crop.y * height;
  return {x, y, width, height};
}
export function projectedRegion(projection: {x: number; y: number; width: number; height: number}, region: ImageCrop) {
  return {x: projection.x + region.x * projection.width, y: projection.y + region.y * projection.height, width: region.width * projection.width, height: region.height * projection.height};
}
export function imageFrame(size: {width: number; height: number}, viewport: {x: number; y: number; width: number; height: number}, crop: ImageCrop) {
  const projection = imageProjection(size, viewport, crop);
  // Contain the selected source rectangle and clip there, rather than exposing
  // neighboring source pixels in the viewport's letterbox space.
  return {projection, clip: projectedRegion(projection, crop)};
}
export function imageAnchor(box: {x: number; y: number; width: number; height: number}, side: 'left' | 'right' | 'top' | 'bottom'): [number, number] {
  return side === 'left' ? [box.x, box.y + box.height / 2] : side === 'right' ? [box.x + box.width, box.y + box.height / 2] : side === 'top' ? [box.x + box.width / 2, box.y] : [box.x + box.width / 2, box.y + box.height];
}
