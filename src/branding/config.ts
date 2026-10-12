import {z} from 'zod';
import type {Rect} from '../layout/scene-layout';

export const BRAND_STYLES = ['whiteboard', 'flat-explainer', 'paper-collage', 'annotated-reasoning', 'editorial-typography'] as const;
const color = z.string().regex(/^#[a-fA-F0-9]{6}$/);
export const BrandSchema = z.object({
  name: z.string().trim().min(1).max(40).refine(name => !/[\r\n\t]/u.test(name), '品牌名必须为单行'),
  accent: color.optional(), ink: color.optional(),
  logo: z.object({path: z.string().min(1), source: z.string().trim().min(1), license: z.string().trim().min(1)}).strict().optional(),
  watermark: z.object({
    enabled: z.boolean().default(true), position: z.literal('top-right').default('top-right'),
    opacity: z.number().min(.5).max(1).default(.72), size: z.number().min(24).max(40).default(36),
    margin: z.number().min(40).max(64).default(56), drawInSeconds: z.number().min(0).max(3).default(1.2),
    sparkle: z.boolean().default(true), underline: z.boolean().default(true)
  }).strict().prefault({})
}).strict();
export const BrandConfigSchema = z.object({schemaVersion: z.literal('1.0'), brand: BrandSchema}).strict();
export type Brand = z.infer<typeof BrandSchema>;
export type BrandRuntime = Omit<Brand, 'logo'> & {logoDataUri?: string; logoAspect?: number};
export const DEMO_BRAND: BrandRuntime = BrandSchema.parse({name: 'Your Brand'});
export const hasBrandStyle = (style: string) => (BRAND_STYLES as readonly string[]).includes(style);
export function brandRegion(width: number): Rect {
  const scale = width / 1920;
  return {x: 1600 * scale, y: 36 * scale, width: 284 * scale, height: 108 * scale};
}
export function brandProgress(frame: number, fps: number, seconds: number) {
  return seconds === 0 ? 1 : Math.max(0, Math.min(1, (frame / fps - .1) / seconds));
}
