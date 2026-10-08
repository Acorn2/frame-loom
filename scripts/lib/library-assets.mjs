import fs from 'node:fs';
import path from 'node:path';
// Public samples use the same local bytes as production. Asset validation runs first.
export function fixtureAssets(storyboardPath) {
  const board = JSON.parse(fs.readFileSync(storyboardPath, 'utf8'));
  return board.scenes.flatMap(scene => scene.layers.filter(layer => layer.asset).map(layer => path.resolve(path.dirname(storyboardPath), layer.asset)));
}
export function hydrateLibraryAssets(board, storyboardPath) {
  const copy = structuredClone(board);
  const mime = {'.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp'};
  for (const scene of copy.scenes) for (const layer of scene.layers) if (layer.asset) {
    const file = path.resolve(path.dirname(storyboardPath), layer.asset), type = mime[path.extname(file).toLowerCase()];
    if (!type) throw new Error(`Unsupported public image format: ${path.extname(file)}`);
    layer.assetDataUri = `data:${type};base64,${fs.readFileSync(file).toString('base64')}`;
  }
  return copy;
}
