import type {StoryboardLayer, StoryboardScene} from '../schemas/storyboard';

export type NodeState = NonNullable<StoryboardLayer['state']>;

export function getNodeState(layer: StoryboardLayer, scene: StoryboardScene, frame: number): NodeState | undefined {
  if (layer.type !== 'node') return undefined;
  const latest = scene.beats
    .filter((beat) => beat.target === layer.id && beat.action === 'set-state' && beat.start <= frame)
    .sort((a, b) => b.start - a.start)[0];
  return latest?.state ?? layer.state;
}
