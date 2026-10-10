import type {StoryboardScene, StoryboardBeat, StoryboardLayer} from '../../schemas/storyboard';
import type {Shot} from '../../schemas/shot-recipe';
import {isExpansionShot} from './schema';

export function expansionSlotType(shot: Shot, name: string): string | undefined {
  if (!isExpansionShot(shot)) return undefined;
  if (shot.id === 'unit-dot-regroup') return 'metric';
  if (name !== 'items' && name !== 'detail') return 'label';
  return shot.id === 'ai-stream-response' ? 'node' : 'card';
}
export function expansionAllowed(shot: Shot, beat: StoryboardBeat): string[] {
  if (!isExpansionShot(shot)) return [];
  const allowed = ['enter', 'reveal'];
  if (shot.id === 'type-and-filter' && beat.target === shot.selectedId) allowed.push('focus', 'highlight');
  if (shot.id === 'ai-stream-response' && shot.slots.items.includes(beat.target)) allowed.push('set-state');
  if (shot.id === 'unit-dot-regroup' && beat.target === shot.slots.total) allowed.push('focus');
  return allowed;
}
export function validateExpansion(scene: StoryboardScene, shot: Shot, fps: number,
  get: (id: string) => StoryboardLayer, entry: (id: string) => StoryboardBeat, fail: (message: string) => never) {
  if (!isExpansionShot(shot)) return;
  const end = (beat: StoryboardBeat) => beat.start + beat.duration;
  const phase = (id: string, action: string) => {
    const matches = scene.beats.filter(beat => beat.target === id && beat.action === action);
    if (matches.length !== 1) fail(`${id} 需要唯一 ${action} 阶段。`);
    return matches[0]!;
  };
  const hold = Math.ceil(fps * .6);
  if (!scene.visual?.source?.trim()) fail('需要原文来源，示意操作须明确标为 diagram。');
  if (scene.visual?.representation !== 'diagram') fail('本配方是输入驱动的示意图，不模拟未经核实的真实产品界面。');
  if (scene.connections.length) fail('此镜头不呈现额外连线。');
  for (const layer of scene.layers) {
    const allowed = ['id', 'type', 'label', 'text', ...(shot.id === 'unit-dot-regroup' ? ['value'] : shot.id === 'ai-stream-response' && shot.slots.items.includes(layer.id) ? ['state'] : [])];
    if (Object.keys(layer).some(key => !allowed.includes(key))) fail('构图由配方管理，不接受未显示的素材、坐标或局部样式。');
    if (layer.type === 'label' && layer.text !== undefined) fail('短句标签只使用 label，不能隐藏 text。');
  }
  if (shot.id === 'type-and-filter') {
    const query = get(shot.slots.query).label!.trim().toLowerCase();
    const matches = shot.slots.items.filter(id => `${get(id).label} ${get(id).text}`.toLowerCase().includes(query));
    if (matches.length !== 1 || matches[0] !== shot.selectedId) fail('搜索词必须唯一匹配 selectedId，不能捏造筛选结果。');
    const ready = Math.max(...shot.slots.items.map(id => end(entry(id))));
    const typing = entry(shot.slots.query), filter = phase(shot.selectedId, 'focus'), click = phase(shot.selectedId, 'highlight');
    if (typing.start < ready + hold || typing.duration < [...query].length * Math.ceil(fps * .1)) fail('先展示条目再输入；打字至少每字符0.1秒。');
    if (filter.start < end(typing) + hold || click.start < end(filter) + hold || entry(shot.slots.detail).start < end(click)) fail('输入、筛选、点击、详情必须按因果顺序并留阅读窗口。');
    if (shot.slots.items.some(id => entry(id).start !== entry(shot.slots.items[0]!).start)) fail('筛选前条目需同步建立。');
  }
  if (shot.id === 'ai-stream-response') {
    let ready = end(entry(shot.slots.summary)) + hold;
    const completed: number[] = [];
    for (const id of shot.slots.items) {
      const arrive = entry(id), state = phase(id, 'set-state');
      if (get(id).state !== 'upcoming' || state.state !== 'completed') fail('任务行从 upcoming 转为 completed，状态不能暗示未完成的工作。');
      if (arrive.start < ready || state.start < end(arrive) + Math.ceil(fps * .1)) fail('摘要先落定；任务行逐项阅读后再确认完成。');
      ready = end(arrive) + hold;
      completed.push(end(state));
    }
    if (entry(shot.slots.completion).start < Math.max(...completed) + hold) fail('所有任务确认后再显示完成短句。');
  }
  if (shot.id === 'unit-dot-regroup') {
    const values = shot.slots.items.map(id => get(id).value);
    if (!scene.visual?.unit?.trim() || values.some(value => typeof value !== 'number' || !Number.isInteger(value) || value < 0)) fail('点阵要求单位和非负整数，每个点精确代表一个单位。');
    const sum = values.reduce<number>((total, value) => total + Number(value), 0);
    if (sum < 1 || sum > 120 || get(shot.slots.total).value !== sum) fail('分组之和必须等于总数，精确点阵限1–120个单位；大量数据使用其他配方。');
    const ready = Math.max(...shot.slots.items.map(id => end(entry(id))));
    const regroup = phase(shot.slots.total, 'focus');
    if (entry(shot.slots.total).start !== entry(shot.slots.items[0]!).start || shot.slots.items.some(id => entry(id).start !== entry(shot.slots.total).start)) fail('分组标签与总数必须同步建立。');
    if (regroup.start < ready + hold || regroup.duration < 3 * fps) fail('散点阅读后再重组；分组、成柱和汇总各保留至少一秒。');
    if (scene.layers.some(layer => layer.text !== undefined)) fail('点阵只显示 label、value 与单位，不接受未显示的正文。');
  }
}
