import React from 'react';
import type {StoryboardScene} from '../schemas/storyboard';
import type {StyleTokens} from '../styles/style-loader';
import {StatementTemplate} from '../templates/statement/StatementTemplate';
import {GraphExplainerTemplate} from '../templates/graph-explainer/GraphExplainerTemplate';
import {InteractionFlowTemplate} from '../templates/interaction-flow/InteractionFlowTemplate';
import {MetricGridTemplate} from '../templates/metric-grid/MetricGridTemplate';

interface RenderSceneProps {
  scene: StoryboardScene;
  tokens: StyleTokens;
  showSceneCaptions: boolean;
}

export function RenderScene({scene, tokens, showSceneCaptions}: RenderSceneProps) {
  if (scene.template === 'statement') {
    return <StatementTemplate scene={scene} tokens={tokens} showSceneCaptions={showSceneCaptions} />;
  }
  if (scene.template === 'graph-explainer') {
    return <GraphExplainerTemplate scene={scene} tokens={tokens} showSceneCaptions={showSceneCaptions} />;
  }
  if (scene.template === 'metric-grid') {
    return <MetricGridTemplate scene={scene} tokens={tokens} showSceneCaptions={showSceneCaptions} />;
  }
  if (scene.template === 'interaction-flow') {
    return <InteractionFlowTemplate scene={scene} tokens={tokens} showSceneCaptions={showSceneCaptions} />;
  }
  throw new Error(`Template "${scene.template}" is declared but not implemented by the current renderer.`);
}
