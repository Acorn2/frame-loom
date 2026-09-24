import type {StoryboardLayer} from '../schemas/storyboard';

type Point = {x: number; y: number};
type Direction = 'right' | 'left' | 'down' | 'up';

export interface ConnectionGeometry {
  from: Point;
  to: Point;
  path: string;
  label: Point;
  arrow: string;
  direction: Direction;
}

function box(layer: StoryboardLayer) {
  const x = layer.x ?? 0;
  const y = layer.y ?? 0;
  const width = layer.width ?? 240;
  const height = layer.height ?? 120;
  return {left: x, top: y, right: x + width, bottom: y + height, cx: x + width / 2, cy: y + height / 2};
}

export function getConnectionGeometry(fromLayer: StoryboardLayer, toLayer: StoryboardLayer): ConnectionGeometry {
  const fromBox = box(fromLayer);
  const toBox = box(toLayer);
  const rightGap = toBox.left - fromBox.right;
  const leftGap = fromBox.left - toBox.right;
  const downGap = toBox.top - fromBox.bottom;
  const upGap = fromBox.top - toBox.bottom;
  const largestGap = Math.max(rightGap, leftGap, downGap, upGap);
  const direction: Direction = largestGap > 0
    ? largestGap === rightGap ? 'right' : largestGap === leftGap ? 'left' : largestGap === downGap ? 'down' : 'up'
    : Math.abs(toBox.cx - fromBox.cx) >= Math.abs(toBox.cy - fromBox.cy)
      ? toBox.cx >= fromBox.cx ? 'right' : 'left'
      : toBox.cy >= fromBox.cy ? 'down' : 'up';
  const gap = direction === 'right' ? rightGap : direction === 'left' ? leftGap : direction === 'down' ? downGap : upGap;
  const startInset = gap >= 24 ? 4 : 0;
  const endInset = gap >= 24 ? 6 : 0;
  let from: Point;
  let to: Point;
  if (direction === 'right') {
    from = {x: fromBox.right + startInset, y: fromBox.cy};
    to = {x: toBox.left - endInset, y: toBox.cy};
  } else if (direction === 'left') {
    from = {x: fromBox.left - startInset, y: fromBox.cy};
    to = {x: toBox.right + endInset, y: toBox.cy};
  } else if (direction === 'down') {
    from = {x: fromBox.cx, y: fromBox.bottom + startInset};
    to = {x: toBox.cx, y: toBox.top - endInset};
  } else {
    from = {x: fromBox.cx, y: fromBox.top - startInset};
    to = {x: toBox.cx, y: toBox.bottom + endInset};
  }
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const path = direction === 'right' || direction === 'left'
    ? `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`
    : `M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`;
  const arrow = direction === 'right'
    ? `${to.x},${to.y} ${to.x - 10},${to.y - 6} ${to.x - 10},${to.y + 6}`
    : direction === 'left'
      ? `${to.x},${to.y} ${to.x + 10},${to.y - 6} ${to.x + 10},${to.y + 6}`
      : direction === 'down'
        ? `${to.x},${to.y} ${to.x - 6},${to.y - 10} ${to.x + 6},${to.y - 10}`
        : `${to.x},${to.y} ${to.x - 6},${to.y + 10} ${to.x + 6},${to.y + 10}`;
  return {from, to, path, label: {x: midX, y: midY}, arrow, direction};
}
