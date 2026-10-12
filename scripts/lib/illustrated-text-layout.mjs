import {isIllustratedShot} from '../../src/shots/illustrated/schema.ts';
import {illustratedCanvas, illustratedLayout, illustrationTextBox} from '../../src/shots/illustrated/layout.ts';
export function checkIllustratedText(scene, board, style, lines) {
  if (!scene.shot || !isIllustratedShot(scene.shot)) return [];
  const {width, height} = illustratedCanvas(board.project.width, board.project.height, style.safeArea.landscape, Boolean(board.layoutPolicy));
  const rects = illustratedLayout(scene.shot, width, height, style.id), issues = [];
  for (const layer of scene.layers) {
    const box = illustrationTextBox(scene.shot, layer.id, rects.get(layer.id), style.id);
    const used = lines(layer.label, box.label, box.width) * box.label * 1.25
      + (layer.text ? box.gap + lines(layer.text, box.text, box.width) * box.text * 1.35 : 0)
      + (layer.type === 'metric' ? box.metricFont * 1.1 + 12 : 0);
    if (box.width <= 0 || used > box.height) issues.push({severity: 'error', sceneId: scene.id, target: layer.id, message: '插画正文超出共享实际槽位；请缩短或拆镜头。'});
  }
  return issues;
}
