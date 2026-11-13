import {isImageLedShot, ImageLedShotSchema} from '../../src/shots/image-led/schema.ts';
export function checkImageLedText(scene, lines) {
  if (!scene.shot || !isImageLedShot(scene.shot)) return [];
  const shot = ImageLedShotSchema.parse(scene.shot);
  const issues = [];
  for (const layer of scene.layers) {
    const e = shot.elements[layer.id];
    const labelRows = layer.label.split('\n'), bodyRows = layer.text ? layer.text.split('\n') : [];
    // The renderer uses white-space: pre. Only authored newlines make rows;
    // a tall box must never make an over-wide row look like valid wrapping.
    const oversizedRow = labelRows.some(row => lines(row, e.kind === 'image' ? 24 : e.fontSize, e.width) > 1)
      || bodyRows.some(row => lines(row, e.bodySize, e.width) > 1);
    const height = e.kind === 'image' ? 30 : labelRows.length * e.fontSize * 1.3 + (bodyRows.length ? 14 + bodyRows.length * e.bodySize * 1.3 : 0) + (e.underline ? 9 : 0);
    if (oversizedRow || height > (e.kind === 'image' ? 34 : e.height) || (e.kind === 'image' && labelRows.length > 1)) issues.push({severity: 'error', sceneId: scene.id, target: layer.id, message: '图像图解文字超出声明区域；请扩大槽位、显式换行或缩短文案。'});
  }
  return issues;
}
