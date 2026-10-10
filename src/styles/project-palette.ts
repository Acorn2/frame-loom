import type {ProjectPalette} from '../schemas/project-palette';
import type {StyleTokens} from './style-loader';
import {contrastInk, luminance, mixHex, readableColor} from './colors';

// Approved direction: project colors are explicit production inputs; visual language,
// motion, font and original media remain independent. No palette preserves legacy output.
export function resolveProjectPalette(palette: ProjectPalette, dark: boolean) {
  const {accent, accentAlt, lightBackground, darkBackground, surface} = palette.colors;
  const background = dark ? darkBackground : lightBackground;
  const full = palette.schemaVersion === '1.1' ? palette.colors : undefined;
  const ink = full ? readableColor(full.ink, background, 7) : dark ? '#f1f5f9' : '#111827';
  const muted = readableColor(full?.muted ?? (dark ? '#aeb9c8' : '#5c6878'), background);
  const paperInk = full ? readableColor(full.ink, surface, 7) : '#111827';
  const grid = mixHex(background, ink, .22);
  return {
    background, ink, muted, grid, paper: surface, accent,
    accentAlt: readableColor(accentAlt, background),
    captionInk: dark ? '#ffffff' : full ? readableColor(full.captionInk, background) : '#334155',
    onAccent: contrastInk(accent),
    accentText: readableColor(accent, background),
    accentSoft: mixHex(surface, accent, .12),
    paperInk, paperMuted: readableColor(full?.muted ?? '#5c6878', surface),
    paperAccent: readableColor(accentAlt, surface),
    surfaceBorder: `1px solid ${mixHex(surface, paperInk, .16)}`
  };
}

export function applyProjectPalette(tokens: StyleTokens, palette?: ProjectPalette): StyleTokens {
  if (!palette) return tokens;
  return {...tokens, ...resolveProjectPalette(palette, luminance(tokens.background) < .15), palette};
}
