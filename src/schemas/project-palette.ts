import {z} from 'zod';
import {luminance, rgb} from '../styles/colors';

const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, '颜色必须为六位十六进制色值。');
export const PROJECT_PALETTE_STYLES = ['retro-zine', 'archive-grid', 'scatterbrain', 'signal', 'signal-noir', 'studio-frame'] as const;
function neutral(hex: string): boolean {
  const channels = rgb(hex);
  return Math.max(...channels) - Math.min(...channels) <= 32;
}
export const PaletteColorsSchema = z.object({
  accent: HexColorSchema,
  accentAlt: HexColorSchema,
  lightBackground: HexColorSchema.refine(hex => neutral(hex) && luminance(hex) >= .8, '浅色背景必须为浅中性色。').describe('Runtime enforces relative luminance >= 0.8 and RGB channel spread <= 32.'),
  darkBackground: HexColorSchema.refine(hex => neutral(hex) && luminance(hex) <= .08, '深色背景必须为深中性色。').describe('Runtime enforces relative luminance <= 0.08 and RGB channel spread <= 32.'),
  surface: HexColorSchema.refine(hex => neutral(hex) && luminance(hex) >= .8, '卡片表面必须为浅中性色。').describe('Runtime enforces relative luminance >= 0.8 and RGB channel spread <= 32.')
}).strict();

const base = {schemaVersion: z.literal('1.0'), colors: PaletteColorsSchema};
export const ProjectPaletteSchema = z.discriminatedUnion('source', [
  z.object({...base, source: z.literal('assets'), referenceAssets: z.array(z.string().min(1)).min(1).refine(ids => new Set(ids).size === ids.length, '配色参考不能重复。').meta({uniqueItems: true})}).strict(),
  z.object({...base, source: z.literal('custom'), referenceAssets: z.array(z.string()).length(0)}).strict()
]);
export type ProjectPalette = z.infer<typeof ProjectPaletteSchema>;
