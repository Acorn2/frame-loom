import {isExpansionShot} from '../../src/shots/expansion/schema.ts';
import {expansionLayout} from '../../src/shots/expansion/layout.ts';

export function checkExpansionText(scene, width, height, lines) {
  const shot = scene.shot;
  if (!shot || !isExpansionShot(shot)) return [];
  const layout = expansionLayout(width, height * .86, shot.slots.items.length);
  const issues = [];
  const check = (id, w, h, labelFont = layout.labelFont, textFont = layout.textFont) => {
    const layer = scene.layers.find(layer => layer.id === id);
    const used = lines(layer.label, labelFont, w) * labelFont * 1.25
      + (layer.text ? 12 + lines(layer.text, textFont, w) * textFont * 1.35 : 0);
    if (w <= 0 || used > h) issues.push({severity: 'error', sceneId: scene.id, target: id,
      message: '文本超出当前画幅的实际槽位；请缩短内容或拆镜头。'});
  };
  const pad = layout.inset * 2;
  if (shot.id === 'type-and-filter') {
    check(shot.slots.query, width - pad - 80, layout.queryHeight - pad);
    shot.slots.items.forEach(id => check(id, layout.itemWidth - pad, layout.itemHeight - pad));
    check(shot.slots.detail, width - pad, height * .86 - layout.queryHeight - layout.gap - pad);
  } else if (shot.id === 'ai-stream-response') {
    check(shot.slots.summary, width - pad, layout.summaryHeight - pad);
    shot.slots.items.forEach(id => {
      if (layout.portrait) {check(id, width - pad - 68, layout.streamHeight - pad); return;}
      const layer = scene.layers.find(layer => layer.id === id), inner = width - pad - 68;
      const used = Math.max(lines(layer.label, layout.labelFont, inner * .35) * layout.labelFont * 1.2,
        lines(layer.text, layout.textFont, inner * .65 - 24) * layout.textFont * 1.35);
      if (used > layout.streamHeight - pad) issues.push({severity:'error',sceneId:scene.id,target:id,message:'任务行超出横屏文字槽位；请缩短内容或拆镜头。'});
    });
    check(shot.slots.completion, width, layout.completionHeight);
  } else {
    shot.slots.items.forEach(id => {
      const layer = scene.layers.find(layer => layer.id === id);
      if (lines(`${layer.label} · ${layer.value}`, layout.portrait ? 32 : 34, width * (layout.portrait ? .34 : 1 / shot.slots.items.length)) > 1) issues.push({severity:'error', sceneId:scene.id,target:id,message:'点阵分组标签超出单行槽位。'});
    });
    const layer = scene.layers.find(layer => layer.id === shot.slots.total);
    if (lines(`${layer.label} · ${layer.value} ${scene.visual.unit}`, layout.labelFont, width) > 1) issues.push({severity:'error',sceneId:scene.id,target:layer.id,message:'点阵总数超出单行槽位。'});
  }
  return issues;
}
