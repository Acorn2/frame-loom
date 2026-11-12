import type {StoryboardScene} from '../../schemas/storyboard';
import type {EditorialElement, EditorialShot} from './schema';
import {directionEase} from '../directions/layout';

export const editorialNumber = (value: number) => String(value);
export const editorialTick = (value: number) => String(Number(value.toFixed(3)));
export function editorialChartLayout(element: EditorialElement, count: number) {
  const top = element.fontSize * 1.4 + element.valueSize * 1.4 + 20;
  const bottom = element.bodySize * 2.8 + 24;
  const width = element.width - element.axisWidth - 10;
  return {x: element.axisWidth, y: top, width, height: element.height - top - bottom,
    baseline: element.height - bottom, cell: width / count, barWidth: width / count * element.barWidth};
}
export function editorialDomain(scene: StoryboardScene, shot: EditorialShot, id: string, frame: number) {
  const chart = shot.charts[id]!;
  if (!chart.rescale) return chart.domain;
  const beat = scene.beats.find(b => b.id === chart.rescale!.trigger)!;
  const p = directionEase((frame - beat.start) / beat.duration);
  return {min: chart.domain.min + (chart.rescale.domain.min - chart.domain.min) * p,
    max: chart.domain.max + (chart.rescale.domain.max - chart.domain.max) * p};
}
