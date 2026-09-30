import type {StoryboardScene} from '../schemas/storyboard';

const CONTENT_TYPES = new Set(['node', 'card', 'metric']);
const ATTENTION_ACTIONS = new Set(['enter', 'reveal', 'count', 'focus', 'highlight']);
const clamp = (value: number) => Math.max(0, Math.min(1, value));

function attentionEvents(scene: StoryboardScene) {
  const contentIds = new Set(scene.layers.filter((layer) => CONTENT_TYPES.has(layer.type)).map((layer) => layer.id));
  const ordered = scene.beats.filter((beat) => contentIds.has(beat.target) && ATTENTION_ACTIONS.has(beat.action))
    .sort((left, right) => left.start - right.start);
  return ordered.filter((beat, index) => beat.target !== ordered[index - 1]?.target);
}

export function getAttentionTarget(scene: StoryboardScene, frame: number): string | undefined {
  return attentionEvents(scene).filter((beat) => beat.start <= frame).at(-1)?.target;
}

export function getAttentionOpacity(scene: StoryboardScene, target: string, frame: number): number {
  const events = attentionEvents(scene).filter((beat) => beat.start <= frame);
  const current = events.at(-1);
  if (!current) return 1;
  const previous = events.slice(0, -1).reverse().find((beat) => beat.target !== current.target);
  const progress = clamp((frame - current.start) / Math.min(12, current.duration));
  const eased = progress * progress * (3 - 2 * progress);
  if (target === current.target) return 0.72 + 0.28 * eased;
  if (target === previous?.target) return 1 - 0.28 * eased;
  return 0.72;
}
