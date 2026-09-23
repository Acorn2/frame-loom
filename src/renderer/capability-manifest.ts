import type {ActionId, LayerType, TemplateId, TransitionId} from '../schemas/storyboard';

export const CAPABILITY_MANIFEST = {
  templates: ['statement', 'graph-explainer', 'metric-grid', 'interaction-flow'] as TemplateId[],
  layers: ['node', 'card', 'label', 'annotation', 'metric', 'screenshot'] as LayerType[],
  actions: ['enter', 'reveal', 'draw', 'focus', 'highlight', 'count', 'camera-push'] as ActionId[],
  transitions: ['fade', 'slide', 'paper-wipe', 'carry'] as TransitionId[],
  actionTargets: {
    enter: ['node', 'card', 'label', 'annotation', 'metric', 'screenshot'],
    reveal: ['node', 'card', 'label', 'annotation', 'metric', 'screenshot'],
    draw: ['connection'],
    focus: ['node', 'card', 'label', 'annotation', 'metric', 'screenshot'],
    highlight: ['node', 'card', 'label', 'annotation', 'metric', 'screenshot', 'connection'],
    count: ['metric'],
    'camera-push': ['node', 'card', 'label', 'annotation', 'metric', 'screenshot']
  } as Record<ActionId, string[]>
} as const;
