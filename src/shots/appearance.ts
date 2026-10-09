import type {Shot} from '../schemas/shot-recipe';
import type {StyleTokens} from '../styles/style-loader';
import type {Storyboard} from '../schemas/storyboard';
import {getSceneTimeline} from '../timeline/scene-timeline';
import {resolveProjectPalette} from '../styles/project-palette';

// Neutral stages replace warm paper across all current recipe samples.
// Default styles retain accent families; explicit project palettes take precedence.
export const RECIPE_VISUALS = {
  'semantic-default': 'diagram', 'compare-reveal': 'comparison', 'network-expand': 'network',
  'paper-title': 'editorial', 'document-conclusions': 'document', 'title-to-label': 'studio',
  'list-reveal': 'slate', 'blur-slide': 'spotlight', 'split-text-stagger': 'ink',
  'lead-word-assemble': 'poster', 'brace-expand': 'terminal', 'pill-slot-cycle': 'mint',
  'word-roll': 'white', 'text-column-converge': 'contrast', 'evidence-relay': 'archive',
  'card-stack': 'gallery', 'concept-matrix': 'pastel', 'platform-hinge-rise': 'platform',
  'structure-then-text': 'trace', 'source-converge': 'constellation',
  'diagram-cascade': 'blueprint', 'timeline-travel': 'timeline', 'odometer-roll': 'instrument',
  'row-embed': 'workbench',
  'research-stack': 'archive',
  'list-stack-press': 'workbench',
  'integration-hub': 'constellation',
  'scroll-brake': 'slate',
  'chart-live': 'instrument',
  'particle-sand-fill': 'blueprint',
  'member-grid': 'pastel',
  'ring-annotation': 'trace',
  'cycle-mechanism': 'gallery',
  'media-before-after': 'studio',
  'document-write': 'document',
  'code-reveal': 'terminal',
  'letterspace-materialize': 'spotlight'
} as const;
export type RecipeVisual = typeof RECIPE_VISUALS[keyof typeof RECIPE_VISUALS];
export interface RecipeAppearance {
  visual: RecipeVisual;
  dark: boolean;
  background: string;
  stageInk: string;
  stageMuted: string;
  lineInk: string;
  decoration: 'none' | 'paper' | 'grid' | 'floor' | 'split';
  tokens: StyleTokens;
}
export function mixColor(a: string, b: string, amount: number) {
  const rgb = (hex: string) => [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16));
  const from = rgb(a); const to = rgb(b);
  return `#${from.map((value, i) => Math.round(value + (to[i]! - value) * amount).toString(16).padStart(2, '0')).join('')}`;
}
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return r! * .2126 + g! * .7152 + b! * .0722;
}
export function recipeAppearance(shot: Shot, base: StyleTokens): RecipeAppearance | undefined {
  const native = ['semantic-default', 'compare-reveal', 'network-expand'].includes(shot.id);
  if ((native ? shot.version !== '1.0.0' : shot.version !== '1.2.0') || !(shot.id in RECIPE_VISUALS)) return undefined;
  const visual = RECIPE_VISUALS[shot.id as keyof typeof RECIPE_VISUALS];
  const dark = (native && luminance(base.background) < .15) || ['spotlight', 'ink', 'terminal', 'gallery', 'trace', 'constellation', 'blueprint', 'timeline', 'instrument'].includes(visual);
  const neutral = '#f4f6f8';
  const deep = '#151a22';
  const tint = mixColor('#f0f3f7', base.accentAlt, .025);
  const glow = mixColor(base.accentAlt, '#ffffff', .5);
  const paper = '#ffffff';
  const backgrounds: Record<RecipeVisual, string> = {
    diagram: native ? base.background : dark ? '#151c28' : '#f8fafc', comparison: native ? base.background : dark ? deep : '#f1f4f7', network: native ? base.background : dark ? '#19212d' : '#eef2f6',
    editorial: paper, document: '#f6f7f9',
    studio: `radial-gradient(ellipse at 10% 0%, #e9eef4, transparent 65%), linear-gradient(145deg, #ffffff, ${neutral})`,
    slate: neutral, spotlight: `radial-gradient(ellipse at 75% 30%, ${mixColor(deep, base.accentAlt, .08)}, ${deep} 70%)`,
    ink: '#11151b', poster: '#f5f7fa', terminal: '#171c24', mint: tint, white: '#ffffff',
    contrast: `linear-gradient(90deg, ${neutral} 50%, #ffffff 50%)`, archive: paper,
    gallery: `radial-gradient(ellipse at 50% 105%, #293444, ${deep} 75%)`,
    pastel: `radial-gradient(ellipse at 0% 0%, #e7ecf3, transparent 65%), radial-gradient(ellipse at 100% 90%, #edf1f6, transparent 65%), ${neutral}`,
    platform: `linear-gradient(180deg, #ffffff 0%, ${neutral} 58%, #e5e9ef 100%)`,
    trace: '#121820', constellation: `radial-gradient(ellipse at 75% 50%, #243241, ${deep} 85%)`,
    blueprint: '#1a2431', timeline: '#171f2b',
    instrument: 'radial-gradient(ellipse at 50% 40%, #27313d, #0d1219 90%)',
    workbench: '#eef2f6'
  };
  const serif = ['editorial', 'document', 'archive'].includes(visual);
  let tokens: StyleTokens = {...base, background: native ? base.background : dark ? deep : neutral,
    paper: '#ffffff', accentAlt: native || luminance(base.accentAlt) <= .15 ? base.accentAlt : mixColor(base.accentAlt, '#192330', .6), ink: '#192330', muted: '#5c6878', grid: '#cbd3dd',
    captionInk: native ? base.captionInk : dark ? '#ffffff' : '#334155',
    displayFont: base.font || native || serif ? base.displayFont : visual === 'terminal' ? 'monospace' : base.bodyFont,
    surfaceRadius: visual === 'document' ? 8 : 16,
    surfaceBorder: '1px solid #dfe5ec',
    surfaceShadow: dark ? '0 20px 52px #00000038, 0 1px 2px #00000020' : '0 12px 32px #1923300b, 0 1px 3px #19233008'
  };
  if (base.palette) {
    const colors = resolveProjectPalette(base.palette, dark);
    tokens = {...tokens, ...colors, ink: colors.paperInk, muted: colors.paperMuted, accentAlt: colors.paperAccent};
    return {visual, dark, background: colors.background, stageInk: colors.ink,
      stageMuted: colors.muted, lineInk: colors.accentAlt,
      decoration: ['editorial', 'document', 'archive'].includes(visual) ? 'paper'
        : ['terminal', 'blueprint'].includes(visual) ? 'grid'
          : ['gallery', 'platform'].includes(visual) ? 'floor' : visual === 'contrast' ? 'split' : 'none', tokens};
  }
  return {visual, dark, background: backgrounds[visual], stageInk: dark ? '#f5f7fb' : tokens.ink,
    stageMuted: dark ? '#aeb9c8' : tokens.muted,
    lineInk: dark ? glow : luminance(base.accentAlt) > .35 ? mixColor(base.accentAlt, '#192330', .6) : base.accentAlt,
    decoration: ['editorial', 'document', 'archive'].includes(visual) ? 'paper'
      : ['terminal', 'blueprint'].includes(visual) ? 'grid'
        : ['gallery', 'platform'].includes(visual) ? 'floor'
          : visual === 'contrast' ? 'split' : 'none', tokens};
}

export function captionTokensAtFrame(board: Storyboard, frame: number, base: StyleTokens): StyleTokens {
  const active = getSceneTimeline(board).reverse().find(item => frame >= item.startFrame && frame < item.startFrame + item.scene.durationFrames);
  return active?.scene.shot ? recipeAppearance(active.scene.shot, base)?.tokens ?? base : base;
}
