import {titleType, wordType} from '../../src/shots/type-scale.ts';
import {shotContentLayout} from '../../src/shots/layout.ts';
import {hierarchyLayout} from '../../src/shots/shortlist/relation-layout.ts';

// These rectangles match the registered renderers, including padding and caption reserve.
export function checkShortlistText(scene, contentWidth, contentHeight, scale, estimateTextLines) {
  const issues = [];
  const shot = scene.shot;
  if (!shot) return issues;
  const check = (id, width, height, labelFont, textFont, padding, gap = 8) => {
    const layer = scene.layers.find((item) => item.id === id);
    const available = width - 2 * padding * scale;
    const used = estimateTextLines(layer.label, labelFont * scale, available) * labelFont * scale * 1.2 + estimateTextLines(layer.text, textFont * scale, available) * textFont * scale * 1.3 + (layer.text ? gap * scale : 0);
    if (used > height - 2 * padding * scale) issues.push({severity: 'error', sceneId: scene.id, target: id, message: '镜头文字超出实际槽位，请缩短内容或拆镜头。'});
  };
  const modern = shot.version !== '1.0.0';
  const current = shot.version === '1.2.0';
  const bodyHeight = contentHeight * shotContentLayout(shot).bodyHeight;
  if (shot.id === 'blur-slide' || shot.id === 'split-text-stagger') {
    const phrases = shot.slots.phrases.map((id) => scene.layers.find((layer) => layer.id === id).label);
    const lines = estimateTextLines(phrases.join(' '), (current ? 136 : 96) * scale, contentWidth * 0.92);
    const subtitle = shot.id === 'blur-slide' ? scene.layers.find((layer) => layer.id === shot.slots.subtitle).label : '';
    if (lines * (current ? 136 : 96) * scale * 1.6 + estimateTextLines(subtitle, (current ? 52 : 40) * scale, contentWidth * 0.84) * (current ? 64 : 48) * scale + (subtitle ? 48 * scale : 0) > contentHeight * 0.88) issues.push({severity: 'error', sceneId: scene.id, target: 'phrases', message: '标题短语与副标题超出实际可读区域，请缩短或拆镜头。'});
  }
  if (shot.id === 'card-stack') for (const id of shot.slots.items) check(id, contentWidth * (modern ? .22 : 1 / shot.slots.items.length - .02), bodyHeight * (modern ? .8 : .9) - 34 * scale, current ? 64 : modern ? 48 : 30, current ? 44 : modern ? 32 : 26, 24, 16);
  if (shot.id === 'concept-matrix') for (const id of shot.slots.items) check(id, contentWidth * 0.49, bodyHeight * 0.49 - 34 * scale, current ? 64 : modern ? 48 : 30, current ? 44 : modern ? 32 : 26, 24, 16);
  if (shot.id === 'platform-hinge-rise') {
    for (const id of shot.slots.items) check(id, contentWidth * 0.49, bodyHeight * 0.58 - 34 * scale, current ? 64 : modern ? 48 : 30, current ? 44 : modern ? 32 : 26, 24, 16);
    check(shot.slots.result, contentWidth, bodyHeight * 0.32, current ? 44 : 32, current ? 44 : 26, 18);
  }
  if (shot.id === 'source-converge') {
    for (const id of shot.slots.items) check(id, contentWidth * 0.31, bodyHeight * (1 / shot.slots.items.length - (current ? .016 : .04)), current ? 60 : modern ? 36 : 28, current ? 36 : modern ? 28 : 23, 12);
    check(shot.slots.result, contentWidth * 0.32, bodyHeight * 0.34, current ? 60 : modern ? 36 : 28, current ? 36 : modern ? 28 : 23, 12);
  }
  if (shot.id === 'diagram-cascade') for (const [id, box] of hierarchyLayout(scene)) check(id, contentWidth * box.width / 1000, bodyHeight * box.height / 500, current ? 60 : modern ? 36 : 28, current ? 36 : modern ? 28 : 23, 12);
  if (shot.id === 'row-embed') for (const id of shot.slots.items) check(id, contentWidth, bodyHeight * (1 / shot.slots.items.length - .04), current ? 60 : modern ? 38 : 30, current ? 44 : modern ? 30 : 26, 24, 12);
  if (shot.id === 'structure-then-text') for (const id of shot.slots.items) check(id, contentWidth * .49, bodyHeight * .49, current ? 60 : modern ? 38 : 30, current ? 44 : modern ? 30 : 26, 24, 12);
  if (shot.id === 'evidence-relay') {
    for (const id of shot.slots.items) check(id, contentWidth * .58, bodyHeight * (modern ? .74 : .92), current ? 60 : modern ? 38 : 30, current ? 54 : modern ? 42 : 32, 24, 12);
    for (const id of shot.slots.keywords) check(id, contentWidth * .36, bodyHeight * .6, current ? 112 : modern ? 100 : 72, 26, 0, 0);
  }
  if (shot.id === 'concept-matrix' && shot.slots.fronts) for (const id of shot.slots.fronts) check(id, contentWidth * .49, bodyHeight * .49, current ? 64 : modern ? 38 : 30, current ? 44 : modern ? 30 : 26, 24, 16);
  if (shot.id === 'timeline-travel') for (const id of shot.slots.items) check(id, contentWidth * (modern ? .64 : .9), bodyHeight * .72 * .68, current ? 64 : modern ? 52 : 36, current ? 44 : modern ? 36 : 30, 24, 12);
  if (['brace-expand', 'lead-word-assemble', 'pill-slot-cycle', 'word-roll', 'text-column-converge', 'odometer-roll'].includes(shot.id)) {
    let text = scene.title; let font = current ? titleType(scene.title) : 88; let available = contentWidth;
    if (shot.id === 'brace-expand') available -= 160 * scale;
    if (['pill-slot-cycle', 'word-roll', 'text-column-converge'].includes(shot.id)) {
      const label = (id) => scene.layers.find((layer) => layer.id === id).label;
      const prefix = label(shot.slots.prefix);
      const suffix = shot.slots.suffix ? label(shot.slots.suffix) : '';
      const words = shot.slots.items.map(label);
      const size = current ? wordType(words, prefix, suffix) : 72;
      for (const word of words) if (estimateTextLines(prefix + ' ' + word + ' ' + suffix, (shot.id === 'text-column-converge' ? Math.min(112, size) : size) * scale, contentWidth - 108 * scale) > 1 || /[\r\n]/.test(prefix + word + suffix)) issues.push({severity: 'error', sceneId: scene.id, target: 'items', message: '固定句干与最长词超出单行槽位。'});
      text = shot.slots.result ? label(shot.slots.result) : '';
      font = shot.id === 'text-column-converge' ? Math.min(112, size) : size;
    }
    if (shot.id !== 'odometer-roll' && (estimateTextLines(text, font * scale, available) > 1 || /[\r\n]/.test(text))) issues.push({severity: 'error', sceneId: scene.id, target: 'title', message: '标题超出配方单行测量区域。'});
    if (shot.id === 'odometer-roll') {
      check(shot.slots.metric, contentWidth * .9, bodyHeight * .5, current ? 64 : modern ? 52 : 36, 26, 0, 12);
      const unitWidth = contentWidth - (String(scene.layers.find((layer) => layer.id === shot.slots.metric).value).length * (shot.version === '1.2.0' ? 134 : modern ? 126 : 76) + 24) * scale;
      if (estimateTextLines(scene.visual.unit, 42 * scale, unitWidth) > 1 || /[\r\n]/.test(scene.visual.unit)) issues.push({severity: 'error', sceneId: scene.id, target: 'unit', message: '指标单位超出数字旁的单行区域。'});
    }
  }
  if (shot.id === 'odometer-roll' || shot.id === 'timeline-travel') {
    const sourceText = shot.id === 'timeline-travel' ? '日期按顺序等距排列，不表示时间跨度 · ' + scene.visual.source : '来源：' + scene.visual.source;
    if (estimateTextLines(sourceText, 22 * scale, contentWidth) > 1 || /[\r\n]/.test(sourceText)) issues.push({severity: 'error', sceneId: scene.id, target: 'source', message: '数据来源说明超出单行安全区，请使用简短可追溯的位置标记。'});
  }
  return issues;
}
