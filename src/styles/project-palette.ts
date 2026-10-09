import type {ProjectPalette} from '../schemas/project-palette';
import type {StyleTokens} from './style-loader';
import {contrastInk, luminance, mixHex, readableColor} from './colors';

// Approved direction: project colors are explicit production inputs; visual language,
// motion, font and original media remain independent. No palette preserves legacy output.
export function resolveProjectPalette(palette: ProjectPalette, dark: boolean) {
  const {accent, accentAlt, lightBackground, darkBackground, surface} = palette.colors;
  const background = dark ? darkBackground : lightBackground;
  const ink = dark ? '#f1f5f9' : '#111827';
  const muted = readableColor(dark ? '#aeb9c8' : '#5c6878', background);
  const grid = mixHex(background, ink, .22);
  return {
    background, ink, muted, grid, paper: surface, accent,
    accentAlt: readableColor(accentAlt, background),
    captionInk: dark ? '#ffffff' : '#334155',
    onAccent: contrastInk(accent),
    accentText: readableColor(accent, background),
    accentSoft: mixHex(surface, accent, .12),
    paperInk: '#111827', paperMuted: readableColor('#5c6878', surface),
    paperAccent: readableColor(accentAlt, surface),
    surfaceBorder: `1px solid ${mixHex(surface, '#111827', .16)}`
  };
}

export function applyProjectPalette(tokens: StyleTokens, palette?: ProjectPalette): StyleTokens {
  if (!palette) return tokens;
  return {...tokens, ...resolveProjectPalette(palette, luminance(tokens.background) < .15), palette};
}
