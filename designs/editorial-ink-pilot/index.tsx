import React from 'react';
import {Composition, registerRoot} from 'remotion';
import plan from './scene-plan.json';
import {EditorialStudy} from './study';

registerRoot(() => <Composition id="EditorialInkStudy" component={EditorialStudy}
  width={plan.width} height={plan.height} fps={plan.fps}
  durationInFrames={plan.scenes.reduce((sum, scene) => sum + scene.seconds * plan.fps, 0)}/>);
