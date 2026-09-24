import React from 'react';
import type {StoryboardScene} from '../schemas/storyboard';
import type {StyleTokens} from '../styles/style-loader';
import {StatementTemplate} from '../templates/statement/StatementTemplate';
import {GraphExplainerTemplate} from '../templates/graph-explainer/GraphExplainerTemplate';
import {InteractionFlowTemplate} from '../templates/interaction-flow/InteractionFlowTemplate';
import {MetricGridTemplate} from '../templates/metric-grid/MetricGridTemplate';
import {TemplateFamilyScene} from '../templates/families/TemplateFamilyScene';
import {isTemplateFamily} from '../templates/families/family-registry';

interface RenderSceneProps {
  scene: StoryboardScene;
  tokens: StyleTokens;
  showSceneCaptions: boolean;
  externalCaptions?: boolean;
  overlapOutFrames: number;
}

export function RenderScene({scene, tokens, showSceneCaptions, externalCaptions, overlapOutFrames}: RenderSceneProps) {
  const props = {scene, tokens, showSceneCaptions, overlapOutFrames};
  if (scene.purpose && isTemplateFamily(tokens.id)) {
    return <TemplateFamilyScene {...props} externalCaptions={externalCaptions} />;
  }
  if (scene.template === 'statement') {
    return <StatementTemplate {...props} />;
  }
  if (scene.template === 'graph-explainer') {
    return <GraphExplainerTemplate {...props} />;
  }
  if (scene.template === 'metric-grid') {
    return <MetricGridTemplate {...props} />;
  }
  if (scene.template === 'interaction-flow') {
    return <InteractionFlowTemplate {...props} />;
  }
  throw new Error(`Template "${scene.template}" is declared but not implemented by the current renderer.`);
}
