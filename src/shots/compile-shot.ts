import {p2SlotType, p2Allowed, validateP2} from './p2/validate';
import {isP2Shot} from './p2/schema';
import {validateChapterTransitions} from './shortlist/chapter-transitions';
import {p1SlotType, p1Allowed, validateP1} from './shortlist/validate-p1';
import type {Storyboard, StoryboardScene, StoryboardBeat, StoryboardLayer} from '../schemas/storyboard';
import {ShotSchema} from '../schemas/shot-recipe';
import {resolveShot} from './catalog';
import {getSceneTimeline} from '../timeline/scene-timeline';
import {assertStoryboardShotSelection} from './selection';
import {semanticTextTiming} from '../templates/semantic/text-timing';

export interface ShotContext {
  fps: number;
  width: number;
  height: number;
  style: {id: string; version: string};
  overlapOutFrames?: number;
}
export interface ShotPlan {
  sceneId: string;
  shot: {id: string; version: string};
  layout: 'landscape' | 'portrait';
  durationFrames: number;
  actions: StoryboardBeat[];
  checkpoints: Array<{id: string; frame: number}>;
  completeFrame: number;
  stableEndFrame: number;
}

export function compileShot(scene: StoryboardScene, context: ShotContext): ShotPlan {
  const shot = ShotSchema.parse(scene.shot);
  const recipe = resolveShot(shot.id, shot.version);
  const fail = (message: string): never => {throw new Error(`${scene.id} (${shot.id}): ${message}`);};
  const {fps, width, height, style} = context;
  const layout = width < height ? 'portrait' : 'landscape';
  if (!recipe.styles.includes(style.id) || (shot.id !== 'semantic-default' && style.version !== '1.0.0')) fail('未支持的风格或精确版本。');
  if (!recipe.orientations.includes(layout)) fail(`尚未支持 ${layout}。`);
  if (shot.id !== 'semantic-default' && Math.abs(width / height - 16 / 9) > 0.001) fail('首版只适配 16:9，其他画幅尚未验证。');
  if (!scene.visual || !recipe.visualKinds.includes(scene.visual.kind)) fail('visual.kind 与配方冲突。');
  const visual = scene.visual ?? fail('缺少 visual。');
  if (visual.networkDirection && visual.kind !== 'network') fail('networkDirection 仅适用于 network。');
  if (visual.changeMode && visual.kind !== 'change') fail('changeMode 仅适用于 change。');
  if (visual.mediaFocus && visual.kind !== 'media') fail('mediaFocus 仅适用于 media。');
  if (visual.shotPattern) fail('2.4 不接受旧 shotPattern。');
  const layers = new Map(scene.layers.map((layer) => [layer.id, layer]));
  const get = (id: string): StoryboardLayer => layers.get(id) ?? fail(`槽位引用丢失：${id}`);
  const allIds: string[] = [];
  for (const [name, refs] of Object.entries(shot.slots)) {
    const ids: string[] = Array.isArray(refs) ? refs : [refs];
    const budget = recipe.slots[name] ?? fail(`未知槽位 ${name}。`);
    if (ids.length < budget.min || ids.length > budget.max) fail(`${name} 数量超出约束。`);
    for (const id of ids) {
      const layer = get(id);
      if (name !== 'emphasis') allIds.push(id);
      const titleSlot = name === 'phrases' || name === 'title' || name === 'emphasis' || name === 'subtitle';
      const explicitType = p2SlotType(shot) ?? p1SlotType(shot, name);
      if (explicitType ? layer.type !== explicitType : titleSlot ? layer.type !== 'label' : !['node', 'card'].includes(layer.type)) fail(`${id} 的图层类型不符合 ${name} 槽位。`);
      if (!layer.label?.trim()) fail(`${id} 需要明确的 label。`);
      if (budget.textMax && !layer.text?.trim()) fail(`${id} 需要可见正文 text。`);
      if (budget.labelMax && [...(layer.label ?? '')].length > budget.labelMax) fail(`${id} 标题超过 ${budget.labelMax} 字，请缩短或拆镜头。`);
      if (budget.textMax && [...(layer.text ?? '')].length > budget.textMax) fail(`${id} 正文超过 ${budget.textMax} 字，请拆镜头。`);
    }
  }
  if (new Set(allIds).size !== allIds.length) fail('槽位不能重复引用主体。');
  if (shot.id !== 'semantic-default' && (allIds.length !== scene.layers.length || scene.layers.some((layer) => !allIds.includes(layer.id)))) fail('所有图层都必须有唯一内容槽位，不能遗留未显示的内容。');
  const endOf = (beat: StoryboardBeat) => beat.start + beat.duration;
  const entry = (id: string): StoryboardBeat => {
    const entries = scene.beats.filter((beat) => beat.target === id && ['enter', 'reveal'].includes(beat.action));
    if (entries.length !== 1) fail(`${id} 必须有唯一 enter/reveal beat。`);
    return entries[0]!;
  };
  const special = (id: string, action: 'dock' | 'demote'): StoryboardBeat => {
    const entries = scene.beats.filter((beat) => beat.target === id && beat.action === action);
    if (entries.length !== 1) fail(`${id} 必须有唯一 ${action} beat。`);
    return entries[0]!;
  };
  const stableEndFrame = scene.durationFrames - (context.overlapOutFrames ?? 0) - (scene.outro?.fadeFrames ?? (scene.transitionOut && !context.overlapOutFrames ? 12 : 0));
  const actions = scene.beats.map((beat) => ({...beat}));
  for (const beat of actions) {
    const budget = recipe.timing.actions[beat.action];
    if (!budget || beat.duration < Math.ceil(budget.minSec * fps) || beat.duration > Math.ceil(budget.maxSec * fps)) fail(`${beat.id} 动作窗口不符合配方范围。`);
    if (beat.start < 0 || endOf(beat) > stableEndFrame) fail(`${beat.id} 超出有效镜头时间。`);
    if (shot.id === 'semantic-default' || shot.id === 'compare-reveal' || shot.id === 'network-expand') continue;
    const allowed = isP2Shot(shot) ? p2Allowed(shot, beat, scene) : p1Allowed(shot, beat);
    if (shot.id === 'paper-title' && beat.target === shot.slots.emphasis) allowed.push('highlight');
    if ((shot.id === 'blur-slide' || shot.id === 'split-text-stagger') && beat.target === shot.slots.emphasis) allowed.push('highlight');
    if (shot.id === 'card-stack' && beat.target === shot.slots.items[0]) allowed.push('focus');
    if (['source-converge', 'diagram-cascade'].includes(shot.id) && scene.connections.some((connection) => connection.id === beat.target)) allowed.push('draw');
    if (shot.id === 'document-conclusions') {
      if (beat.target === shot.slots.source) allowed.push('dock');
      if (scene.connections.some((connection) => connection.id === beat.target)) allowed.push('draw');
    }
    if (shot.id === 'title-to-label' && beat.target === shot.slots.title) allowed.push('demote');
    if (!allowed.includes(beat.action)) fail(`${beat.id} 不是该镜头实现的动作。`);
  }
  if (shot.id !== 'semantic-default') for (const id of allIds) entry(id);
  if (['source-converge', 'diagram-cascade'].includes(shot.id) && scene.connections.some((link) => link.label)) fail('首版关系标签写入节点正文，不能添加未显示的连线文字。');
  if (shot.id === 'blur-slide' || shot.id === 'split-text-stagger') {
    if (shot.slots.phrases.map((id) => get(id).label).join('').replace(/\s/g, '') !== scene.title.replace(/\s/g, '')) fail('标题短语必须按顺序组成 scene.title。');
    if (shot.slots.emphasis && !shot.slots.phrases.includes(shot.slots.emphasis)) fail('emphasis 必须引用明确标题短语。');
    if (scene.connections.length) fail('标题镜头不能带关系连线。');
    shot.slots.phrases.forEach((id, index) => {if (index && entry(id).start < entry(shot.slots.phrases[index - 1]!).start) fail('短语显影顺序错误。');});
    if (shot.id === 'blur-slide' && entry(shot.slots.subtitle).start < entry(shot.slots.phrases[0]!).start) fail('副标题不能早于主标题。');
    if (shot.id === 'split-text-stagger' && [...scene.title].length > 18) fail('裂升标题最多 18 字，请按中文短语拆镜。');
    for (const beat of actions.filter((item) => item.action === 'highlight')) if (beat.start < endOf(entry(beat.target))) fail('下划线必须在短语落定后开始。');
  }
  if (['card-stack', 'concept-matrix', 'platform-hinge-rise'].includes(shot.id) && scene.connections.length) fail('集合/归纳镜头不接受额外因果连线。');
  if (shot.id === 'card-stack') {
    const unfold = actions.filter((beat) => beat.action === 'focus');
    if (unfold.length !== 1 || unfold[0]!.start < Math.max(...shot.slots.items.map((id) => endOf(entry(id))))) fail('卡堆需要唯一 focus 展开阶段，必须晚于所有卡片入场。');
  }
  if (shot.id === 'platform-hinge-rise' || shot.id === 'source-converge') {
    if (!visual.source?.trim()) fail('证据/汇聚需要原文来源。');
    const ready = Math.max(...shot.slots.items.map((id) => endOf(entry(id)))) + Math.ceil(recipe.timing.sourceHoldSec * fps);
    if (entry(shot.slots.result).start < ready) fail('先阅读全部证据/来源，再揭示结论。');
    if (shot.id === 'source-converge') {
      if (visual.anchorId !== shot.slots.result || visual.networkDirection !== 'inward') fail('汇聚需要 result anchorId 与 inward 方向。');
      if (scene.connections.length !== shot.slots.items.length) fail('每个来源必须有唯一汇聚关系。');
      for (const id of shot.slots.items) {
        const links = scene.connections.filter((link) => link.from === id && link.to === shot.slots.result);
        if (links.length !== 1) fail('汇聚关系方向错误。');
        const draw = actions.filter((beat) => beat.target === links[0]!.id && beat.action === 'draw');
        if (draw.length !== 1 || draw[0]!.start < ready || endOf(draw[0]!) > (shot.version !== '1.0.0' ? entry(shot.slots.result).start : endOf(entry(shot.slots.result)))) fail('阅读来源后描画汇聚；新版在载体汇入前完成路径，旧版在结果落定前完成。');
      }
    }
  }
  if (shot.id === 'diagram-cascade') {
    if (!visual.source?.trim() || visual.anchorId !== shot.slots.root || visual.networkDirection !== 'outward') fail('层级图需要来源与 outward root anchorId。');
    const known = new Set([shot.slots.root]);
    const depth = new Map([[shot.slots.root, 0]]);
    if (scene.connections.length !== shot.slots.items.length) fail('每个子节点必须有唯一父节点。');
    for (const id of shot.slots.items) {
      const links = scene.connections.filter((link) => link.to === id);
      if (links.length !== 1 || !known.has(links[0]!.from)) fail('层级图不能有循环、多父节点或孤立节点，items 按层排序。');
      const parent = links[0]!.from;
      const level = depth.get(parent)! + 1;
      if (level > 2 || entry(id).start < endOf(entry(parent))) fail('层级最多三层，父节点落定后才出现子节点。');
      const draws = actions.filter((beat) => beat.target === links[0]!.id && beat.action === 'draw');
      if (draws.length !== 1 || draws[0]!.start < entry(id).start || endOf(draws[0]!) > endOf(entry(id))) fail('连线不能早于子节点存在，必须在子节点落定前完成。');
      known.add(id); depth.set(id, level);
    }
  }
  if (shot.id === 'paper-title') {
    const phrases = shot.slots.phrases.map((id) => get(id).label).join('').replace(/\s/g, '');
    if (phrases !== scene.title.replace(/\s/g, '')) fail('标题短语必须完整、按顺序组成 scene.title。');
    if (shot.slots.emphasis && !shot.slots.phrases.includes(shot.slots.emphasis)) fail('emphasis 必须引用明确标题短语。');
    if (scene.connections.length) fail('标题镜头不能带关系连线。');
    shot.slots.phrases.forEach((id, index) => {if (index && entry(id).start < entry(shot.slots.phrases[index - 1]!).start) fail('短语显影顺序错误。');});
    for (const beat of actions.filter((item) => item.action === 'highlight')) if (beat.start < endOf(entry(beat.target))) fail('下划线必须在短语落定后开始。');
  }
  if (shot.id === 'title-to-label') {
    if (get(shot.slots.title).label !== scene.title) fail('title 槽位必须与 scene.title 一致。');
    const demote = special(shot.slots.title, 'demote');
    if (demote.start - endOf(entry(shot.slots.title)) < Math.ceil(recipe.timing.titleHoldSec * fps)) fail('标题显影后需要独立站稳窗口。');
    if (scene.connections.length) fail('正文标签镜头不能制造因果连线。');
    const handoffStart = shot.version === '1.0.0' ? endOf(demote) : demote.start + Math.ceil(demote.duration * .6);
    if (shot.slots.items.some((id) => entry(id).start < handoffStart)) fail('正文只能在标题完成足够让位后入场。');
  }
  if (shot.id === 'list-reveal' && scene.connections.length) fail('并列清单不能带因果连线。');
  if (shot.id === 'document-conclusions' || shot.id === 'network-expand') {
    const anchor = shot.id === 'document-conclusions' ? shot.slots.source : shot.slots.anchor;
    if (visual.anchorId !== anchor || visual.networkDirection === 'inward') fail('需要匹配 anchorId 的 outward 关系。');
    if (!visual.source?.trim()) fail('需要 visual.source 标明原文位置。');
    let ready = endOf(entry(anchor));
    if (shot.id === 'document-conclusions') {
      const dock = special(anchor, 'dock');
      if (dock.start - ready < Math.ceil(recipe.timing.sourceHoldSec * fps)) fail('来源显影后需要阅读窗口再停靠。');
      ready = endOf(dock);
    }
    if (scene.connections.length !== shot.slots.items.length) fail('每条结论/关系需要恰好一条真实连接。');
    for (const id of shot.slots.items) {
      const links = scene.connections.filter((link) => link.from === anchor && link.to === id);
      if (links.length !== 1) fail(`${id} 的连接方向或数量错误。`);
      const draws = actions.filter((beat) => beat.target === links[0]!.id && beat.action === 'draw');
      if (draws.length !== 1 || draws[0]!.start < ready || endOf(draws[0]!) > endOf(entry(id))) fail(`${id} 的连接需在来源落定后绘制，并在主体入场结束前完成。`);
      if (entry(id).start < ready) fail(`${id} 必须在来源停靠/入场结束后入场。`);
    }
  }
  validateP1(scene, shot, fps, get, entry, fail);
  validateP2(scene, shot, fps, get, entry, fail);
  if ('items' in shot.slots && !isP2Shot(shot)) {
    const entries = shot.slots.items.map(entry);
    entries.forEach((beat, index) => {
      if (index && beat.start - entries[index - 1]!.start < Math.ceil(recipe.timing.itemHoldSec * fps)) fail('逐项提示间隔过短，请缩短内容或拆镜头。');
    });
  }
  const textTiming = shot.id === 'semantic-default' ? semanticTextTiming(scene, fps, context.overlapOutFrames) : undefined;
  const completeFrame = Math.max(0, ...actions.map(endOf), visual.mediaFocus ? visual.mediaFocus.start + visual.mediaFocus.duration : 0,
    textTiming ? textTiming.claimStart + textTiming.duration : 0);
  if (stableEndFrame - completeFrame < Math.ceil(recipe.timing.readingSec * fps)) fail('完成态阅读预算不足，请延长旁白、拆镜头或换配方。');
  const checkpoints = actions.flatMap((beat) => [
    {id: `${beat.id}-mid`, frame: Math.floor(beat.start + beat.duration / 2)},
    {id: `${beat.id}-complete`, frame: endOf(beat)}
  ]);
  if (textTiming) {
    if (!scene.transitionIn) checkpoints.push({id: 'title-mid', frame: Math.floor(textTiming.duration / 2)}, {id: 'title-complete', frame: textTiming.duration});
    checkpoints.push({id: 'claim-mid', frame: textTiming.claimStart + Math.floor(textTiming.duration / 2)}, {id: 'claim-complete', frame: textTiming.claimStart + textTiming.duration});
  }
  if (shot.id === 'platform-hinge-rise') for (const id of shot.slots.items) {
    const beat = entry(id);
    checkpoints.push({id: `${beat.id}-platform-ready`, frame: Math.ceil(beat.start + beat.duration * 0.25)});
  }
  if (shot.id === 'concept-matrix' && !shot.revealMode) for (const id of shot.slots.items) {
    const beat = entry(id);
    checkpoints.push({id: `${beat.id}-outline-ready`, frame: Math.ceil(beat.start + beat.duration * (1 - Math.cbrt(0.6)))});
  }
  if (shot.id === 'odometer-roll') {
    const beat = actions.find((item) => item.action === 'count')!;
    const digits = String(get(shot.slots.metric).value).replace(/\D/g, '').length;
    for (let i = 0; i < digits; i++) checkpoints.push({id: `digit-${i}-locked`, frame: Math.ceil(beat.start + beat.duration * (.6 + .4 * i / Math.max(1, digits - 1)))});
  }
  if (visual.mediaFocus) checkpoints.push({id: 'media-focus-complete', frame: visual.mediaFocus.start + visual.mediaFocus.duration});
  checkpoints.push({id: 'complete', frame: completeFrame + 1}, {id: 'before-handoff', frame: stableEndFrame - 2});
  return {sceneId: scene.id, shot: {id: shot.id, version: shot.version}, layout, durationFrames: scene.durationFrames, actions, checkpoints, completeFrame, stableEndFrame};
}

export function compileStoryboardShots(storyboard: Storyboard): ShotPlan[] {
  if (storyboard.schemaVersion !== '2.4') return [];
  assertStoryboardShotSelection(storyboard);
  validateChapterTransitions(storyboard);
  return getSceneTimeline(storyboard).map(({scene, overlapOutFrames}, index, timeline) => {
    const plan = compileShot(scene, {...storyboard.project, style: storyboard.style, overlapOutFrames});
    if (scene.transitionIn && ['overlap-blinds', 'overlap-push-stack', 'overlap-line-carry', 'overlap-ink', 'overlap-barn-door'].includes(scene.transitionIn.type)) plan.checkpoints.push({id: 'chapter-in-mid', frame: Math.floor(scene.transitionIn.durationFrames / 2)}, {id: 'chapter-in-complete', frame: scene.transitionIn.durationFrames});
    if (['overlap-blinds', 'overlap-push-stack', 'overlap-line-carry', 'overlap-ink', 'overlap-barn-door'].includes(timeline[index + 1]?.scene.transitionIn?.type ?? '')) plan.checkpoints.push({id: 'chapter-out-mid', frame: scene.durationFrames - Math.floor(overlapOutFrames / 2)});
    return plan;
  });
}
