import React, {useEffect, useState} from 'react';
import {continueRender, delayRender, Img} from 'remotion';
import type {SceneVisual} from '../../schemas/storyboard';

export function FocusedMedia({src, focus, frame, width, height}: {src: string; focus: NonNullable<SceneVisual['mediaFocus']>; frame: number; width: number; height: number}) {
  const [handle] = useState(() => delayRender('Measure source image for focus'));
  const [ratio, setRatio] = useState<number>();
  useEffect(() => {if (ratio) continueRender(handle);}, [ratio, handle]);
  const p = 1 - (1 - Math.max(0, Math.min(1, (frame - focus.start) / focus.duration))) ** 3;
  const imageWidth = ratio ? Math.min(width, height * ratio) : width;
  const imageHeight = ratio ? imageWidth / ratio : height;
  const zoom = 1 + (Math.min(width / (imageWidth * focus.width), height / (imageHeight * focus.height)) - 1) * p;
  const x = (0.5 - focus.x - focus.width / 2) * imageWidth * p;
  const y = (0.5 - focus.y - focus.height / 2) * imageHeight * p;
  return <Img src={src} onLoad={(event) => setRatio(event.currentTarget.naturalWidth / event.currentTarget.naturalHeight)} style={{
    position: 'absolute', left: '50%', top: '50%', width: imageWidth, height: imageHeight,
    clipPath: `inset(${focus.y * p * 100}% ${(1 - focus.x - focus.width) * p * 100}% ${(1 - focus.y - focus.height) * p * 100}% ${focus.x * p * 100}%)`,
    transform: `translate(-50%, -50%) scale(${zoom}) translate(${x}px, ${y}px)`
  }} />;
}
