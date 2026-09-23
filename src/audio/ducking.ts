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
  ducking
}: {
  frame: number;
  fps: number;
  baseVolume: number;
  voiceoverDurationSec?: number;
  ducking?: MusicDucking;
}): number {
  if (!ducking?.enabled || !voiceoverDurationSec || voiceoverDurationSec <= 0) return baseVolume;

  const seconds = Math.max(0, frame / fps);
  const duckedVolume = baseVolume * ducking.volume;
  const attackSec = Math.max(0, ducking.attackSec);
  const releaseSec = Math.max(0, ducking.releaseSec);
  const attackEnd = Math.min(attackSec, voiceoverDurationSec / 2);
  const releaseStart = Math.max(attackEnd, voiceoverDurationSec - releaseSec);

  if (seconds < attackEnd) {
    return mix(baseVolume, duckedVolume, seconds / attackEnd);
  }
  if (seconds < releaseStart) return duckedVolume;
  if (seconds < voiceoverDurationSec) {
    const releaseProgress = releaseSec === 0 ? 1 : (seconds - releaseStart) / releaseSec;
    return mix(duckedVolume, baseVolume, releaseProgress);
  }
  return baseVolume;
}
