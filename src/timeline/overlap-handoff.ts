const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smoothstep = (value: number) => {
  const progress = clamp(value);
  return progress * progress * (3 - 2 * progress);
};

// Fade each information state against the Style Pack background in separate
// halves of the overlap, so two sets of titles never compete on one frame.
export function overlapHandoffOpacity({
  frame,
  durationFrames,
  overlapInFrames,
  overlapOutFrames
}: {
  frame: number;
  durationFrames: number;
  overlapInFrames: number;
  overlapOutFrames: number;
}): number {
  const incoming = overlapInFrames > 0
    ? smoothstep((frame / overlapInFrames - 0.5) * 2)
    : 1;
  const outgoing = overlapOutFrames > 0
    ? 1 - smoothstep(((frame - (durationFrames - overlapOutFrames)) / overlapOutFrames) * 2)
    : 1;
  return incoming * outgoing;
}
