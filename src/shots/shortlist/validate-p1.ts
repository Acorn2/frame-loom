import type {StoryboardScene, StoryboardBeat, StoryboardLayer} from '../../schemas/storyboard';
import type {Shot} from '../../schemas/shot-recipe';
export const P1_IDS = ['lead-word-assemble', 'brace-expand', 'pill-slot-cycle', 'word-roll', 'text-column-converge', 'evidence-relay', 'row-embed', 'structure-then-text', 'timeline-travel', 'odometer-roll'];
export function p1SlotType(shot: Shot, name: string): string | undefined {
  if (['pill-slot-cycle', 'word-roll', 'text-column-converge'].includes(shot.id) || name === 'keywords') return 'label';
  if (shot.id === 'odometer-roll') return 'metric';
  return undefined;
}
export function p1Allowed(shot: Shot, beat: StoryboardBeat): string[] {
  const allowed = ['enter', 'reveal'];
  if (shot.id === 'lead-word-assemble' && beat.target === shot.slots.phrases[0]) allowed.push('focus');
  if (shot.id === 'text-column-converge' && beat.target === shot.slots.result) allowed.push('focus');
  if (shot.id === 'structure-then-text' && shot.slots.items.includes(beat.target)) allowed.push('trace');
  if ((shot.id === 'row-embed' || shot.id === 'card-stack') && shot.treatment && shot.slots.items.includes(beat.target)) allowed.push('tape');
  if (shot.id === 'odometer-roll' && beat.target === shot.slots.metric) allowed.push('count');
  return allowed;
}
export function validateP1(scene: StoryboardScene, shot: Shot, fps: number, get: (id: string) => StoryboardLayer, entry: (id: string) => StoryboardBeat, fail: (message: string) => never) {
  const end = (beat: StoryboardBeat) => beat.start + beat.duration;
  const phase = (id: string, action: string) => {
    const found = scene.beats.filter((beat) => beat.target === id && beat.action === action);
    if (found.length !== 1) fail(`${id} 需要唯一 ${action} 阶段。`);
    return found[0]!;
  };
  const hold = Math.ceil(.8 * fps);
  if (P1_IDS.includes(shot.id) && scene.connections.length) fail('该配方不执行额外连线；不能暗示未给出的关系。');
  if (shot.id === 'lead-word-assemble') {
    if (shot.slots.phrases.map((id) => get(id).label).join('').replace(/\s/g, '') !== scene.title.replace(/\s/g, '') || [...scene.title].length > 18) fail('关键词与后续短语须组成不超过 18 字的真实标题。');
    if ([...get(shot.slots.phrases[0]!).label!].length > 5) fail('先行关键词最多 5 字。');
    const recede = phase(shot.slots.phrases[0]!, 'focus');
    if (recede.start < end(entry(shot.slots.phrases[0]!)) + Math.ceil(.6 * fps)) fail('关键词站稳后才组句。');
    shot.slots.phrases.slice(1).forEach((id, i) => {if (entry(id).start < end(recede) || (i && entry(id).start < entry(shot.slots.phrases[i]!).start)) fail('回落完成后才组句，短语不能倒序。');});
  }
  if (shot.id === 'brace-expand' && get(shot.slots.title).label !== scene.title) fail('括号内标题须与 scene.title 一致。');
  if (shot.id === 'pill-slot-cycle' || shot.id === 'word-roll' || shot.id === 'text-column-converge' || shot.id === 'evidence-relay' || shot.id === 'timeline-travel') {
    const items = shot.slots.items;
    if ('prefix' in shot.slots && entry(items[0]!).start < end(entry(shot.slots.prefix))) fail('先建立固定句干再轮换内容。');
    if ('suffix' in shot.slots && shot.slots.suffix && entry(items[0]!).start < end(entry(shot.slots.suffix))) fail('句干与后缀必须先落定。');
    items.forEach((id, i) => {if (i && entry(id).start < end(entry(items[i - 1]!)) + hold) fail('替换前每项需要至少 0.8 秒独立阅读。');});
    if (shot.id === 'text-column-converge') {
      if (!scene.visual?.source?.trim()) fail('归纳须有原文来源。');
      const last = end(entry(items.at(-1)!)) + hold;
      const collapse = phase(shot.slots.result, 'focus');
      if (collapse.start < last || entry(shot.slots.result).start < end(collapse)) fail('全部阅读后只合拢一次，再给出可追溯结论。');
    }
    if (shot.id === 'evidence-relay') {
      if (!scene.visual?.source?.trim() || items.length !== shot.slots.keywords.length) fail('证据与关键词必须一对一并记录来源。');
      items.forEach((id, i) => {const a = entry(id); const b = entry(shot.slots.keywords[i]!); if (a.start !== b.start || a.duration !== b.duration) fail('证据换一次，关键词必须同步换一次。');});
    }
    if (shot.id === 'timeline-travel') {
      if (!scene.visual?.source?.trim()) fail('时间线需要日期来源。');
      let previous = '';
      for (const id of items) {
        const date = get(id).value;
        if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date).toISOString().slice(0, 10) !== date || date <= previous) fail('日期必须是真实 ISO 日期并严格递增；等距仅表示顺序。');
        previous = date;
      }
    }
  }
  if (shot.id === 'structure-then-text') {
    const closed = Math.max(...shot.slots.items.map((id) => end(phase(id, 'trace'))));
    if (shot.slots.items.some((id) => entry(id).start < closed)) fail('全部结构闭合后才能填入文字。');
  }
  if ((shot.id === 'row-embed' || shot.id === 'card-stack') && shot.treatment) {
    for (const id of shot.slots.items) if (phase(id, 'tape').start < end(entry(id))) fail('纸卡落位后才能拍定胶带。');
    if (shot.id === 'card-stack' && phase(shot.slots.items[0]!, 'focus').start < Math.max(...shot.slots.items.map((id) => end(phase(id, 'tape'))))) fail('胶带拍定后才展开卡堆。');
  }
  if (shot.id === 'concept-matrix') {
    if (Boolean(shot.revealMode) !== Boolean(shot.slots.fronts) || (shot.slots.fronts && shot.slots.fronts.length !== shot.slots.items.length)) fail('翻面必须提供完整的一对一正反面。');
    if (shot.slots.fronts) {
      if (!scene.visual?.source?.trim()) fail('翻面对应关系需要来源。');
      shot.slots.items.forEach((id, i) => {if (entry(id).start < end(entry(shot.slots.fronts![i]!)) + hold) fail('正面阅读后才翻到反面。');});
    }
  }
  if (shot.id === 'odometer-roll') {
    const layer = get(shot.slots.metric);
    if (typeof layer.value !== 'string' || !/^-?\d{1,6}(\.\d{1,3})?$/.test(layer.value) || layer.value.replace(/\D/g, '').length > 6 || !scene.visual?.unit?.trim() || !scene.visual.source?.trim()) fail('指标需要精度明确的数字字符串、单位和来源，总位数最多 6。');
    const count = phase(layer.id, 'count');
    if (count.start < end(entry(layer.id))) fail('指标入场后才能逐位落定。');
  }
}
