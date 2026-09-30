export interface MusicDucking {
  enabled: boolean;
  volume: number;
  attackSec: number;
  releaseSec: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function mix(from: number, to: number, progress: number): number {
  return from + (to - from) * clamp(progress, 0, 1);
}

export function getMusicVolumeAtFrame({
  frame,
  fps,
  baseVolume,
  voiceoverDurationSec,
  ducking,
  videoDurationSec,
  fadeInSec = 1,
  fadeOutSec = 2
}: {
  frame: number;
  fps: number;
  baseVolume: number;
  voiceoverDurationSec?: number;
  ducking?: MusicDucking;
  videoDurationSec?: number;
  fadeInSec?: number;
  fadeOutSec?: number;
}): number {
  const seconds = Math.max(0, frame / fps);
  let volume = baseVolume;
  if (ducking?.enabled && voiceoverDurationSec && voiceoverDurationSec > 0) {
    const duckedVolume = baseVolume * ducking.volume;
    const attackSec = Math.max(0, ducking.attackSec);
    const releaseSec = Math.max(0, ducking.releaseSec);
    const attackEnd = Math.min(attackSec, voiceoverDurationSec / 2);

    if (seconds < attackEnd) {
      volume = mix(baseVolume, duckedVolume, attackEnd === 0 ? 1 : seconds / attackEnd);
    } else if (seconds < voiceoverDurationSec) {
      volume = duckedVolume;
    } else if (seconds < voiceoverDurationSec + releaseSec) {
      volume = mix(duckedVolume, baseVolume, releaseSec === 0 ? 1 : (seconds - voiceoverDurationSec) / releaseSec);
    }
  }
  if (!videoDurationSec || videoDurationSec <= 0) return volume;
  const fadeIn = fadeInSec > 0 ? clamp(seconds / fadeInSec, 0, 1) : 1;
  const fadeOut = fadeOutSec > 0 ? clamp((videoDurationSec - seconds) / fadeOutSec, 0, 1) : 1;
  return volume * Math.min(fadeIn, fadeOut);
}
