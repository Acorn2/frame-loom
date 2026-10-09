import retroZineMotionJson from '../../styles/retro-zine/motion.json' with {type: 'json'};
import retroZineJson from '../../styles/retro-zine/style.json' with {type: 'json'};
import type {MotionPack, StylePack} from '../schemas/style-pack';
import {resolveFont, type FontRef} from '../fonts/catalog';
import type {ProjectPalette} from '../schemas/project-palette';
import {applyProjectPalette} from './project-palette';

export type StylePattern = 'grid' | 'desktop' | 'dots' | 'solid';

export interface StyleTokens {
  id: string;
  background: string;
  ink: string;
  captionInk: string;
  muted: string;
  accent: string;
  accentAlt: string;
  paper: string;
  grid: string;
  displayFont: string;
  bodyFont: string;
  font?: FontRef;
  palette?: ProjectPalette;
  onAccent?: string;
  accentText?: string;
  accentSoft?: string;
  paperInk?: string;
  paperMuted?: string;
  paperAccent?: string;
  pattern: StylePattern;
  surfaceRadius: number;
  surfaceBorder: string;
  surfaceShadow: string;
  labelRadius: number;
  titleFontSize: number;
  motion: MotionPack['runtime'];
  motionRules: Pick<MotionPack, 'enter' | 'reveal' | 'count'>;
  safeArea: StylePack['safeArea']['landscape'];
}

export function applyProjectFont(tokens: StyleTokens, font?: FontRef): StyleTokens {
  if (!font) return tokens;
  const family = `"${resolveFont(font).family}"`;
  return {...tokens, font, displayFont: family, bodyFont: family};
}

export function createStyleTokens(style: StylePack, motion: MotionPack, width: number, height: number, font?: FontRef, palette?: ProjectPalette): StyleTokens {
  return applyProjectPalette(applyProjectFont({
    id: style.id,
    ...style.tokens,
    motion: motion.runtime,
    motionRules: {enter: motion.enter, reveal: motion.reveal, count: motion.count},
    safeArea: width < height ? style.safeArea.portrait : style.safeArea.landscape
  }, font), palette);
}

export function getDefaultStyleTokens(width = 1920, height = 1080): StyleTokens {
  return createStyleTokens(
    retroZineJson as StylePack,
    retroZineMotionJson as MotionPack,
    width,
    height
  );
}
