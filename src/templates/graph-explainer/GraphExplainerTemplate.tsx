import React from 'react';
import {RenderConnection} from '../../renderer/render-connection';
import {RenderLayer} from '../../renderer/render-layer';
import type {StoryboardScene} from '../../schemas/storyboard';
import type {StyleTokens} from '../../styles/style-loader';
import {TemplateShell} from '../shared/TemplateShell';

export function GraphExplainerTemplate({
  scene,
  tokens,
  showSceneCaptions,
  overlapOutFrames
}: {scene: StoryboardScene; tokens: StyleTokens; showSceneCaptions: boolean; overlapOutFrames: number}) {
  return (
    <TemplateShell scene={scene} tokens={tokens} showSceneCaptions={showSceneCaptions} overlapOutFrames={overlapOutFrames} sectionLabel="FRAMELOOM / RELATIONSHIPS">
      {scene.connections.map((connection) => (
        <RenderConnection key={connection.id} connection={connection} scene={scene} tokens={tokens} />
      ))}
      {scene.layers.map((layer) => <RenderLayer key={layer.id} layer={layer} scene={scene} tokens={tokens} />)}
    </TemplateShell>
  );
}
