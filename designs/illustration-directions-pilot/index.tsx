import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {IllustrationStudy} from './study';

registerRoot(() => <>
  <Composition id="AnnotatedIllustrationStudy" component={IllustrationStudy} width={1920} height={1080} fps={30} durationInFrames={900} defaultProps={{kind: 'annotated', assets: {}}}/>
  <Composition id="SceneNarrativeStudy" component={IllustrationStudy} width={1920} height={1080} fps={30} durationInFrames={900} defaultProps={{kind: 'narrative', assets: {}}}/>
</>);
