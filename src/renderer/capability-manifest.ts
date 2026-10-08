import {SHOT_IDS} from '../schemas/shot-recipe';
import type {ActionId, LayerType, TemplateId, TransitionId, SceneVisual} from '../schemas/storyboard';

export const CAPABILITY_MANIFEST = {
  shots: SHOT_IDS,
  auxiliaryRecipes: ['marker-underline', 'outline-trace', 'paper-tape', 'card-flip', 'scanline-annotate-focus', 'scan-bracket-sweep', 'line-boil', 'speed-ramp-freeze', 'mosaic-reframe'],
  chapterTransitions: ['blinds-wipe', 'bottom-push', 'line-carry-transition', 'print-texture-transitions', 'page-turn-transitions'],
  videoTemplates: ['retro-zine-explainer'],
  semanticExtensions: {networkDirection: ['outward', 'inward'], changeMode: ['compare', 'replace'], mediaFocus: true, shotPattern: ['document-conclusion-deal']},
  purposes: ['opening', 'claim', 'process', 'evidence', 'media', 'closing'],
  templates: ['statement', 'graph-explainer', 'metric-grid', 'interaction-flow'] as TemplateId[],
  visualKinds: ['statement', 'compare', 'sequence', 'network', 'change', 'metric', 'media'] as SceneVisual['kind'][],
  layers: ['node', 'card', 'label', 'annotation', 'metric', 'screenshot', 'object', 'callout'] as LayerType[],
  actions: ['enter', 'reveal', 'draw', 'focus', 'highlight', 'count', 'camera-push', 'rotate', 'set-state', 'dock', 'demote', 'trace', 'tape'] as ActionId[],
  transitions: ['fade', 'slide', 'paper-wipe', 'carry'] as TransitionId[],
  overlapTransitions: ['overlap-fade', 'overlap-slide', 'overlap-carry', 'overlap-blinds', 'overlap-push-stack', 'overlap-line-carry', 'overlap-ink', 'overlap-barn-door'],
  actionTargets: {
    trace: ['node', 'card'],
    tape: ['node', 'card'],
    dock: ['node', 'card'],
    demote: ['label'],
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
