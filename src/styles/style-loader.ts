import retroZineMotionJson from '../../styles/retro-zine/motion.json' with {type: 'json'};
import retroZineJson from '../../styles/retro-zine/style.json' with {type: 'json'};
import type {MotionPack, StylePack} from '../schemas/style-pack';

export type StylePattern = 'grid' | 'desktop' | 'dots' | 'solid';

export interface StyleTokens {
  id: string;
  background: string;
  ink: string;
  muted: string;
  accent: string;
  accentAlt: string;
  paper: string;
  grid: string;
  displayFont: string;
  bodyFont: string;
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

export function createStyleTokens(style: StylePack, motion: MotionPack, width: number, height: number): StyleTokens {
  return {
    id: style.id,
    ...style.tokens,
    motion: motion.runtime,
    motionRules: {enter: motion.enter, reveal: motion.reveal, count: motion.count},
    safeArea: width < height ? style.safeArea.portrait : style.safeArea.landscape
  };
}

export function getDefaultStyleTokens(width = 1920, height = 1080): StyleTokens {
  return createStyleTokens(
    retroZineJson as StylePack,
    retroZineMotionJson as MotionPack,
    width,
    height
  );
}
