import type {CSSProperties} from 'react';
import type {StyleTokens} from '../../styles/style-loader';

// Approved direction: six visual languages share semantic inputs and beat timing,
// while composition, typography, shapes and entrances retain a distinct identity.
export const STYLE_LANGUAGES = {
  'retro-zine': 'editorial', 'archive-grid': 'swiss', scatterbrain: 'notes',
  signal: 'signal', 'signal-noir': 'blueprint', 'studio-frame': 'product'
} as const;
export type StyleLanguage = typeof STYLE_LANGUAGES[keyof typeof STYLE_LANGUAGES];
export function styleLanguage(id: string): StyleLanguage | undefined {
  return STYLE_LANGUAGES[id as keyof typeof STYLE_LANGUAGES];
}

export function semanticTextLines(text: string, fontSize: number, width: number): number {
  let lines = 1; let used = 0;
  for (const char of text) {
    if (char === '\n') {lines += 1; used = 0; continue;}
    const units = /\p{Script=Han}|[\u3000-\u303f\uff00-\uffef]/u.test(char) ? 1 : /\s/u.test(char) ? .33 : /[A-Z0-9]/u.test(char) ? .68 : .57;
    if (used > 0 && (used + units) * fontSize > width) {lines += 1; used = 0;}
    used += units;
  }
  return lines;
}
export function fittedSemanticFont(text: string, width: number, height: number, max: number, min: number, lineHeight = 1.12): number {
  for (let size = max; size >= min; size -= 2) {
    if (semanticTextLines(text, size, width) * size * lineHeight <= height) return size;
  }
  return min;
}

export function statementTitleLayout(id: string, width: number, height: number, portrait: boolean, scale: number) {
  const family = styleLanguage(id);
  const layouts = {
    editorial: [.02, .22, portrait ? .92 : .78, .44, 158],
    swiss: [.02, .23, portrait ? .86 : .63, .47, 146],
    notes: [.06, .20, portrait ? .84 : .66, .42, 142],
    signal: [.08, .24, .84, .40, 148],
    blueprint: [.02, .15, .94, .38, 140],
    product: [.02, portrait ? .12 : .22, portrait ? .96 : .34, portrait ? .24 : .56, portrait ? 112 : 104]
  };
  const [left, top, w, h, max] = layouts[family ?? 'editorial'];
  return {left: width * left!, top: height * top!, width: width * w!, height: height * h!, max: max! * scale, min: 48 * scale};
}

export function semanticHeadingLayout(id: string, width: number, height: number, portrait: boolean, scale: number, media: boolean) {
  const family = styleLanguage(id);
  const side = family === 'product' && media && !portrait;
  return {width: width * (side ? .30 : .96), height: height * (side ? .55 : .19), max: (side ? 74 : family === 'blueprint' ? 82 : 98) * scale, min: 38 * scale};
}

export function languageEntrance(progress: number, tokens: StyleTokens, scale: number, index = 0): CSSProperties {
  const p = Math.max(0, Math.min(1, progress)); const offset = (1 - p) * tokens.motion.enterOffset * scale;
  const family = styleLanguage(tokens.id);
  return {
    opacity: p,
    transform: family === 'editorial' ? `translateX(${-offset}px)`
      : family === 'notes' ? `translateY(${offset}px) rotate(${(index % 2 ? 1 : -1) * (1 - p) * 5}deg)`
        : family === 'signal' ? `scale(${.96 + .04 * p})`
          : family === 'blueprint' ? undefined : `translateY(${offset}px)`,
    clipPath: family === 'swiss' ? `inset(0 ${(1 - p) * 100}% 0 0)` : undefined
  };
}

export function languageBackground(tokens: StyleTokens, scale: number): CSSProperties {
  const family = styleLanguage(tokens.id);
  if (family === 'blueprint') return {backgroundImage: `linear-gradient(${tokens.grid}90 1px, transparent 1px),linear-gradient(90deg, ${tokens.grid}90 1px, transparent 1px)`, backgroundSize: `${84 * scale}px ${84 * scale}px`};
  if (family === 'notes') return {backgroundImage: `radial-gradient(${tokens.grid} 1.5px, transparent 1.5px)`, backgroundSize: `${46 * scale}px ${46 * scale}px`};
  return {};
}
