import React from 'react';
import {AbsoluteFill, Audio, Sequence, useVideoConfig} from 'remotion';
import type {Storyboard} from '../schemas/storyboard';
import {RenderScene} from '../renderer/render-scene';
import {getDefaultStyleTokens, type StyleTokens} from '../styles/style-loader';
import {CaptionOverlay} from '../audio/CaptionOverlay';
import type {CaptionCue} from '../audio/captions';
import {getMusicVolumeAtFrame, type MusicDucking} from '../audio/ducking';

export interface AudioRuntime {
  voiceoverDataUri?: string;
  voiceoverVolume?: number;
  musicDataUri?: string;
  musicVolume?: number;
  musicDucking?: MusicDucking;
  voiceoverDurationSec?: number;
  captions?: CaptionCue[];
  sfx?: Array<{dataUri: string; volume: number; startSec: number}>;
}

export interface DataDrivenVideoProps extends Record<string, unknown> {
  storyboard: Storyboard;
  styleTokens?: StyleTokens;
  audioRuntime?: AudioRuntime;
}

export function shouldRenderSceneCaptions(audioRuntime?: AudioRuntime): boolean {
  return !(audioRuntime?.captions && audioRuntime.captions.length > 0);
}

export function DataDrivenVideo({storyboard, styleTokens, audioRuntime}: DataDrivenVideoProps) {
  const tokens = styleTokens ?? getDefaultStyleTokens(storyboard.project.width, storyboard.project.height);
  const showSceneCaptions = shouldRenderSceneCaptions(audioRuntime);
  const musicVolume = audioRuntime?.musicVolume ?? 0.2;
  let sceneStart = 0;

  return (
    <AbsoluteFill style={{backgroundColor: tokens.background}}>
      {audioRuntime?.voiceoverDataUri ? <Audio src={audioRuntime.voiceoverDataUri} volume={audioRuntime.voiceoverVolume ?? 1} /> : null}
      {audioRuntime?.musicDataUri ? (
        <Audio
          src={audioRuntime.musicDataUri}
          volume={(frame) => getMusicVolumeAtFrame({
            frame,
            fps: storyboard.project.fps,
            baseVolume: musicVolume,
            voiceoverDurationSec: audioRuntime.voiceoverDurationSec,
            ducking: audioRuntime.musicDucking
          })}
        />
      ) : null}
      {audioRuntime?.sfx?.map((item, index) => (
        <Sequence key={`${item.startSec}-${index}`} from={Math.round(item.startSec * storyboard.project.fps)}>
          <Audio src={item.dataUri} volume={item.volume} />
        </Sequence>
      ))}
      {storyboard.scenes.map((scene) => {
        const start = sceneStart;
        sceneStart += scene.durationFrames;
        return (
          <Sequence key={scene.id} from={start} durationInFrames={scene.durationFrames}>
            <RenderScene scene={scene} tokens={tokens} showSceneCaptions={showSceneCaptions} />
          </Sequence>
        );
      })}
      <div style={{
        position: 'absolute',
        right: 32,
        bottom: 24,
        fontFamily: tokens.bodyFont,
        fontSize: 14,
        color: tokens.muted,
        letterSpacing: 1
      }}>
        {audioRuntime?.voiceoverDataUri || audioRuntime?.musicDataUri || audioRuntime?.sfx?.length ? 'AUDIO PILOT' : 'SILENT PREVIEW'}
      </div>
      {audioRuntime?.captions ? <CaptionOverlay captions={audioRuntime.captions} tokens={tokens} /> : null}
    </AbsoluteFill>
  );
}

export function getCompositionMetadata({storyboard}: DataDrivenVideoProps) {
  return {
    durationInFrames: storyboard.project.durationFrames,
    fps: storyboard.project.fps,
    width: storyboard.project.width,
    height: storyboard.project.height
  };
}
