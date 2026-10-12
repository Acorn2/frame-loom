import {isTextLedShot} from '../../src/shots/text-led/schema.ts';
import {textLedBoxes} from '../../src/shots/text-led/layout.ts';

export function checkTextLedText(scene, lines) {
  if (!scene.shot || !isTextLedShot(scene.shot)) return [];
  return textLedBoxes(scene.shot).flatMap((placements, stage) => scene.layers.flatMap(layer => {
    const box = placements[layer.id], image = scene.shot.elements[layer.id].kind === 'sticker';
    const rows = `${layer.label}${!image && layer.text ? `\n${layer.text}` : ''}`.split('\n');
    if (rows.some(row => lines(row, box.fontSize, box.width) > 1) || (!image && rows.length * box.fontSize * 1.35 > box.height)) {
      return [{severity: 'error', sceneId: scene.id, target: layer.id, message: `文案图解阶段${stage}文字超过显式槽位；缩短、分行或拆镜头。`}];
    }
    return [];
  }));
}
