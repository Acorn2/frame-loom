import type {StoryboardScene, StoryboardLayer, StoryboardBeat} from '../../schemas/storyboard';
import type {Shot} from '../../schemas/shot-recipe';
import {textSeconds} from './drawing';
export function validateBoard(scene: StoryboardScene, shot: Shot, fps: number, get: (id: string) => StoryboardLayer, entry: (id: string) => StoryboardBeat, fail: (message: string) => never) {
  if (shot.id !== 'whiteboard-board') return;
  if (!scene.visual?.source?.trim() || scene.visual.representation !== 'diagram') fail('开放白板必须有原文来源并声明 diagram。');
  if (Object.keys(scene.visual).some(k => !['kind', 'explanation', 'representation', 'source'].includes(k))) fail('开放白板不接受未实现的 visual 字段。');
  if (JSON.stringify(Object.keys(shot.elements).sort()) !== JSON.stringify([...shot.slots.items].sort())) fail('每个白板元素必须绑定唯一内容槽位。');
  if (JSON.stringify(Object.keys(shot.routes).sort()) !== JSON.stringify(scene.connections.map(c => c.id).sort())) fail('每条白板路径必须绑定显式关系。');
  const end = (b: StoryboardBeat) => b.start + b.duration;
  const ordered = [...scene.beats].sort((a, b) => a.start - b.start);
  for (let i = 1; i < ordered.length; i++) if (ordered[i]!.start < end(ordered[i - 1]!)) fail('开放白板只有一支笔，书写阶段不能重叠。');
  for (const id of shot.slots.items) {
    const layer = get(id), e = shot.elements[id]!, beat = entry(id), image = e.kind === 'sticker';
    const allowed = ['id', 'type', 'label', ...(image ? ['asset', 'assetDataUri', 'fit'] : ['text'])];
    if (Object.keys(layer).some(k => !allowed.includes(k))) fail('白板位置和媒介只能在受控 elements 中声明，不接受隐藏字段。');
    if (layer.type !== (image ? 'object' : 'node')) fail('贴纸使用 object，其余白板内容使用 node。');
    if (image && (!layer.asset || (layer.fit && layer.fit !== 'contain'))) fail('白板贴纸需要完整本地来源图片。');
    if (e.x < 56 || e.y < 56 || e.x + e.width > 1864 || e.y + e.height > 915) fail('白板元素超出内容安全区或进入字幕区。');
    if (e.x + e.width > 1600 && e.y < 150) fail('白板右上品牌预留区不能放正文。');
    if (beat.action !== 'reveal') fail('白板元素需要唯一 reveal 阶段。');
    const shape = !['text', 'sticker'].includes(e.kind), size = image ? e.labelSize : e.fontSize;
    const natural = textSeconds(`${layer.label}${layer.text ? `\n${layer.text}` : ''}`, size);
    if (beat.duration / fps < (image ? .8 + natural : shape ? .35 + natural : natural) * .65) fail('白板自然书写预算不足，请缩短或拆镜头。');
  }
  const title = get(shot.slots.items[0]!);
  if (shot.elements[title.id]?.kind !== 'text' || title.label !== scene.title || title.text) fail('第一个元素必须完整书写 scene.title。');
  for (const link of scene.connections) {
    if (shot.routes[link.id]!.points.some(([x, y]) => x < 56 || x > 1864 || y < 56 || y > 915 || (x > 1600 && y < 150))) fail('白板关系路径超出安全区。');
    if (link.label) fail('关系文字应写入可见白板节点。');
    const beats = scene.beats.filter(b => b.target === link.id);
    if (beats.length !== 1 || beats[0]!.action !== 'draw' || beats[0]!.start < Math.max(end(entry(link.from)), entry(link.to).start - fps * 2)) fail('箭头需在来源出现后指向紧接着讲解的目标。');
    if (beats[0]!.start > entry(link.to).start && beats[0]!.start < end(entry(link.to))) fail('画箭头不能打断目标书写。');
  }
  if (scene.beats.some(b => b.state !== undefined)) fail('白板不接受隐藏状态。');
}
