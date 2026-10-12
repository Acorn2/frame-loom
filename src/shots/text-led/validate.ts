import type {StoryboardScene, StoryboardBeat, StoryboardLayer} from '../../schemas/storyboard';
import type {Shot} from '../../schemas/shot-recipe';
import {isTextLedShot} from './schema';
import {textLedBoxes} from './layout';

export function textLedAllowed(shot: Shot, beat: StoryboardBeat, scene: StoryboardScene): string[] {
  if (!isTextLedShot(shot)) return [];
  if (scene.connections.some(link => link.id === beat.target)) return ['draw'];
  if (!shot.slots.items.includes(beat.target)) return [];
  return ['reveal', ...(shot.id === 'annotated-manuscript' && shot.annotations[beat.target] ? ['highlight'] : []),
    ...(shot.id === 'editorial-flow' && shot.stages.some(stage => stage.trigger === beat.id) ? ['focus'] : [])];
}
export function validateTextLed(scene: StoryboardScene, shot: Shot, fps: number, get: (id: string) => StoryboardLayer, entry: (id: string) => StoryboardBeat, fail: (message: string) => never) {
  if (!isTextLedShot(shot)) return;
  const end = (beat: StoryboardBeat) => beat.start + beat.duration;
  const keys = [...shot.slots.items].sort().join('|');
  if (!scene.visual?.source?.trim() || scene.visual.representation !== 'diagram') fail('文案图解需要原文来源和 diagram。');
  if (Object.keys(scene.visual).some(k => !['kind', 'explanation', 'representation', 'source'].includes(k))) fail('文案镜头不接受未实现的 visual 字段。');
  if (Object.keys(shot.elements).sort().join('|') !== keys) fail('每个文字或插画都必须绑定唯一槽位。');
  if (Object.keys(shot.routes).sort().join('|') !== scene.connections.map(c => c.id).sort().join('|')) fail('每条路径必须绑定显式关系。');
  const title = shot.slots.items[0]!;
  if (get(title).label !== scene.title || shot.elements[title]?.kind !== 'text' || get(title).text) fail('第一个文字槽位必须完整显示 scene.title。');
  for (const id of shot.slots.items) {
    const layer = get(id), element = shot.elements[id]!;
    if (layer.type !== (element.kind === 'sticker' ? 'object' : 'node')) fail('文字使用 node，角落插画使用 object。');
    const allowed = ['id', 'type', 'label', ...(element.kind === 'sticker' ? ['asset', 'assetDataUri', 'fit'] : ['text'])];
    if (Object.keys(layer).some(k => !allowed.includes(k))) fail('位置与阶段只能放在镜头契约，不接受隐藏图层状态。');
    if (element.kind === 'sticker' && (!layer.asset || (layer.fit && layer.fit !== 'contain'))) fail('插画必须完整展示有来源的本地图片。');
    if (entry(id).action !== 'reveal') fail('文案镜头需要唯一 reveal。');
  }
  for (const placements of textLedBoxes(shot)) {
    if (Object.keys(placements).sort().join('|') !== keys) fail('阶段必须显式覆盖全部槽位，不能留下隐式位置。');
    let imageArea = 0;
    for (const id of shot.slots.items) {
      const box = placements[id]!;
      if (box.x < 110 || box.y < 96 || box.x + box.width > 1810 || box.y + box.height > 895) fail('文字或插画进入安全区外、字幕区。');
      if (box.x + box.width > 1580 && box.y < 160) fail('右上品牌区不能放内容。');
      if (shot.elements[id]!.kind === 'sticker') imageArea += box.width * box.height;
    }
    if (imageArea > 1920 * 1080 * .08) fail('辅助插画总面积不得超过画布8%，文案和图解是主体。');
  }
  if (shot.id === 'annotated-manuscript') {
    for (const [id, mark] of Object.entries(shot.annotations)) {
      const layer = get(id), label = layer.label ?? '', phraseAt = label.indexOf(mark.phrase);
      if (!shot.slots.items.includes(id) || shot.elements[id]?.kind !== 'text' || phraseAt < 0 || label.indexOf(mark.phrase, phraseAt + 1) >= 0) fail('批注短语必须在对应正文中唯一出现。');
      const highlights = scene.beats.filter(b => b.target === id && b.action === 'highlight');
      if (highlights.length !== 1 || highlights[0]!.start < end(entry(id))) fail('正文落定后才可唯一圈注。');
    }
    for (const route of Object.values(shot.routes)) if (route.points.some(([x, y]) => x < 110 || x > 1810 || y < 160 || y > 895)) fail('批注线条超出内容区域。');
  } else {
    let previousEnd = 0;
    const triggers = new Set<string>();
    for (const stage of shot.stages) {
      const beat = scene.beats.find(b => b.id === stage.trigger);
      if (!beat || beat.action !== 'focus' || !shot.slots.items.includes(beat.target) || triggers.has(beat.id) || beat.start < previousEnd || beat.start < end(entry(beat.target))) fail('排印阶段需要唯一 focus，阶段不能重叠，目标先入场。');
      triggers.add(beat.id); previousEnd = end(beat);
      const target = stage.placements[beat.target]!;
      if (target.opacity < 1) fail('阶段焦点在完成态必须可见。');
    }
    if (scene.beats.some(b => b.action === 'focus' && !triggers.has(b.id))) fail('focus 必须绑定实际排印阶段。');
    for (const route of Object.values(shot.routes)) if (route.stage > shot.stages.length) fail('关系引用了不存在的阶段。');
  }
  for (const link of scene.connections) {
    const draws = scene.beats.filter(b => b.target === link.id && b.action === 'draw');
    if (link.label || draws.length !== 1 || draws[0]!.start < Math.max(end(entry(link.from)), end(entry(link.to)))) fail('关系无隐藏文字，两个端点入场后才可绘制唯一连接。');
    if (shot.id === 'editorial-flow') {
      const stage = shot.routes[link.id]!.stage, placements = stage === 0 ? shot.elements : shot.stages[stage - 1]!.placements;
      if (placements[link.from]!.opacity < 1 || placements[link.to]!.opacity < 1) fail('关系阶段的两端必须可见。');
      const ready = stage === 0 ? 0 : end(scene.beats.find(b => b.id === shot.stages[stage - 1]!.trigger)!);
      const next = shot.stages[stage] && scene.beats.find(b => b.id === shot.stages[stage]!.trigger)!;
      if (draws[0]!.start < ready || (next && end(draws[0]!) > next.start)) fail('排印连接必须在阶段落定后完成，不能跨阶段。');
    }
  }
  if (scene.beats.some(b => b.state !== undefined)) fail('文案镜头不接受隐藏 beat.state。');
  if (scene.durationFrames / fps > 60) fail('长讲稿应拆分镜头，单场文案推演不超过60秒。');
}
