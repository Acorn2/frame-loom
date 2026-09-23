import React from 'react';
import {Composition} from 'remotion';
import {z} from 'zod';
import sampleStoryboardJson from '../examples/article-video/storyboard.json' with {type: 'json'};
import type {Storyboard} from './schemas/storyboard';
import {DataDrivenVideo, getCompositionMetadata, type DataDrivenVideoProps} from './compositions/DataDrivenVideo';
import {getDefaultStyleTokens} from './styles/style-loader';

const sampleStoryboard = sampleStoryboardJson as unknown as Storyboard;
const propsSchema = z.object({
  storyboard: z.custom<Storyboard>()
});

export function Root() {
  return (
    <Composition<typeof propsSchema, DataDrivenVideoProps>
      id="StoryboardV2"
      schema={propsSchema}
      component={DataDrivenVideo}
      durationInFrames={sampleStoryboard.project.durationFrames}
      fps={sampleStoryboard.project.fps}
      width={sampleStoryboard.project.width}
      height={sampleStoryboard.project.height}
      defaultProps={{
        storyboard: sampleStoryboard,
        styleTokens: getDefaultStyleTokens(sampleStoryboard.project.width, sampleStoryboard.project.height)
      }}
      calculateMetadata={({props}) => getCompositionMetadata(props)}
    />
  );
}
