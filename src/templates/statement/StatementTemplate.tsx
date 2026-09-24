import React from 'react';
import type {StoryboardScene} from '../../schemas/storyboard';
import type {StyleTokens} from '../../styles/style-loader';
import {RenderLayer} from '../../renderer/render-layer';
import {TemplateShell} from '../shared/TemplateShell';

interface StatementTemplateProps {
  scene: StoryboardScene;
  tokens: StyleTokens;
  showSceneCaptions: boolean;
  overlapOutFrames: number;
}

export function StatementTemplate({scene, tokens, showSceneCaptions, overlapOutFrames}: StatementTemplateProps) {
  return (
    <TemplateShell scene={scene} tokens={tokens} showSceneCaptions={showSceneCaptions} overlapOutFrames={overlapOutFrames} sectionLabel="FRAMELOOM / STATEMENT">
      {scene.layers.map((layer) => <RenderLayer key={layer.id} layer={layer} scene={scene} tokens={tokens} />)}
    </TemplateShell>
  );
}
