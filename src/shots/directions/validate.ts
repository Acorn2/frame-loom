import type {StoryboardScene, StoryboardBeat, StoryboardLayer} from '../../schemas/storyboard';
import type {Shot} from '../../schemas/shot-recipe';
import {isDirectionShot, type DirectionBox, type DirectionCrop} from './schema';
import {directionPlacement} from './layout';
import {overlaps} from '../../layout/scene-layout';

export function directionAllowed(shot: Shot, beat: StoryboardBeat, scene: StoryboardScene) {
  if (!isDirectionShot(shot)) return [];
  if (scene.connections.some(c => c.id === beat.target)) return shot.id === 'mechanism-map' ? ['draw'] : [];
  if (!shot.slots.items.includes(beat.target)) return [];
  return ['reveal', ...(shot.id === 'product-showcase' && shot.focus.some(f => f.trigger === beat.id && f.target === beat.target) ? ['focus'] : []), ...(shot.id === 'mechanism-map' && shot.elements[beat.target]?.kind !== 'text' ? ['highlight'] : [])];
}
export function validateDirection(scene: StoryboardScene, shot: Shot, fps: number, get: (id: string) => StoryboardLayer, entry: (id: string) => StoryboardBeat, fail: (message: string) => never) {
  if (!isDirectionShot(shot)) return;
  const end = (b: StoryboardBeat) => b.start + b.duration;
  const keys = [...shot.slots.items].sort().join('|');
  if (keys !== Object.keys(shot.elements).sort().join('|')) fail('每个内容槽位必须有唯一几何声明。');
  if (!scene.visual?.source?.trim() || Object.keys(scene.visual).some(k => !['kind', 'representation', 'explanation', 'source'].includes(k))) fail('方向配方需要来源，不接受旧 mediaFocus 或隐藏 visual 状态。');
  const first = get(shot.slots.items[0]!);
  if (first.label !== scene.title || first.text || shot.elements[first.id]?.kind !== 'text') fail('第一项必须完整显示 scene.title。');
  const crop = (c: DirectionCrop) => {if (c.x + c.width > 1.000001 || c.y + c.height > 1.000001) fail('取景框超出原始素材。');};
  const box = (b: DirectionBox) => {if (b.x < 120 || b.y < 96 || b.x + b.width > 1800 || b.y + b.height > 850) fail('内容几何超出安全区或进入字幕保留区。');};
  for (const id of shot.slots.items) {
    const layer = get(id), el = shot.elements[id]!;
    if (el.emphasis && (!layer.label?.includes(el.emphasis) || layer.label.indexOf(el.emphasis) !== layer.label.lastIndexOf(el.emphasis))) fail('强调短语必须在对应文字中唯一出现。');
    box(el); if (el.crop) crop(el.crop);
    if (layer.type !== (el.kind === 'media' ? 'screenshot' : 'node')) fail('真实界面使用 screenshot，文字和工程节点使用 node。');
    if (Object.keys(layer).some(k => !['id', 'type', 'label', 'text', ...(el.kind === 'media' ? ['asset', 'assetDataUri', 'fit'] : [])].includes(k))) fail('图层不能夹带位置、状态或未显示字段。');
    if (el.kind === 'media' && (!layer.asset || layer.text || layer.fit === 'cover' || layer.label?.includes('\n') || el.emphasis)) fail('真实界面需要本地图片和单行来源标签，取景由显式 crop 控制。');
    if (el.kind !== 'media' && el.crop) fail('只有真实图片可声明取景框。');
    if ((layer.text?.length ?? 0) > 160 || entry(id).action !== 'reveal') fail('内容过长，或缺少唯一 reveal。');
    const highlights = scene.beats.filter(b => b.target === id && b.action === 'highlight');
    if (highlights.length > 1 || highlights.some(b => b.start < end(entry(id)))) fail('节点只能在落定后执行一次显式强调。');
  }
  if (shot.id === 'mechanism-map') {
    if (scene.visual.representation !== 'diagram' || Object.values(shot.elements).some(e => e.kind === 'media')) fail('机制图解使用原文图解，不混入未实现的媒体。');
    if (Object.keys(shot.routes).sort().join('|') !== scene.connections.map(c => c.id).sort().join('|')) fail('每条线必须绑定明确关系。');
    for (const link of scene.connections) {
      const draws = scene.beats.filter(b => b.target === link.id && b.action === 'draw');
      if (link.label || draws.length !== 1 || draws[0]!.start < Math.max(end(entry(link.from)), end(entry(link.to)))) fail('关系两端落定后才可画线，文字须在可见节点中。');
      if (shot.routes[link.id]!.via.some(([x, y]) => x < 120 || x > 1800 || y < 96 || y > 850)) fail('工程路径超出内容安全区。');
    }
  } else {
    if (scene.visual.representation !== 'source-media' || !Object.values(shot.elements).some(e => e.kind === 'media') || scene.connections.length) fail('产品实演必须展示真实媒体，不接受虚构关系或无图截图路线。');
    const previous = new Map<string, number>(), triggers = new Set<string>();
    for (const focus of shot.focus) {
      const b = scene.beats.find(b => b.id === focus.trigger);
      if (!shot.slots.items.includes(focus.target) || shot.elements[focus.target]?.kind !== 'media' || !b || b.action !== 'focus' || b.target !== focus.target || triggers.has(b.id) || b.start < (previous.get(focus.target) ?? end(entry(focus.target)))) fail('取景需要唯一且顺序执行的媒体 focus。');
      triggers.add(b.id); previous.set(focus.target, end(b)); box(focus.box); crop(focus.crop);
    }
    if (scene.beats.some(b => b.action === 'focus' && !triggers.has(b.id))) fail('focus 必须绑定实现过的取景阶段。');
  }
  // Check every frame with visible, content-bearing boxes, including camera travel.
  const frames = new Set([scene.durationFrames - 1]);
  if (shot.id === 'product-showcase') for (const f of shot.focus) {
    const b = scene.beats.find(b => b.id === f.trigger)!;
    for (let frame = Math.floor(b.start); frame <= end(b); frame++) frames.add(frame);
  }
  for (const frame of frames) {
    const active = shot.slots.items.filter(id => frame >= end(entry(id)) && shot.elements[id]!.kind !== 'plane');
    const bounds = active.map(id => ({id, box: directionPlacement(scene, shot, id, frame)}));
    for (const item of bounds) box(item.box);
    for (let i = 0; i < bounds.length; i++) for (let j = i + 1; j < bounds.length; j++) if (overlaps(bounds[i]!.box, bounds[j]!.box, 4)) fail(`内容在第 ${frame} 帧相互遮挡：${bounds[i]!.id} / ${bounds[j]!.id}。`);
  }
  if (scene.beats.some(b => b.state !== undefined) || scene.durationFrames / fps > 60) fail('不接受隐藏状态；长讲稿请拆镜头。');
}
