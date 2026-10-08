import type {StoryboardScene} from '../../schemas/storyboard';

export function hierarchyLayout(scene: StoryboardScene): Map<string, {x: number; y: number; width: number; height: number}> {
  if (scene.shot?.id !== 'diagram-cascade') throw new Error('hierarchy contract required');
  const levels = new Map([[scene.shot.slots.root, 0]]);
  for (const id of scene.shot.slots.items) {
    const parent = scene.connections.find((link) => link.to === id)?.from;
    if (!parent || !levels.has(parent)) throw new Error('parent must precede child');
    levels.set(id, levels.get(parent)! + 1);
  }
  const positions = new Map<string, {x: number; y: number; width: number; height: number}>();
  for (const level of new Set(levels.values())) {
    const ids = [...levels].filter(([, value]) => value === level).map(([id]) => id);
    const width = Math.min(330, 920 / ids.length - 20);
    ids.forEach((id, index) => positions.set(id, {x: 40 + (index + 0.5) * 920 / ids.length - width / 2, y: level * 165, width, height: 130}));
  }
  return positions;
}
