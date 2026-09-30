import React from 'react';
import {AbsoluteFill, Audio, Sequence, useVideoConfig} from 'remotion';
import type {Storyboard} from '../schemas/storyboard';
import {RenderScene} from '../renderer/render-scene';
import {getDefaultStyleTokens, type StyleTokens} from '../styles/style-loader';
import {CaptionOverlay} from '../audio/CaptionOverlay';
import type {CaptionCue} from '../audio/captions';
import {getMusicVolumeAtFrame, type MusicDucking} from '../audio/ducking';
import {getSceneTimeline} from '../timeline/scene-timeline';

export interface AudioRuntime {
  voiceoverDataUri?: string;
  voiceoverVolume?: number;
  musicDataUri?: string;
  musicVolume?: number;
  musicDucking?: MusicDucking;
  musicFadeInSec?: number;
  musicFadeOutSec?: number;
  voiceoverDurationSec?: number;
  captions?: CaptionCue[];
  sfx?: Array<{dataUri: string; volume: number; startSec: number}>;
}

export interface DataDrivenVideoProps extends Record<string, unknown> {
  storyboard: Storyboard;
  styleTokens?: StyleTokens;
  audioRuntime?: AudioRuntime;
  renderProfile?: {
    purpose: 'visual-preview' | 'visual-master' | 'in-project-video';
    showReviewMarker?: boolean;
    facecamRightFraction?: number;
    subtitleBottomFraction?: number;
  };
}

export function shouldRenderSceneCaptions(audioRuntime?: AudioRuntime): boolean {
  return !(audioRuntime?.captions && audioRuntime.captions.length > 0);
}

export function shouldRenderReviewMarker(profile?: DataDrivenVideoProps['renderProfile']): boolean {
  return profile?.purpose === 'visual-master' ? false : profile?.showReviewMarker ?? profile?.purpose !== 'in-project-video';
}

export function DataDrivenVideo({storyboard, styleTokens, audioRuntime, renderProfile}: DataDrivenVideoProps) {
  const tokens = styleTokens ?? getDefaultStyleTokens(storyboard.project.width, storyboard.project.height);
  const cleanMaster = renderProfile?.purpose === 'visual-master';
  const showSceneCaptions = !cleanMaster && shouldRenderSceneCaptions(audioRuntime);
  const musicVolume = audioRuntime?.musicVolume ?? 0.2;
  const timeline = getSceneTimeline(storyboard);
  const scale = cleanMaster ? Math.min(
    1 - (renderProfile?.facecamRightFraction ?? 0),
    1 - (renderProfile?.subtitleBottomFraction ?? 0)
  ) : 1;

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
            ducking: audioRuntime.musicDucking,
            videoDurationSec: storyboard.project.durationFrames / storyboard.project.fps,
            fadeInSec: audioRuntime.musicFadeInSec,
            fadeOutSec: audioRuntime.musicFadeOutSec
          })}
        />
      ) : null}
      {audioRuntime?.sfx?.map((item, index) => (
        <Sequence key={`${item.startSec}-${index}`} from={Math.round(item.startSec * storyboard.project.fps)}>
          <Audio src={item.dataUri} volume={item.volume} />
        </Sequence>
      ))}
      {timeline.map(({scene, startFrame, overlapOutFrames}) => {
        return (
          <Sequence key={scene.id} from={startFrame} durationInFrames={scene.durationFrames}>
            <div style={{position: 'absolute', width: '100%', height: '100%', transform: scale < 1 ? `scale(${scale})` : undefined, transformOrigin: 'top left'}}>
              <RenderScene scene={scene} tokens={tokens} showSceneCaptions={showSceneCaptions} externalCaptions={!cleanMaster && Boolean(audioRuntime?.captions?.length)} overlapOutFrames={overlapOutFrames} />
            </div>
          </Sequence>
        );
      })}
      {shouldRenderReviewMarker(renderProfile) ? <div style={{
        position: 'absolute',
        right: 32,
        top: 26,
        fontFamily: tokens.bodyFont,
        fontSize: 14,
        color: tokens.muted,
        letterSpacing: 1
      }}>
        {audioRuntime?.voiceoverDataUri || audioRuntime?.musicDataUri || audioRuntime?.sfx?.length ? 'AUDIO PILOT' : 'SILENT PREVIEW'}
      </div> : null}
      {!cleanMaster && audioRuntime?.captions ? <CaptionOverlay captions={audioRuntime.captions} tokens={tokens} /> : null}
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
