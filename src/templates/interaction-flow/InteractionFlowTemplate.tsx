import React from 'react';
import {RenderLayer} from '../../renderer/render-layer';
import type {StoryboardScene} from '../../schemas/storyboard';
import type {StyleTokens} from '../../styles/style-loader';
import {TemplateShell} from '../shared/TemplateShell';

export function InteractionFlowTemplate({
  scene,
  tokens,
  showSceneCaptions
}: {scene: StoryboardScene; tokens: StyleTokens; showSceneCaptions: boolean}) {
  return (
    <TemplateShell scene={scene} tokens={tokens} showSceneCaptions={showSceneCaptions} sectionLabel="FRAMELOOM / INTERACTION">
      {scene.layers.map((layer) => <RenderLayer key={layer.id} layer={layer} scene={scene} tokens={tokens} />)}
    </TemplateShell>
  );
}
