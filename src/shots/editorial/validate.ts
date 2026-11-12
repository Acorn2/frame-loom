import type {StoryboardScene, StoryboardBeat, StoryboardLayer} from '../../schemas/storyboard';
import type {Shot} from '../../schemas/shot-recipe';
import {isEditorialShot} from './schema';
import {editorialChartLayout} from './layout';
import {overlaps} from '../../layout/scene-layout';

export function editorialAllowed(shot: Shot, beat: StoryboardBeat) {
  if (!isEditorialShot(shot)) return [];
  if (shot.slots.metrics.includes(beat.target)) return ['reveal'];
  const e = shot.elements[beat.target];
  return e ? ['reveal', ...(e.underline ? ['highlight'] : []), ...(shot.charts[beat.target]?.rescale?.trigger === beat.id ? ['focus'] : [])] : [];
}
export function validateEditorial(scene: StoryboardScene, shot: Shot, fps: number, get: (id: string) => StoryboardLayer, entry: (id: string) => StoryboardBeat, fail: (message: string) => never) {
  if (!isEditorialShot(shot)) return;
  const end = (b: StoryboardBeat) => b.start + b.duration;
  if (!scene.visual?.source?.trim() || scene.visual.representation !== 'diagram' || Object.keys(scene.visual).some(k => !['kind', 'representation', 'explanation', 'source'].includes(k)) || scene.connections.length) fail('编辑讲解需要来源明确的文字或图表，不接受隐藏 visual 状态或关系线。');
  if (Object.keys(shot.elements).sort().join('|') !== [...shot.slots.items].sort().join('|')) fail('每个编辑内容槽位必须有唯一几何声明。');
  const first = get(shot.slots.items[0]!);
  if (first.label !== scene.title || first.text || shot.elements[first.id]!.kind !== 'text') fail('第一项必须完整显示 scene.title。');
  const box = (b: {x: number; y: number; width: number; height: number}) => {if (b.x < 120 || b.y < 100 || b.x + b.width > 1800 || b.y + b.height > 850) fail('编辑内容超出安全区或进入字幕保留区。');};
  for (const id of shot.slots.items) {
    const layer = get(id), e = shot.elements[id]!;
    box(e);
    if (layer.type !== 'node' || Object.keys(layer).some(k => !['id', 'type', 'label', 'text'].includes(k)) || entry(id).action !== 'reveal') fail('编辑内容使用 node 和唯一 reveal，不接受隐藏字段。');
    if ((layer.text?.length ?? 0) > 180) fail('正文过长，请拆镜头。');
    if ((e.kind === 'chart') !== Boolean(shot.charts[id])) fail('图表必须绑定实际图表声明，文字不能夹带图表。');
    const highlights = scene.beats.filter(b => b.target === id && b.action === 'highlight');
    if (e.underline) {
      if (e.kind !== 'text' || e.underline.includes('\n') || !layer.label?.includes(e.underline) || layer.label.indexOf(e.underline) !== layer.label.lastIndexOf(e.underline) || highlights.length !== 1 || highlights[0]!.start < end(entry(id))) fail('下划线必须绑定正文中唯一短语，在显现后执行一次 highlight。');
    } else if (highlights.length) fail('highlight 缺少可执行的正文短语。');
  }
  if (Object.keys(shot.charts).some(id => !shot.slots.items.includes(id))) fail('图表引用了未选内容。');
  const members: string[] = [], triggers = new Set<string>();
  for (const [id, chart] of Object.entries(shot.charts)) {
    if (new Set(chart.metrics).size !== chart.metrics.length || chart.accent && !chart.metrics.includes(chart.accent)) fail('图表成员不能重复，强调对象必须属于实际集合。');
    members.push(...chart.metrics);
    const plot = editorialChartLayout(shot.elements[id]!, chart.metrics.length);
    if (plot.height < 90 || plot.cell < 100) fail('图表没有足够阅读空间，请扩大或拆镜头。');
    const units = new Set(chart.metrics.map(metric => get(metric).text ?? ''));
    if (units.size !== 1) fail('同一图表必须使用同一单位。');
    const checkDomain = (domain: {min: number; max: number}) => {
      if (domain.max <= domain.min || chart.metrics.some(metric => {const v = get(metric).value; return typeof v !== 'number' || !Number.isFinite(v) || v < domain.min || v > domain.max;})) fail('数值必须是真实有限数值，且完整位于数轴范围。');
      if (domain.min > 0 && !get(id).text?.trim()) fail('非零起点必须提供可见的比较说明。');
    };
    checkDomain(chart.domain);
    for (const metric of chart.metrics) {
      if (!shot.slots.metrics.includes(metric)) fail('图表引用未声明指标。');
      if (entry(metric).start < end(entry(id))) fail('先建立图表标题，再显现数据。');
    }
    if (chart.rescale) {
      checkDomain(chart.rescale.domain);
      const beat = scene.beats.find(b => b.id === chart.rescale!.trigger);
      if (!beat || beat.target !== id || beat.action !== 'focus' || triggers.has(beat.id) || beat.start < Math.max(...chart.metrics.map(metric => end(entry(metric))))) fail('重标尺必须绑定唯一 focus，且在原数据落定后开始。');
      triggers.add(beat.id);
    }
  }
  if (members.sort().join('|') !== [...shot.slots.metrics].sort().join('|')) fail('每个指标必须在一个图表中完整显示，不能隐藏、复用或遗留。');
  for (const id of shot.slots.metrics) {
    const layer = get(id);
    if (layer.type !== 'metric' || typeof layer.value !== 'number' || /[\r\n]/.test(`${layer.label}${layer.text ?? ''}`) || Object.keys(layer).some(k => !['id', 'type', 'label', 'value', 'text'].includes(k)) || entry(id).action !== 'reveal') fail('指标需要数字 value、单行类别和单位与唯一 reveal。');
  }
  for (const rule of shot.rules) box({x: rule.x, y: rule.y, width: rule.vertical ? rule.width : rule.length, height: rule.vertical ? rule.length : rule.width});
  const items = Object.entries(shot.elements);
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) if (overlaps(items[i]![1], items[j]![1], 4)) fail(`编辑内容相互遮挡：${items[i]![0]} / ${items[j]![0]}。`);
  if (scene.beats.some(b => b.state !== undefined || b.action === 'focus' && !triggers.has(b.id)) || scene.durationFrames / fps > 60) fail('动作包含隐藏状态、未绑定重标尺或过长镜头。');
}
