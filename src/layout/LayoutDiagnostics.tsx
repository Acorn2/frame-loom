import {useEffect} from 'react';
import {continueRender, delayRender, cancelRender, useCurrentFrame} from 'remotion';
import type {Storyboard} from '../schemas/storyboard';
import {compileStoryboardShots} from '../shots/compile-shot';
import {getSceneTimeline} from '../timeline/scene-timeline';
import {sceneRegions, type Rect} from './scene-layout';
import {analyzeMeasurement, LAYOUT_LOG_PREFIX, type TextBox} from './diagnostics';
import type {StyleTokens} from '../styles/style-loader';

function visible(element: Element, root: Element) {
  for (let current: Element | null = element; current; current = current.parentElement) {
    const style = getComputedStyle(current);
    if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) < .08) return false;
    if (current === root) break;
  }
  return true;
}

function clippedRect(value: Rect, element: Element, root: Element, rect: (r: DOMRect) => Rect) {
  const result = {...value};
  for (let current: Element | null = element; current; current = current.parentElement) {
    const style = getComputedStyle(current), bounds = rect(current.getBoundingClientRect());
    if (['hidden', 'clip', 'scroll', 'auto'].includes(style.overflowX)) {
      const right = Math.min(result.x + result.width, bounds.x + bounds.width);
      result.x = Math.max(result.x, bounds.x); result.width = right - result.x;
    }
    if (['hidden', 'clip', 'scroll', 'auto'].includes(style.overflowY)) {
      const bottom = Math.min(result.y + result.height, bounds.y + bounds.height);
      result.y = Math.max(result.y, bounds.y); result.height = bottom - result.y;
    }
    if (current === root) break;
  }
  return result;
}

// Runs inside the same Chromium frame as the video, after font/image loading.
export function LayoutDiagnostics({board, tokens, frames, captions}: {board: Storyboard; tokens: StyleTokens; frames: number[]; captions: boolean}) {
  const frame = useCurrentFrame();
  useEffect(() => {
    if (!frames.includes(frame)) return;
    const handle = delayRender('Measure actual scene layout');
    let cancelled = false;
    const measure = async () => {
      await document.fonts.ready;
      await Promise.all(Array.from(document.querySelectorAll<HTMLImageElement>('[data-layout-scene] img')).map(image => image.decode()));
      // Other recipes measure words/images after font loading and update React
      // state. Wait for that commit and its layout, rather than reading the
      // initial zero-width slot while the render is still delayed.
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      if (cancelled) return;
      const timeline = getSceneTimeline(board), plans = compileStoryboardShots(board);
      const checks = Array.from(document.querySelectorAll<HTMLElement>('[data-layout-scene]')).map(root => {
        const index = timeline.findIndex(item => item.scene.id === root.dataset.layoutScene);
        const item = timeline[index]!, plan = plans[index]!;
        const localFrame = frame - item.startFrame;
        const stable = localFrame >= Math.max(plan.completeFrame, item.overlapInFrames) && localFrame <= plan.stableEndFrame;
        const bounds = root.getBoundingClientRect();
        const sx = bounds.width / board.project.width, sy = bounds.height / board.project.height;
        const rect = (r: DOMRect): Rect => ({x: (r.x - bounds.x) / sx, y: (r.y - bounds.y) / sy, width: r.width / sx, height: r.height / sy});
        const content = sceneRegions({width: board.project.width, height: board.project.height, safeArea: tokens.safeArea, captions: captions || item.scene.captions.length > 0}).content;
        const texts: TextBox[] = [];
        const context = document.createElement('canvas').getContext('2d')!;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node: Node | null; let group = 0;
        const textGroups = new Map<Element, number>();
        while ((node = walker.nextNode())) {
          const parent = node.parentElement, text = node.textContent?.trim();
          if (!parent || !text || parent.closest('svg,[data-layout-caption],[aria-hidden="true"]') || !visible(parent, root)) continue;
          // Word spans form one text block. A rotated heading's neighboring
          // words have overlapping axis-aligned bounds without colliding ink.
          const block = parent.closest('[data-layout-text-group]');
          if (block && !textGroups.has(block)) textGroups.set(block, group++);
          const textGroup = block ? textGroups.get(block)! : group++;
          const range = document.createRange(); range.selectNodeContents(node);
          const fontStyle = getComputedStyle(parent);
          context.font = `${fontStyle.fontStyle} ${fontStyle.fontWeight} ${fontStyle.fontSize} ${fontStyle.fontFamily}`;
          const metrics = context.measureText(text);
          const slot = parent.closest('[data-layout-node],[data-layout-title],[data-layout-claim],[data-layout-body]');
          const container = slot ? rect(slot.getBoundingClientRect()) : undefined;
          for (const r of Array.from(range.getClientRects())) {
            const raw = rect(r);
            // Range includes unused font ascent/descent. Test visible glyph ink,
            // otherwise Chinese fonts falsely fail inside legitimate reel masks.
            const fontHeight = metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent;
            if (fontHeight > 0) {
              const ratio = raw.height / fontHeight;
              raw.y += (metrics.fontBoundingBoxAscent - metrics.actualBoundingBoxAscent) * ratio;
              raw.height = (metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent) * ratio;
            }
            const painted = clippedRect(raw, parent, root, rect);
            if (painted.width > 1 && painted.height > 1) texts.push({rect: painted, text: text.slice(0, 100), group: textGroup, container,
              clipped: raw.width - painted.width > 3 || raw.height - painted.height > 3});
          }
        }
        const images = Array.from(root.querySelectorAll<HTMLImageElement>('img')).filter(image => visible(image, root)).map(image => ({rect: rect(image.getBoundingClientRect()), source: {width: image.naturalWidth, height: image.naturalHeight}, fit: getComputedStyle(image).objectFit, focused: Boolean(item.scene.visual?.mediaFocus)}));
        const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-layout-node]')).filter(node => visible(node, root)).map(node => rect(node.getBoundingClientRect()));
        return analyzeMeasurement({sceneId: item.scene.id, frame, stable, content, texts, images, nodes});
      });
      console.debug(`${LAYOUT_LOG_PREFIX}${JSON.stringify({frame, checks})}`);
    };
    measure().then(() => continueRender(handle)).catch(error => cancelRender(error));
    return () => {cancelled = true; continueRender(handle);};
  }, [board, tokens, frames, frame, captions]);
  return null;
}
