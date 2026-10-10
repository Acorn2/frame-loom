import type {StoryboardScene} from '../schemas/storyboard';

// Versioned, opt-in composition: old storyboards keep their original geometry.
export const CONTENT_LAYOUT = 'content-first-v1' as const;
export type LayoutPolicy = typeof CONTENT_LAYOUT;
export interface Rect {x: number; y: number; width: number; height: number}
export interface SceneRegions {content: Rect; title: Rect; body: Rect; claim: Rect; captionReserve: number; titleMax: number; composition: string}

export function sceneRegions({width, height, safeArea, captions, media = false, ownTitle = false}: {
  width: number; height: number; safeArea: {left: number; right: number; top: number; bottom: number};
  captions: boolean; media?: boolean; ownTitle?: boolean;
}): SceneRegions {
  const portrait = width < height;
  const scale = width / (portrait ? 1080 : 1920);
  const captionReserve = captions ? (portrait ? 170 : 125) * scale : 0;
  const w = width - safeArea.left - safeArea.right;
  const h = height - safeArea.top - safeArea.bottom - captionReserve;
  const content = {x: safeArea.left, y: safeArea.top, width: w, height: h};
  const gap = 24 * scale;
  const titleHeight = (portrait ? 140 : 100) * scale;
  const claimHeight = (portrait ? 85 : 64) * scale;
  const side = media && !portrait;
  const title = side ? {x: 0, y: h * .16, width: w * .27, height: h * .42} : {x: 0, y: 0, width: w, height: titleHeight};
  const claim = side ? {x: 0, y: h * .68, width: title.width, height: h * .25} : {x: 0, y: h - claimHeight, width: w, height: claimHeight};
  const body = ownTitle ? {x: 0, y: 0, width: w, height: h}
    : side ? {x: w * .30, y: 0, width: w * .70, height: h}
      : {x: 0, y: titleHeight + gap, width: w, height: h - titleHeight - claimHeight - gap * 2};
  return {content, title, body, claim, captionReserve, titleMax: (portrait ? 64 : side ? 64 : 62) * scale,
    composition: ownTitle ? 'own-title' : side ? 'media-side' : 'explanation'};
}

export function networkRects(count: number, width: number, height: number, scale: number, inward = false): {anchor: Rect; branches: Rect[]} {
  const gap = 20 * scale;
  const rowHeight = (height - gap * Math.max(0, count - 1)) / Math.max(1, count);
  const anchor = {x: inward ? width * .66 : 0, y: height * .24, width: width * .34, height: height * .52};
  const branches = Array.from({length: count}, (_, i) => ({x: inward ? 0 : width * .46, y: i * (rowHeight + gap), width: width * .54, height: rowHeight}));
  return {anchor, branches};
}

export function containedImage(source: {width: number; height: number}, box: Rect): Rect {
  const ratio = Math.min(box.width / source.width, box.height / source.height);
  const width = source.width * ratio, height = source.height * ratio;
  return {x: box.x + (box.width - width) / 2, y: box.y + (box.height - height) / 2, width, height};
}

export function overlaps(a: Rect, b: Rect, tolerance = 2): boolean {
  return Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > tolerance
    && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > tolerance;
}

export function layoutSignature(scene: StoryboardScene): string {
  const native = ['semantic-default', 'compare-reveal', 'network-expand'].includes(scene.shot?.id ?? '');
  const centeredTitle = ['blur-slide', 'split-text-stagger', 'brace-expand', 'lead-word-assemble'].includes(scene.shot?.id ?? '');
  return native ? `semantic/${scene.visual?.kind}/${scene.visual?.networkDirection ?? 'outward'}` : centeredTitle ? 'title/center' : scene.shot?.id ?? scene.template;
}
