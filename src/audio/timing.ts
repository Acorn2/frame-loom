import type {CaptionCue} from './captions';

export interface AudioTrackTiming {
  id: string;
  kind: 'voiceover' | 'music' | 'sfx';
  startSec: number;
  durationSec: number;
  loudness?: AudioLoudness;
}

export interface AudioLoudness {
  integratedLufs: number;
  truePeakDb: number;
  loudnessRangeDb: number;
}

export interface AudioTimingIssue {
  severity: 'error' | 'warning';
  path: string;
  message: string;
}

export interface AudioTimingReport {
  videoDurationSec: number;
  tracks: Array<AudioTrackTiming & {endSec: number}>;
  captions: {count: number; endSec: number};
  maxContentEndSec: number;
  needsRetiming: boolean;
  issues: AudioTimingIssue[];
}

export function analyzeSceneAudioAlignment(
  scenes: Array<{sceneId: string; startSec: number; endSec: number}>,
  segments: Array<{sceneId: string; startSec: number; endSec: number}>,
  maxTrailingGapSec = 0.5
) {
  const issues: string[] = [];
  const ordered = [...segments].sort((a, b) => a.startSec - b.startSec);
  let previous: typeof ordered[number] | undefined;
  const ids = new Set<string>();
  for (const segment of ordered) {
    if (ids.has(segment.sceneId)) issues.push(`${segment.sceneId}: 重复旁白片段。`);
    ids.add(segment.sceneId);
    if (!Number.isFinite(segment.startSec) || !Number.isFinite(segment.endSec) || segment.startSec < 0 || segment.endSec <= segment.startSec) {
      issues.push(`${segment.sceneId}: 无效旁白时间区间。`);
    }
    if (!scenes.some((scene) => scene.sceneId === segment.sceneId)) issues.push(`${segment.sceneId}: 旁白没有对应镜头。`);
    if (previous && segment.startSec < previous.endSec - 0.001) issues.push(`${previous.sceneId} / ${segment.sceneId}: 相邻旁白重叠 ${(previous.endSec - segment.startSec).toFixed(3)}s。`);
    if (!previous || segment.endSec > previous.endSec) previous = segment;
  }
  const measurements = scenes.map((scene) => {
    const segment = segments.find((item) => item.sceneId === scene.sceneId);
    if (!segment) {
      issues.push(`${scene.sceneId}: 缺少对应旁白片段。`);
      return {sceneId: scene.sceneId, startDeltaSec: null, trailingGapSec: null};
    }
    const startDeltaSec = segment.startSec - scene.startSec;
    const trailingGapSec = scene.endSec - segment.endSec;
    if (Math.abs(startDeltaSec) > 0.1) issues.push(`${scene.sceneId}: 旁白起点与镜头相差 ${startDeltaSec.toFixed(3)}s。`);
    if (trailingGapSec > maxTrailingGapSec) issues.push(`${scene.sceneId}: 旁白结束后画面仍停留 ${trailingGapSec.toFixed(3)}s。`);
    if (trailingGapSec < -0.08) issues.push(`${scene.sceneId}: 旁白超出镜头 ${(-trailingGapSec).toFixed(3)}s。`);
    return {sceneId: scene.sceneId, startDeltaSec, trailingGapSec};
  });
  return {passed: issues.length === 0, measurements, issues};
}

export function analyzeAudioTiming(
  videoDurationSec: number,
  tracks: AudioTrackTiming[],
  captions: CaptionCue[],
  toleranceSec = 0.08
): AudioTimingReport {
  const issues: AudioTimingIssue[] = [];
  const measuredTracks = tracks.map((track) => ({...track, endSec: track.startSec + track.durationSec}));

  for (const track of measuredTracks) {
    if (track.durationSec <= 0) {
      issues.push({severity: 'error', path: `tracks.${track.id}`, message: '音频时长必须大于 0。'});
      continue;
    }
    if (track.kind !== 'music' && track.endSec > videoDurationSec + toleranceSec) {
      issues.push({
        severity: 'error',
        path: `tracks.${track.id}`,
        message: `${track.kind} 在 ${track.endSec.toFixed(3)}s 结束，超出视频 ${videoDurationSec.toFixed(3)}s。`
      });
    }
    if (track.kind === 'music' && track.endSec < videoDurationSec - toleranceSec) {
      issues.push({
        severity: 'warning',
        path: `tracks.${track.id}`,
        message: `背景音乐在 ${track.endSec.toFixed(3)}s 结束，视频尾部将有 ${(videoDurationSec - track.endSec).toFixed(3)}s 无音乐。`
      });
    }
  }

  let previousEnd = 0;
  for (const [index, cue] of captions.entries()) {
    if (cue.startSec < previousEnd - toleranceSec) {
      issues.push({severity: 'error', path: `captions.${index}`, message: '字幕时间与上一条重叠。'});
    }
    if (cue.endSec > videoDurationSec + toleranceSec) {
      issues.push({
        severity: 'error',
        path: `captions.${index}`,
        message: `字幕在 ${cue.endSec.toFixed(3)}s 结束，超出视频 ${videoDurationSec.toFixed(3)}s。`
      });
    }
    previousEnd = Math.max(previousEnd, cue.endSec);
  }

  const captionsEndSec = captions.at(-1)?.endSec ?? 0;
  const contentTrackEnds = measuredTracks.filter((track) => track.kind !== 'music').map((track) => track.endSec);
  const maxContentEndSec = Math.max(0, captionsEndSec, ...contentTrackEnds);
  return {
    videoDurationSec,
    tracks: measuredTracks,
    captions: {count: captions.length, endSec: captionsEndSec},
    maxContentEndSec,
    needsRetiming: issues.some((item) => item.severity === 'error'),
    issues
  };
}
