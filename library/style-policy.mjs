// The three primary styles own their production recipes. These are internal
// capabilities, not a user-editable shot collection or a required scene order.
const illustrated = Object.freeze(['illustrated-hero', 'illustrated-explain', 'illustrated-compare', 'illustrated-process', 'illustrated-breakdown', 'illustrated-metric']);
const fixed = Object.freeze({whiteboard: Object.freeze(['whiteboard-board']), 'flat-explainer': illustrated, 'paper-collage': illustrated, 'annotated-reasoning': Object.freeze(['annotated-manuscript', 'semantic-default']), 'editorial-typography': Object.freeze(['editorial-flow', 'semantic-default'])});
export const fixedStyleRecipeIds = style => Object.hasOwn(fixed, style) ? fixed[style] : undefined;
export const isFixedStyle = style => Object.hasOwn(fixed, style);
