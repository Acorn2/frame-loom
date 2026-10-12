import type {StoryboardScene, StoryboardLayer, StoryboardBeat} from '../../schemas/storyboard';
import type {Shot} from '../../schemas/shot-recipe';
import {isIllustratedShot} from './schema';
export function illustratedSlotType(shot: Shot, name: string): string | string[] | undefined {
  if (!isIllustratedShot(shot)) return undefined;
  if (name === 'subject') return 'object';
  if (['illustrated-compare', 'illustrated-process', 'illustrated-breakdown'].includes(shot.id)) return ['object', 'node'];
  return shot.id === 'illustrated-metric' ? 'metric' : 'node';
}
export function illustratedAllowed(shot: Shot, beat: StoryboardBeat, scene: StoryboardScene): string[] {
  if (!isIllustratedShot(shot)) return [];
  if (scene.connections.some(link => link.id === beat.target)) return ['draw'];
  if (shot.id === 'illustrated-metric' && shot.slots.items.includes(beat.target)) return ['reveal', 'count', 'highlight'];
  return scene.layers.some(layer => layer.id === beat.target) ? ['reveal', 'highlight'] : [];
}
export function validateIllustrated(scene: StoryboardScene, shot: Shot, fps: number,
  get: (id: string) => StoryboardLayer, entry: (id: string) => StoryboardBeat, fail: (message: string) => never) {
  if (!isIllustratedShot(shot)) return;
  if (!scene.visual?.source?.trim()) fail('插画讲解需要原文来源；数字不得从插画推断。');
  const end = (beat: StoryboardBeat) => beat.start + beat.duration;
  const subject = 'subject' in shot.slots ? shot.slots.subject : undefined;
  const network = ['illustrated-explain', 'illustrated-breakdown'].includes(shot.id), process = shot.id === 'illustrated-process';
  const visualFields = ['kind', 'explanation', 'representation', 'source', ...(network ? ['anchorId'] : []), ...(shot.id === 'illustrated-metric' ? ['unit'] : [])];
  if (Object.keys(scene.visual).some(key => !visualFields.includes(key))) fail('插画配方不接受未实现的 visual 字段。');
  if (network && scene.visual.anchorId !== subject) fail('主体讲解与组成拆解需要匹配 subject 的 anchorId。');
  for (const layer of scene.layers) {
    const allowed = ['id', 'type', 'label', ...(layer.type === 'object' ? ['asset', 'assetDataUri', 'fit', ...(layer.id !== subject ? ['text'] : [])] : layer.type === 'metric' ? ['value'] : ['text', ...(['illustrated-compare', 'illustrated-process', 'illustrated-breakdown'].includes(shot.id) ? ['glyph'] : [])])];
    if (Object.keys(layer).some(key => !allowed.includes(key))) fail('插画构图由配方管理，不接受隐藏内容、坐标或局部样式。');
    if (layer.type === 'object' && (!layer.asset?.trim() || (layer.fit && layer.fit !== 'contain'))) fail('插画/截图需要本地来源，完整展示；不接受裁切。');
    if (layer.type === 'node' && ['illustrated-compare', 'illustrated-process', 'illustrated-breakdown'].includes(shot.id) && !layer.glyph) fail('原生图解主体必须显式选择 glyph；图片主体则使用 object。');
    if (layer.type === 'metric' && (typeof layer.value !== 'number' || !Number.isFinite(layer.value) || layer.value < 0 || !scene.visual.unit?.trim())) fail('数字需要非负有限 value 与可见 unit。');
  }
  const pairs = process ? shot.slots.items.slice(0, -1).map((id, i) => [id, shot.slots.items[i + 1]!])
    : network ? shot.slots.items.map(id => [subject!, id]) : [];
  if (scene.connections.length !== pairs.length) fail('连线必须与显式流程/组成关系一一对应。');
  for (const [from, to] of pairs) {
    const matches = scene.connections.filter(link => link.from === from && link.to === to);
    if (matches.length !== 1 || matches[0]!.label) fail('关系方向错误或带未实现的连线标签。');
    const draws = scene.beats.filter(beat => beat.target === matches[0]!.id && beat.action === 'draw');
    if (draws.length !== 1 || draws[0]!.start < Math.max(end(entry(from!)), end(entry(to!)))) fail('两端素材与文字落定后才能描画关系。');
  }
  if (subject && shot.id !== 'illustrated-hero' && shot.slots.items.some(id => entry(id).start < end(entry(subject)) + Math.ceil(.3 * fps))) fail('先展示主体，再逐项解释。');
  if (process) shot.slots.items.forEach((id, i) => {if (i && entry(id).start < end(entry(shot.slots.items[i - 1]!))) fail('流程按顺序揭示主体。');});
  for (const beat of scene.beats) {
    if (beat.state !== undefined) fail('插画动作不接受隐藏状态。');
    if (beat.action === 'highlight' && beat.start < end(entry(beat.target))) fail('主体落定后才能强调。');
  }
  if (shot.id === 'illustrated-metric') for (const id of shot.slots.items) {
    const layer = get(id), counts = scene.beats.filter(beat => beat.target === id && beat.action === 'count');
    if (counts.length !== 1 || counts[0]!.start < end(entry(id))) fail('数字揭示后需要唯一 count 阶段。');
    if (typeof layer.value !== 'number') fail('数字必须是 number。');
  }
}
