import React from 'react';
import {Composition, registerRoot} from 'remotion';
import plan from './scene-plan.json';
import {Study, type StudyProps} from './study';

const Root = () => <>{plan.films.map(film => <Composition
  key={film.id} id={film.id} component={Study}
  width={plan.width} height={plan.height} fps={plan.fps}
  durationInFrames={film.scenes.reduce((sum, scene) => sum + scene.seconds * plan.fps, 0)}
  defaultProps={{kind: film.slug as StudyProps['kind'], assets: {}}}
/>)}</>;

registerRoot(Root);
