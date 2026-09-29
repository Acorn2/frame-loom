import type {CSSProperties} from 'react';
import type {StyleTokens} from '../styles/style-loader';

function luminance(hex: string): number | null {
  const value = hex.replace(/^#/, '');
  if (!/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) return null;
  const channels = value.length === 3
    ? [...value].map((digit) => parseInt(digit + digit, 16))
    : [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
  const linear = channels.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return (linear[0] ?? 0) * 0.2126 + (linear[1] ?? 0) * 0.7152 + (linear[2] ?? 0) * 0.0722;
}

function captionColor(tokens: StyleTokens): string {
  const background = luminance(tokens.background);
  const captionInk = luminance(tokens.captionInk);
  if (background === null || captionInk === null) return tokens.captionInk;
  const contrast = (Math.max(background, captionInk) + 0.05) / (Math.min(background, captionInk) + 0.05);
  if (contrast >= 4.5) return tokens.captionInk;
  return background > 0.179 ? '#000000' : '#ffffff';
}

// Captions sit directly on the canvas in every template; never add a backing fill.
export function captionTextStyle(tokens: StyleTokens): CSSProperties {
  return {
    color: captionColor(tokens),
    fontFamily: tokens.bodyFont,
    fontWeight: 700,
    textAlign: 'center',
    whiteSpace: 'nowrap'
  };
}
