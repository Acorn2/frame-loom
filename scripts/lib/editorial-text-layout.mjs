import {isEditorialShot} from '../../src/shots/editorial/schema.ts';
import {editorialChartLayout, editorialNumber} from '../../src/shots/editorial/layout.ts';

export function checkEditorialText(scene, lines) {
  if (!scene.shot || !isEditorialShot(scene.shot)) return [];
  const shot = scene.shot, issues = [];
  const fail = id => issues.push({severity: 'error', sceneId: scene.id, target: id, message: '编辑讲解文字或图表标签超出内容区域，请缩短、扩大或拆镜头。'});
  for (const id of shot.slots.items) {
    const layer = scene.layers.find(l => l.id === id), e = shot.elements[id];
    if (!layer || !e) continue;
    const label = layer.label.split('\n'), body = layer.text?.split('\n') ?? [];
    const chart = shot.charts[id];
    if (label.some(row => lines(row, e.fontSize, e.width) > 1) || body.some(row => lines(row, e.bodySize, e.width) > 1)) fail(id);
    if (!chart) {if (label.length * e.fontSize * 1.4 + (body.length ? 12 + body.length * e.bodySize * 1.4 : 0) > e.height) fail(id); continue;}
    if (label.length !== 1 || body.length > 1) fail(id);
    const plot = editorialChartLayout(e, chart.metrics.length);
    for (const domain of [chart.domain, ...(chart.rescale ? [chart.rescale.domain] : [])]) for (const tick of [domain.min, (domain.min + domain.max) / 2, domain.max]) if (lines(editorialNumber(tick), e.bodySize, e.axisWidth - 18) > 1) fail(id);
    for (const metricId of chart.metrics) {
      const metric = scene.layers.find(l => l.id === metricId);
      if (metric && (lines(metric.label, e.bodySize, plot.cell - 12) > 1 || lines(`${editorialNumber(Number(metric.value))}${metric.text ?? ''}`, e.valueSize, plot.cell - 12) > 1)) fail(metricId);
    }
  }
  return issues;
}
