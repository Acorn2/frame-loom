import React from 'react';
import {RenderLayer} from '../../renderer/render-layer';
import type {StoryboardScene} from '../../schemas/storyboard';
import type {StyleTokens} from '../../styles/style-loader';
import {TemplateShell} from '../shared/TemplateShell';

export function MetricGridTemplate({
  scene,
  tokens,
  showSceneCaptions,
  overlapOutFrames
}: {scene: StoryboardScene; tokens: StyleTokens; showSceneCaptions: boolean; overlapOutFrames: number}) {
  return (
    <TemplateShell scene={scene} tokens={tokens} showSceneCaptions={showSceneCaptions} overlapOutFrames={overlapOutFrames} sectionLabel="FRAMELOOM / METRICS">
      {scene.layers.map((layer) => <RenderLayer key={layer.id} layer={layer} scene={scene} tokens={tokens} />)}
    </TemplateShell>
  );
}
