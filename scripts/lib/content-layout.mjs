import {loadStylePack} from './style-catalog.mjs';
import {sceneRegions, networkRects, overlaps, layoutSignature} from '../../src/layout/scene-layout.ts';

export function checkContentLayout(board) {
  if (!board.layoutPolicy) return [];
  const style = loadStylePack(board.style.id), {width, height} = board.project;
  const portrait = width < height, scale = width / (portrait ? 1080 : 1920);
  const safeArea = style.safeArea[portrait ? 'portrait' : 'landscape'];
  const issues = [];
  for (const scene of board.scenes) {
    const regions = sceneRegions({width, height, safeArea, captions: true, media: scene.visual.kind === 'media'});
    if (regions.body.width <= 0 || regions.body.height <= 0) issues.push({severity: 'error', sceneId: scene.id, layerId: 'body', message: '正文区不可用；请调整画幅或拆分内容。'});
    if (scene.visual.kind === 'network' && ['semantic-default', 'network-expand'].includes(scene.shot.id)) {
      const count = scene.layers.filter(layer => ['node', 'card'].includes(layer.type) && layer.id !== scene.visual.anchorId).length;
      const nodes = networkRects(count, regions.body.width, regions.body.height, scale, scene.visual.networkDirection === 'inward');
      for (const node of nodes.branches) if (overlaps(nodes.anchor, node)) issues.push({severity: 'error', sceneId: scene.id, layerId: 'nodes', message: '关系节点布局相互遮挡。'});
    }
  }
  let run = 1;
  for (let i = 1; i < board.scenes.length; i++) {
    run = layoutSignature(board.scenes[i]) === layoutSignature(board.scenes[i - 1]) ? run + 1 : 1;
    if (run === 4) issues.push({severity: 'warning', sceneId: board.scenes[i].id, layerId: 'composition', message: '连续四场使用同一布局结构；在 shot-map.md 核对连续比较的必要性与实际内容变化，不靠更换配方名称消除提示。'});
  }
  return issues;
}
