import type {Shot} from '../../schemas/shot-recipe';
import type {StoryboardScene, StoryboardBeat, StoryboardLayer} from '../../schemas/storyboard';
import {overlaps} from '../../layout/scene-layout';
import {isImageLedShot, type ImageCrop} from './schema';
import {imageCropAt} from './layout';
export function imageLedAllowed(shot: Shot, beat: StoryboardBeat, scene: StoryboardScene): string[] {
  if (!isImageLedShot(shot)) return [];
  if (shot.id === 'annotated-image' && scene.connections.some(c => c.id === beat.target)) return ['draw'];
  const e = shot.elements[beat.target];
  return e ? ['reveal', ...(e.underline ? ['highlight'] : []), ...(e.kind === 'image' && shot.focus.some(f => f.trigger === beat.id) ? ['focus'] : [])] : [];
}
export function validateImageLed(scene: StoryboardScene, shot: Shot, fps: number, get: (id: string) => StoryboardLayer, entry: (id: string) => StoryboardBeat, fail: (message: string) => never) {
  if (!isImageLedShot(shot)) return;
  const keys = [...shot.slots.items].sort().join('|'), end = (b: StoryboardBeat) => b.start + b.duration;
  const validCrop = (c: ImageCrop) => c.x + c.width <= 1.000001 && c.y + c.height <= 1.000001;
  if (!scene.visual?.source?.trim() || scene.visual.representation !== 'diagram' || Object.keys(scene.visual).some(k => !['kind', 'source', 'explanation', 'representation'].includes(k))) fail('图像图解需要原文来源与 diagram，不接受未实现的 visual 字段。');
  if (Object.keys(shot.elements).sort().join('|') !== keys) fail('每个图像或文字须绑定唯一槽位。');
  const title = shot.slots.items[0]!;
  if (shot.elements[title]!.kind !== 'text' || get(title).label !== scene.title || get(title).text) fail('首个文字槽位必须完整显示 scene.title。');
  if (!shot.slots.items.some(id => shot.elements[id]!.kind === 'image')) fail('图像主导配方需要实际图片主体。');
  for (const id of shot.slots.items) {
    const e = shot.elements[id]!, layer = get(id);
    if (e.x + e.width > 1810 || e.y + e.height > 900) fail('图像或文字超出安全内容区域。');
    if (layer.type !== (e.kind === 'image' ? 'object' : 'node') || entry(id).action !== 'reveal') fail('图片使用 object，文字使用 node，均需唯一 reveal。');
    const fields = ['id', 'type', 'label', ...(e.kind === 'image' ? ['asset', 'assetDataUri', 'fit'] : ['text'])];
    if (Object.keys(layer).some(k => !fields.includes(k))) fail('图层不接受隐藏状态或未显示内容。');
    if (e.kind === 'image' ? !layer.asset || (layer.fit && layer.fit !== 'contain') || e.underline : Boolean(e.crop)) fail('源图必须声明本地 asset；取景只适用于图片，下划线只适用于文字。');
    if (e.kind === 'image' && (e.width < 120 || e.height < 120 || e.fontSize !== 40 || e.bodySize !== 30 || e.weight !== 'regular' || e.align !== 'left' || e.color !== 'ink')) fail('图片区域至少120px，文字样式仅用于文字节点，图片说明固定24px。');
    if (e.crop && !validCrop(e.crop)) fail('取景范围必须位于源图内。');
    if (e.underline) {
      const beats = scene.beats.filter(b => b.target === id && b.action === 'highlight');
      if (get(id).label!.includes('\n') || beats.length !== 1 || beats[0]!.start < end(entry(id))) fail('下划线绑定单行正文，落定后唯一 highlight。');
    }
  }
  for (let i = 0; i < shot.slots.items.length; i++) for (const id of shot.slots.items.slice(i + 1)) if (overlaps(shot.elements[shot.slots.items[i]!]!, shot.elements[id]!, 3)) fail('独立图像和文字槽位不能相互遮挡。');
  const used = new Set<string>();
  const lastEnd = new Map<string, number>();
  for (const f of shot.focus) {
    const beat = scene.beats.find(b => b.id === f.trigger);
    if (!beat || beat.target !== f.target || beat.action !== 'focus' || shot.elements[f.target]?.kind !== 'image' || used.has(f.trigger) || beat.start < Math.max(end(entry(f.target)), lastEnd.get(f.target) ?? 0)) fail('取景需要唯一 focus，源图先落定，同图阶段按顺序且不能重叠。');
    if (!validCrop(f.crop)) fail('取景范围必须位于源图内。');
    used.add(f.trigger); lastEnd.set(f.target, end(beat));
  }
  if (scene.beats.some(b => b.state !== undefined || (b.action === 'focus' && !used.has(b.id)))) fail('不接受隐藏 beat.state 或未绑定的取景动作。');
  if (shot.id === 'scene-narrative' && scene.connections.length) fail('情境叙事不接受未实现的关系线。');
  if (shot.id === 'annotated-image') {
    if (Object.keys(shot.annotations).sort().join('|') !== scene.connections.map(c => c.id).sort().join('|')) fail('每个图像批注须绑定实际连接。');
    for (const link of scene.connections) {
      const mark = shot.annotations[link.id]!, draws = scene.beats.filter(b => b.target === link.id && b.action === 'draw');
      if (!shot.elements[link.from] || !shot.elements[link.to] || shot.elements[link.from]!.kind !== 'image' || shot.elements[link.to]!.kind !== 'text' || link.label || draws.length !== 1 || draws[0]!.start < Math.max(end(entry(link.from)), end(entry(link.to)))) fail('批注从源图区域连到可见文字，端点落定后唯一 draw，无隐藏连线文字。');
      if (!validCrop(mark.region)) fail('批注区域超出源图。');
      // Sample every active frame, including moving cameras; a clipped region is never valid.
      for (let frame = draws[0]!.start; frame < scene.durationFrames; frame++) {
        const c = imageCropAt(scene, shot, link.from, frame), r = mark.region;
        if (r.x < c.x || r.y < c.y || r.x + r.width > c.x + c.width + .000001 || r.y + r.height > c.y + c.height + .000001) fail('批注区域在取景阶段被裁切。');
      }
    }
  }
  if (scene.durationFrames / fps > 60) fail('单场图像叙事不超过60秒。');
}
