import {isDirectionShot} from '../../src/shots/directions/schema.ts';
import {directionInsets} from '../../src/shots/directions/layout.ts';

export function checkDirectionText(scene, lines) {
  const shot = scene.shot;
  if (!shot || !isDirectionShot(shot)) return [];
  return scene.layers.flatMap(layer => {
    const e = shot.elements[layer.id], inset = directionInsets(e.kind, e);
    const label = layer.label.split('\n'), body = layer.text?.split('\n') ?? [];
    const height = label.length * e.fontSize * 1.3 + (body.length ? 14 + body.length * e.bodySize * 1.3 : 0);
    const width = e.width - inset.width;
    const over = label.some(row => lines(row, e.fontSize, width) > 1) || body.some(row => lines(row, e.bodySize, width) > 1)
      || (e.kind !== 'media' && height > e.height - inset.height);
    return over ? [{severity: 'error', sceneId: scene.id, target: layer.id, message: '方向配方文字超出显式内容区域；请缩短、分行或拆镜头。'}] : [];
  });
}
