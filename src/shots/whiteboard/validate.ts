import type {StoryboardScene, StoryboardLayer, StoryboardBeat} from '../../schemas/storyboard';
import type {Shot} from '../../schemas/shot-recipe';
import {isWhiteboardShot} from './schema';
export function whiteboardSlotType(shot: Shot, name: string): string | undefined {
  if (!isWhiteboardShot(shot)) return undefined;
  return name === 'subject' ? 'object' : shot.id === 'whiteboard-compare' ? 'card' : 'node';
}
export function whiteboardAllowed(shot: Shot, beat: StoryboardBeat, scene: StoryboardScene): string[] {
  if (!isWhiteboardShot(shot)) return [];
  if (scene.connections.some(link => link.id === beat.target)) return ['draw'];
  if (shot.id === 'whiteboard-explain' && beat.target === shot.slots.subject) return ['reveal'];
  return shot.slots.items.includes(beat.target) ? ['trace', 'reveal', 'highlight'] : [];
}
export function validateWhiteboard(scene: StoryboardScene, shot: Shot, fps: number,
  get: (id: string) => StoryboardLayer, entry: (id: string) => StoryboardBeat, fail: (message: string) => never) {
  if (!isWhiteboardShot(shot)) return;
  const end = (beat: StoryboardBeat) => beat.start + beat.duration;
  const phase = (id: string, action: string) => {
    const matches = scene.beats.filter(beat => beat.target === id && beat.action === action);
    if (matches.length !== 1) fail(`${id} 需要唯一 ${action} 阶段。`);
    return matches[0]!;
  };
  if (!scene.visual?.source?.trim()) fail('白板解释需要原文来源。');
  const visualFields = ['kind', 'explanation', 'representation', 'source', ...(shot.id === 'whiteboard-explain' ? ['anchorId'] : [])];
  if (Object.keys(scene.visual).some(key => !visualFields.includes(key))) fail('白板不接受未实现的方向、前后状态或聚焦字段。');
  if (scene.visual?.mediaFocus || scene.visual?.changeMode || scene.visual?.unit || scene.visual?.networkDirection) fail('白板不接受未实现的聚焦、状态替换、方向或单位字段。');
  if (shot.id === 'whiteboard-process' && scene.visual?.anchorId) fail('流程不接受主体 anchorId。');
  if (scene.beats.some(beat => beat.state !== undefined)) fail('白板动作不接受隐藏的状态字段。');
  if (shot.id !== 'whiteboard-explain' && scene.visual?.representation !== 'diagram') fail('白板图解必须标记为 diagram。');
  for (const layer of scene.layers) {
    const subject = shot.id === 'whiteboard-explain' && layer.id === shot.slots.subject;
    const allowed = ['id', 'type', 'label', 'text', ...(subject ? ['asset', 'assetDataUri', 'fit'] : [])];
    if (Object.keys(layer).some(key => !allowed.includes(key))) fail('白板构图由配方管理，不接受隐藏内容、坐标或局部样式。');
    if (subject && (!layer.asset?.trim() || layer.text !== undefined || (layer.fit && layer.fit !== 'contain'))) fail('主体需要有来源的本地图片，完整展示；不接受未显示的正文或裁切。');
  }
  const ordered = [...scene.beats].sort((a, b) => a.start - b.start);
  for (let i = 1; i < ordered.length; i++) if (ordered[i]!.start < end(ordered[i - 1]!)) fail('单笔绘制阶段不能重叠；请调整顺序或拆镜头。');
  for (const [index, id] of shot.slots.items.entries()) {
    const trace = phase(id, 'trace'), reveal = entry(id);
    if (reveal.action !== 'reveal' || reveal.start < end(trace)) fail('先画轮廓，再揭示文字。');
    const units = [...`${get(id).label}${get(id).text}`].reduce((total, char) => total + (/\p{Script=Han}/u.test(char) ? 1 : .5), 0);
    if (reveal.duration < Math.ceil((units * .06 + .3) * fps)) fail('文字揭示预算不足，请缩短内容或拆镜头。');
    if (index && trace.start < end(entry(shot.slots.items[index - 1]!)) + Math.ceil(.3 * fps)) fail('逐项解释需要阅读间隔。');
    if (shot.id === 'whiteboard-explain' && trace.start < end(entry(shot.slots.subject)) + Math.ceil(.3 * fps)) fail('先展示主体，再解释。');
  }
  const highlights = scene.beats.filter(beat => beat.action === 'highlight');
  if (highlights.length > 1) fail('每场至多强调一个关键差异。');
  for (const beat of highlights) if (beat.start < end(entry(beat.target)) + Math.ceil(.3 * fps)) fail('文字落定并阅读后再强调。');
  if (shot.id === 'whiteboard-compare') {
    if (scene.connections.length || scene.visual?.anchorId || scene.visual?.networkDirection) fail('对照镜头不添加因果连线。');
  } else {
    const pairs = shot.id === 'whiteboard-process' ? shot.slots.items.slice(1).map((id, i) => [shot.slots.items[i]!, id])
      : shot.slots.items.map(id => [shot.slots.subject, id]);
    if (scene.connections.length !== pairs.length) fail('连接必须精确对应输入顺序或主体解释关系。');
    if (shot.id === 'whiteboard-explain' && scene.visual?.anchorId !== shot.slots.subject) fail('主体解释需要匹配 subject 的 anchorId。');
    for (const [from, to] of pairs) {
      const links = scene.connections.filter(link => link.from === from && link.to === to);
      if (links.length !== 1 || links[0]!.label !== undefined) fail('连接方向或数量错误；关系文字写入可见节点。');
      const draw = phase(links[0]!.id, 'draw');
      if (draw.start < Math.max(end(entry(from!)), end(entry(to!))) + Math.ceil(.3 * fps)) fail('两个对象可读后再画关系。');
    }
  }
}
