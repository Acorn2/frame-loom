import {isWhiteboardShot} from '../../src/shots/whiteboard/schema.ts';
import {whiteboardLayout, whiteboardCanvas, whiteboardType} from '../../src/shots/whiteboard/layout.ts';

export function checkWhiteboardText(scene, board, style, lines) {
  if (!scene.shot || !isWhiteboardShot(scene.shot)) return [];
  const {width, height} = whiteboardCanvas(board.project.width, board.project.height, style.safeArea.landscape, Boolean(board.layoutPolicy));
  const rects = whiteboardLayout(scene.shot, width, height), issues = [];
  const type = whiteboardType(scene.shot);
  for (const id of scene.shot.slots.items) {
    const layer = scene.layers.find(layer => layer.id === id), box = rects.get(id);
    const w = box.width - type.inset * 2;
    const used = lines(layer.label, type.label, w) * type.label * 1.25
      + type.gap + lines(layer.text, type.text, w) * type.text * type.lineHeight;
    if (w <= 0 || used > box.height - type.inset * 2) issues.push({severity: 'error', sceneId: scene.id, target: id, message: '白板正文超出共享实际槽位；请缩短或拆镜头。'});
  }
  if (scene.shot.id === 'whiteboard-explain') {
    const id = scene.shot.slots.subject, layer = scene.layers.find(layer => layer.id === id), box = rects.get(id);
    if (lines(layer.label, 36, box.width) * 36 * 1.3 > 64) issues.push({severity: 'error', sceneId: scene.id, target: id, message: '主体名称超过图片下方槽位，请缩短。'});
  }
  return issues;
}
