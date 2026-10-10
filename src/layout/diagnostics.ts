import {containedImage, overlaps, type Rect} from './scene-layout';

export const LAYOUT_LOG_PREFIX = 'FRAME_LOOM_LAYOUT ';
export interface LayoutIssue {severity: 'warning' | 'error'; sceneId: string; frame: number; code: string; message: string}
export interface TextBox {rect: Rect; text: string; group: number; container?: Rect; clipped?: boolean}
export interface ImageBox {rect: Rect; source: {width: number; height: number}; fit: string; focused: boolean}
export interface SceneMeasurement {sceneId: string; frame: number; stable: boolean; content: Rect; texts: TextBox[]; images: ImageBox[]; nodes: Rect[]}

function outside(rect: Rect, area: Rect, tolerance = 3) {
  return rect.x < area.x - tolerance || rect.y < area.y - tolerance
    || rect.x + rect.width > area.x + area.width + tolerance || rect.y + rect.height > area.y + area.height + tolerance;
}

export function analyzeMeasurement(value: SceneMeasurement) {
  const issues: LayoutIssue[] = [];
  const add = (code: string, message: string, hard = false) => issues.push({sceneId: value.sceneId, frame: value.frame, code, message, severity: hard && value.stable ? 'error' : 'warning'});
  for (const text of value.texts) {
    if (text.clipped || outside(text.rect, value.content) || (text.container && outside(text.rect, text.container))) add('text-clipped', `文字超出可读区域：${text.text} (${text.clipped ? '来源遮罩裁切' : '槽位边界'}, x=${Math.round(text.rect.x)}, y=${Math.round(text.rect.y)}, w=${Math.round(text.rect.width)}, h=${Math.round(text.rect.height)})`, true);
  }
  for (let i = 0; i < value.texts.length; i++) for (let j = i + 1; j < value.texts.length; j++) {
    const a = value.texts[i]!, b = value.texts[j]!;
    if (a.group !== b.group && overlaps(a.rect, b.rect, 4)) add('text-overlap', `文字相互遮挡：${a.text} / ${b.text}`, true);
  }
  for (let i = 0; i < value.nodes.length; i++) for (let j = i + 1; j < value.nodes.length; j++) {
    if (overlaps(value.nodes[i]!, value.nodes[j]!, 4)) add('node-overlap', '独立图解节点相互遮挡', true);
  }
  const images = value.images.map(image => {
    const visible = image.fit === 'contain' ? containedImage(image.source, image.rect) : image.rect;
    const areaFraction = visible.width * visible.height / (value.content.width * value.content.height);
    const maximum = containedImage(image.source, value.content);
    const fitUtilization = visible.width * visible.height / (maximum.width * maximum.height);
    if (!image.focused && image.fit === 'cover') add('media-crop', 'cover 会裁切来源图片；须人工核对关键对象与控件是否完整');
    if (!image.focused && image.fit === 'contain' && fitUtilization < .65) add('media-small', `图片实际显示只利用可行展示面积的 ${Math.round(fitUtilization * 100)}%；核对主体与内部文字可读性`);
    return {visible, areaFraction, fitUtilization, source: image.source, focused: image.focused};
  });
  return {sceneId: value.sceneId, frame: value.frame, stable: value.stable, textCount: value.texts.length, nodeCount: value.nodes.length, images, issues};
}
