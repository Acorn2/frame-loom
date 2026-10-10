export function expansionLayout(width: number, height: number, count: number) {
  const portrait = width < height;
  const gap = portrait ? 24 : 20;
  const inset = portrait ? 28 : 24;
  const queryHeight = portrait ? 112 : 100;
  const summaryHeight = portrait ? 154 : 112;
  const completionHeight = portrait ? 100 : 80;
  const columns = portrait ? 1 : 2;
  const rows = Math.ceil(count / columns);
  const itemHeight = (height - queryHeight - gap * (rows + 1)) / rows;
  const itemWidth = (width - gap * (columns - 1)) / columns;
  const streamHeight = (height - summaryHeight - completionHeight - gap * (count + 1)) / count;
  return {portrait, gap, inset, queryHeight, summaryHeight, completionHeight, columns, itemWidth, itemHeight,
    streamHeight, labelFont: portrait ? 40 : 36, textFont: portrait ? 30 : 28};
}

export type DotPoint = {x: number; y: number; group: number};
export function regroupPoints(values: number[], width: number, height: number, portrait: boolean): DotPoint[][] {
  const sum = values.reduce((a, b) => a + b, 0);
  const unitX = width / (portrait ? 30 : 58), unitY = height / (portrait ? 66 : 28);
  const max = Math.max(...values);
  const columns = Math.ceil(Math.sqrt(sum * (width / height)));
  const rows = Math.ceil(sum / columns);
  const starts = values.map((_, i) => values.slice(0, i).reduce((a, b) => a + b, 0));
  const groups = Array.from({length: sum}, (_, i) => values.findIndex((value, g) => i < starts[g]! + value));
  const points = (stage: number) => groups.map((group, index) => {
    const local = index - starts[group]!;
    if (stage === 0) return {group, x: width * (.08 + .84 * ((index * .61803398875) % 1)), y: height * (.14 + .72 * ((index * .41421356237) % 1))};
    if (stage === 3) return {group, x: width / 2 + (index % columns - (columns - 1) / 2) * unitX * 1.3,
      y: height / 2 + (Math.floor(index / columns) - (rows - 1) / 2) * unitY * 1.3};
    if (portrait) {
      const y = height * ((group + .5) / values.length);
      const perRow = stage === 1 ? 8 : Math.min(16, Math.max(1, Math.ceil(max / 4)));
      return {group, x: width * .38 + (local % perRow) * unitX,
        y: y + (Math.floor(local / perRow) - (Math.ceil(values[group]! / perRow) - 1) / 2) * unitY};
    }
    const x = width * ((group + .5) / values.length);
    const perRow = stage === 1 ? 8 : Math.max(4, Math.ceil(max / Math.max(1, Math.floor(height * .65 / 26))));
    return {group, x: x + (local % perRow - (perRow - 1) / 2) * unitX,
      y: stage === 1 ? height / 2 + (Math.floor(local / perRow) - (Math.ceil(values[group]! / perRow) - 1) / 2) * unitY
        : height * .8 - Math.floor(local / perRow) * unitY};
  });
  return [0, 1, 2, 3].map(points);
}
