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

export const PALETTE_ROLES = ['accent', 'accentAlt', 'lightBackground', 'darkBackground', 'surface', 'ink', 'muted', 'captionInk'] as const;
const RoleSchema = z.enum(PALETTE_ROLES);
const RegionSchema = z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative(), z.number().int().positive(), z.number().int().positive()]);
const RoleEvidenceSchema = z.union([
  z.object({assetId: z.string().min(1), region: RegionSchema, sampledColor: HexColorSchema, reason: z.string().min(1).optional()}).strict(),
  z.object({derivedFrom: RoleSchema, reason: z.string().min(1)}).strict()
]);
const FullPaletteColorsSchema = z.object({
  accent: HexColorSchema, accentAlt: HexColorSchema,
  lightBackground: HexColorSchema.refine(hex => luminance(hex) >= .5, '浅色背景亮度必须至少为 0.5。'),
  darkBackground: HexColorSchema.refine(hex => luminance(hex) <= .08, '深色背景亮度必须至多为 0.08。'),
  surface: HexColorSchema.refine(hex => luminance(hex) >= .5, '卡片表面亮度必须至少为 0.5。'),
  ink: HexColorSchema, muted: HexColorSchema, captionInk: HexColorSchema
}).strict().refine(colors => colors.captionInk.toLowerCase() !== colors.ink.toLowerCase(), '字幕颜色须与正文颜色区分。');
const base = {schemaVersion: z.literal('1.0'), colors: PaletteColorsSchema};
const full = {schemaVersion: z.literal('1.1'), colors: FullPaletteColorsSchema};
export const ProjectPaletteSchema = z.union([
  z.object({...base, source: z.literal('assets'), referenceAssets: z.array(z.string().min(1)).min(1).refine(ids => new Set(ids).size === ids.length, '配色参考不能重复。').meta({uniqueItems: true})}).strict(),
  z.object({...base, source: z.literal('custom'), referenceAssets: z.array(z.string()).length(0)}).strict(),
  z.object({...full, source: z.literal('assets'), referenceAssets: z.array(z.string().min(1)).min(1).refine(ids => new Set(ids).size === ids.length, '配色参考不能重复。').meta({uniqueItems: true}), evidence: z.record(RoleSchema, RoleEvidenceSchema)}).strict(),
  z.object({...full, source: z.literal('custom'), referenceAssets: z.array(z.string()).length(0)}).strict()
]);
export type ProjectPalette = z.infer<typeof ProjectPaletteSchema>;
