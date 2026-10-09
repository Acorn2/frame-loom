export function rgb(hex: string): number[] {
  return [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16));
}

export function luminance(hex: string): number {
  const channels = rgb(hex).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels[0]! * .2126 + channels[1]! * .7152 + channels[2]! * .0722;
}

export function contrastRatio(a: string, b: string): number {
  const x = luminance(a); const y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}

export function mixHex(a: string, b: string, amount: number): string {
  const from = rgb(a); const to = rgb(b);
  return `#${from.map((value, index) => Math.round(value + (to[index]! - value) * amount).toString(16).padStart(2, '0')).join('')}`;
}

export function contrastInk(background: string): string {
  const preferred = contrastRatio('#111827', background) >= contrastRatio('#ffffff', background) ? '#111827' : '#ffffff';
  return contrastRatio(preferred, background) >= 4.5 ? preferred : '#000000';
}

export function readableColor(color: string, background: string, minimum = 4.5): string {
  if (contrastRatio(color, background) >= minimum) return color;
  const target = contrastInk(background);
  for (let step = 1; step <= 100; step++) {
    const candidate = mixHex(color, target, step / 100);
    if (contrastRatio(candidate, background) >= minimum) return candidate;
  }
  return target;
}
