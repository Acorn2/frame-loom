import type {ActionId, LayerType, TemplateId, TransitionId, SceneVisual} from '../schemas/storyboard';

export const CAPABILITY_MANIFEST = {
  semanticExtensions: {networkDirection: ['outward', 'inward'], changeMode: ['compare', 'replace'], mediaFocus: true},
  purposes: ['opening', 'claim', 'process', 'evidence', 'media', 'closing'],
  templates: ['statement', 'graph-explainer', 'metric-grid', 'interaction-flow'] as TemplateId[],
  visualKinds: ['statement', 'compare', 'sequence', 'network', 'change', 'metric', 'media'] as SceneVisual['kind'][],
  layers: ['node', 'card', 'label', 'annotation', 'metric', 'screenshot', 'object', 'callout'] as LayerType[],
  actions: ['enter', 'reveal', 'draw', 'focus', 'highlight', 'count', 'camera-push', 'rotate', 'set-state'] as ActionId[],
  transitions: ['fade', 'slide', 'paper-wipe', 'carry'] as TransitionId[],
  overlapTransitions: ['overlap-fade', 'overlap-slide', 'overlap-carry'],
  actionTargets: {
    enter: ['node', 'card', 'label', 'annotation', 'metric', 'screenshot', 'object', 'callout'],
    reveal: ['node', 'card', 'label', 'annotation', 'metric', 'screenshot', 'object', 'callout'],
    draw: ['connection'],
    focus: ['node', 'card', 'label', 'annotation', 'metric', 'screenshot', 'object', 'callout'],
    highlight: ['node', 'card', 'label', 'annotation', 'metric', 'screenshot', 'object', 'callout', 'connection'],
    count: ['metric'],
    'camera-push': ['node', 'card', 'label', 'annotation', 'metric', 'screenshot', 'object'],
    rotate: ['object'],
    'set-state': ['node']
  } as Record<ActionId, string[]>
} as const;
