export function checkBoardText(scene, lines) {
  if (scene.shot?.id !== 'whiteboard-board') return [];
  return scene.layers.flatMap(layer => {
    const e = scene.shot.elements[layer.id], size = e.kind === 'sticker' ? e.labelSize : e.fontSize;
    const width = e.width - (e.kind === 'checkbox' ? 58 : ['rectangle', 'ellipse'].includes(e.kind) ? 40 : 0);
    const text = `${layer.label}${layer.text ? `\n${layer.text}` : ''}`;
    const rows = text.split('\n');
    const used = rows.length * size * 1.3;
    if (rows.some(row => lines(row, size, width) > 1) || (e.kind !== 'sticker' && used > e.height)) return [{severity: 'error', sceneId: scene.id, target: layer.id, message: '开放白板文字超过显式槽位；缩短、手动分行或拆镜头。'}];
    return [];
  });
}
