import {memberRadius} from './layout';
import type {StoryboardScene, StoryboardBeat, StoryboardLayer} from '../../schemas/storyboard';
import type {Shot} from '../../schemas/shot-recipe';
import {isP2Shot} from './schema';
export function p2SlotType(shot: Shot): string | undefined {
  if (shot.id === 'chart-live' || shot.id === 'particle-sand-fill') return 'metric';
  if (shot.id === 'media-before-after') return 'screenshot';
  if (shot.id === 'letterspace-materialize') return 'label';
  return undefined;
}
export function p2Allowed(shot: Shot, beat: StoryboardBeat, scene: StoryboardScene): string[] {
  if (!isP2Shot(shot)) return [];
  const result = ['enter', 'reveal'];
  const refs = Object.values(shot.slots).flat();
  if (refs.includes(beat.target)) result.push('focus');
  if (scene.connections.some(c => c.id === beat.target)) result.push('draw');
  if (shot.id === 'particle-sand-fill' && shot.slots.items.includes(beat.target)) result.push('count');
  if (shot.effects?.some(e => e.target === beat.target) || shot.id === 'member-grid' && shot.flagged.includes(beat.target)) result.push('highlight');
  return result;
}
export function validateP2(scene: StoryboardScene, shot: Shot, fps: number, get: (id: string) => StoryboardLayer, entry: (id: string) => StoryboardBeat, fail: (message: string) => never) {
  if (!isP2Shot(shot)) return;
  const end = (b: StoryboardBeat) => b.start + b.duration;
  const phase = (target: string, action: string) => {
    const found = scene.beats.filter(b => b.target === target && b.action === action);
    if (found.length !== 1) fail(`${target} 需要唯一 ${action} 阶段`);
    return found[0]!;
  };
  if (!scene.visual?.source?.trim()) fail('需要真实内容来源');
  if (scene.layers.some(l => l.color || l.x !== undefined || l.y !== undefined || l.rotate || l.rotationDegrees || l.visibleFrom !== undefined || l.visibleUntil !== undefined)) fail('P2 构图由配方管理，不接受被忽略的坐标、局部配色或隐藏内容');
  if (!['integration-hub', 'ring-annotation', 'cycle-mechanism'].includes(shot.id) && scene.connections.length) fail('此镜头不接受未呈现的关系');
  for (const b of scene.beats) {
    if (b.action === 'focus') {
      const target = shot.id === 'integration-hub' ? shot.slots.before : shot.id === 'scroll-brake' ? shot.focusId : shot.id === 'chart-live' ? shot.slots.series : shot.id === 'ring-annotation' || shot.id === 'cycle-mechanism' ? shot.slots.subject : shot.id === 'media-before-after' ? shot.slots.after : undefined;
      if (b.target !== target) fail('此配方不执行额外 focus');
    }
  }
  if (shot.id === 'research-stack') {
    if (Object.keys(shot.authors).length !== shot.slots.items.length || shot.slots.items.some(id => !shot.authors[id])) fail('每份资料必须有输入作者；不能编造文献集合');
    shot.slots.items.forEach((id, i) => {if (i && entry(id).start < end(entry(shot.slots.items[i - 1]!)) + fps) fail('焦点资料需要至少一秒阅读后才换下一份');});
  }
  if (shot.id === 'list-stack-press') shot.slots.items.forEach((id, i) => {if (i && entry(id).start < end(entry(shot.slots.items[i - 1]!)) + Math.ceil(.4 * fps)) fail('压弹落定后再新增条目');});
  if (shot.id === 'integration-hub' || shot.id === 'ring-annotation' || shot.id === 'cycle-mechanism') {
    const subject = shot.id === 'integration-hub' ? shot.slots.before : shot.slots.subject;
    const focus = phase(subject, 'focus');
    if (focus.start < end(entry(subject)) + Math.ceil(.6 * fps)) fail('主体先站稳，再发生结构变化');
    const targets = shot.slots.items;
    if (targets.some(id => entry(id).start < end(focus))) fail('主体收缩/翻面后才建立节点');
    if (shot.id === 'integration-hub') {
      if (entry(shot.slots.hub).start !== end(focus) || targets.some(id => entry(id).start !== entry(targets[0]!).start)) fail('中枢与节点同阶段出现，节点必须同步入场');
      if (scene.visual?.beforeId !== shot.slots.before || scene.visual.afterId !== shot.slots.hub) fail('旧/新结构绑定不一致');
    }
    if (scene.connections.length !== targets.length) fail('每个节点需要恰好一条输入关系');
    targets.forEach((id, i) => {
      const to = shot.id === 'integration-hub' ? shot.slots.hub : shot.id === 'ring-annotation' ? shot.slots.subject : targets[(i + 1) % targets.length]!;
      const links = scene.connections.filter(c => c.from === id && c.to === to);
      if (links.length !== 1 || links[0]!.label) fail('关系必须与输入结构一致，不能丢失或隐藏连接文字');
      const draw = phase(links[0]!.id, 'draw');
      const ready = Math.max(...targets.map(id => end(entry(id))));
      if (draw.start < ready + (shot.id === 'integration-hub' ? Math.ceil(fps / 3) : 0)) fail('真实节点落定后再描画关系');
      if (shot.id === 'integration-hub' && i && draw.start !== phase(scene.connections[0]!.id, 'draw').start) fail('中枢路径必须同步绘制');
    });
  }
  if (shot.id === 'scroll-brake') {
    if (!shot.slots.items.includes(shot.focusId)) fail('重点项必须来自现有真实列表');
    const focus = phase(shot.focusId, 'focus');
    if (focus.start < Math.max(...shot.slots.items.map(id => end(entry(id))))) fail('列表建立后才滚动定位');
  }
  if (shot.id === 'chart-live') {
    if (!scene.visual?.unit || Number(get(shot.slots.series).value) !== shot.samples.at(-1)!.value || new Set(shot.samples.map(s => s.label)).size !== shot.samples.length) fail('曲线需要单位、唯一采样标签，最终读数必须等于输入末值');
    if (Math.max(...shot.samples.map(s => s.value)) <= 0) fail('曲线需有效的非零量程');
    if (phase(shot.slots.series, 'focus').start < end(entry(shot.slots.series))) fail('曲线载体落定后才写入');
  }
  if (shot.id === 'particle-sand-fill') {
    const values = shot.slots.items.map(id => Number(get(id).value));
    if (!scene.visual?.unit || values.some(v => !Number.isFinite(v) || v < 0 || v > 1e9) || shot.slots.items.some(id => get(id).value === undefined || !String(get(id).value).trim()) || Math.max(...values) <= 0 || Math.max(...values) / shot.grainUnit > 80) fail('粒子柱需要真实非负数、单位和合理 grainUnit（每柱最多80粒）');
    for (const id of shot.slots.items) if (phase(id, 'count').start < end(entry(id))) fail('柱轴落定后才填充');
  }
  if (shot.id === 'member-grid') {
    if (new Set(shot.flagged).size !== shot.flagged.length || shot.flagged.some(id => !shot.slots.items.includes(id))) fail('标记成员必须来自真实集合，不能随机制造比例');
    const ready = Math.max(...shot.slots.items.map(id => end(entry(id))));
    shot.slots.items.forEach((id,i)=>shot.slots.items.forEach((other,j)=> {if(memberRadius(i,shot.slots.items.length)<memberRadius(j,shot.slots.items.length) && entry(id).start>entry(other).start) fail('成员网格必须从中心向外分环建立');}));
    for (const id of shot.flagged) if (phase(id, 'highlight').start < ready) fail('网格建立后才标记成员');
  }
  if (shot.id === 'media-before-after') {
    const a = get(shot.slots.before), b = get(shot.slots.after);
    if (!a.asset || !b.asset || a.asset === b.asset || a.fit && a.fit !== 'contain' || b.fit && b.fit !== 'contain' || !a.width || !a.height || a.width !== b.width || a.height !== b.height || scene.visual?.beforeId !== a.id || scene.visual.afterId !== b.id || scene.visual.representation !== 'source-media') fail('前后对照需要两份不同素材、同尺寸与同视角，且绑定真实 before/after');
    if (phase(b.id, 'focus').start < Math.max(end(entry(a.id)), end(entry(b.id))) + Math.ceil(.6 * fps)) fail('对照载体落定后再滑动');
  }
  if (shot.id === 'document-write') {
    shot.slots.blocks.forEach((id, i) => {if (i && entry(id).start < end(entry(shot.slots.blocks[i - 1]!))) fail('文档按源段落顺序书写，不同时制造多个光标');});
  }
  if (shot.id === 'code-reveal') {
    const text = get(shot.slots.code).text!;
    if (shot.tokens.map(t => t.text).join('') !== text || text.split('\n').length > 12 || text.split('\n').some(line => [...line].length > 70)) fail('代码 token 必须逐字符保留原文、缩进与换行；最多12行，每行70字符');
  }
  if (shot.id === 'letterspace-materialize' && (shot.glyphs.map(g => g.character).join('') !== get(shot.slots.title).label || get(shot.slots.title).label !== scene.title)) fail('字形路径须逐个对应输入标题；不接受固定品牌字形代替任意文字');
  const hosts: Record<string, string> = {'scanline-annotate-focus': 'document-write', 'scan-bracket-sweep': 'document-write', 'line-boil': 'ring-annotation', 'speed-ramp-freeze': 'scroll-brake', 'mosaic-reframe': 'member-grid'};
  for (const effect of shot.effects ?? []) {
    if (hosts[effect.id] !== shot.id) fail('辅助效果仅限指定宿主');
    const refs = Object.values(shot.slots).flat();
    if (!refs.includes(effect.target)) fail('效果目标必须为宿主真实槽位');
    const window = phase(effect.target, 'highlight');
    const ready = Math.max(...refs.map(id => end(entry(id))), ...scene.beats.filter(b => ['draw', 'count'].includes(b.action)).map(end));
    if (window.start < ready) fail('效果开始前正文与结构必须完全建立');
    if (effect.id === 'line-boil' && shot.id === 'ring-annotation' && effect.target !== shot.slots.subject) fail('微颤只允许主体环轮廓');
    if (effect.id === 'speed-ramp-freeze' && shot.id === 'scroll-brake') {
      const focus = phase(shot.focusId, 'focus');
      if (effect.target !== shot.focusId || window.start <= focus.start || end(window) >= end(focus) || window.duration < fps * .6) fail('冻结必须位于滚动阶段内部并保留前后运动和阅读窗口');
    } else if (window.start < Math.max(ready, ...scene.beats.filter(b => b.action === 'focus').map(end))) fail('结构变化结束后再执行辅助效果');
    if (effect.id === 'mosaic-reframe' && shot.id === 'member-grid' && shot.slots.items.length > 7) fail('总览转重点最多7个成员，更多内容应拆镜头');
    if (effect.id === 'mosaic-reframe' && shot.id === 'member-grid' && window.start < Math.max(ready, ...shot.flagged.map(id => end(phase(id, 'highlight'))))) fail('成员标记完成后才重排');
  }
  for (const b of scene.beats.filter(b => b.action === 'highlight')) if (!shot.effects?.some(e => e.target === b.target) && !(shot.id === 'member-grid' && shot.flagged.includes(b.target))) fail('不接受未声明的高亮动作');
}
