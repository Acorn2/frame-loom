// Pixel Notes keeps readable text still and reveals subjects as square blocks.
// The legacy style ID remains compatible with existing selection files.
export function illustratedProgress(frame: number, start: number, duration: number, _style: string): number {
  const elapsed = Math.max(0, frame - start);
  if (elapsed >= duration) return 1;
  return elapsed / duration;
}

export function pixelRevealBlocks(progress: number, aspect = 1.5) {
  const columns = 12, rows = Math.max(1, Math.round(columns / aspect));
  const blocks = [];
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    // Diagonal sweep with a fixed interleave; seeking never changes the mask.
    const rank = (column + row) / (columns + rows - 2) * .78 + ((column * 7 + row * 11) % 5) / 5 * .18;
    if (progress >= 1 || progress > rank) blocks.push({x: column / columns, y: row / rows, width: 1 / columns, height: 1 / rows});
  }
  return blocks;
}

export function pixelEmphasisOpacity(progress: number): number {
  return progress > 0 && progress < 1 ? Math.sin(Math.PI * progress) : 0;
}
