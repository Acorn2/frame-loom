import {z} from 'zod';

export const ILLUSTRATION_STYLES = ['whiteboard', 'flat-explainer', 'paper-collage', 'annotated-reasoning', 'editorial-typography'] as const;
export const IllustrationStyleRefSchema = z.object({id: z.enum(ILLUSTRATION_STYLES), version: z.literal('1.0.0')}).strict();
const relativeAsset = z.string().regex(/^assets\/[a-z0-9]+(?:-[a-z0-9]+)*\.png$/);
export const IllustrationPlanSchema = z.object({
  schemaVersion: z.literal('1.0'), style: IllustrationStyleRefSchema,
  assets: z.array(z.object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), path: relativeAsset,
    subject: z.string().min(1).max(2000), purpose: z.string().min(1).max(500),
    sourceClaim: z.string().min(1).max(1000), references: z.array(z.string().min(1)).max(3).optional()
  }).strict()).max(24)
}).strict().refine(plan => new Set(plan.assets.map(asset => asset.id)).size === plan.assets.length
  && new Set(plan.assets.map(asset => asset.path)).size === plan.assets.length, '素材 ID 和路径不能重复。');

export const IllustrationGuideSchema = z.object({
  schemaVersion: z.literal('1.0'), style: IllustrationStyleRefSchema,
  medium: z.string().min(1), subjectPrompt: z.string().min(1),
  palette: z.array(z.string().regex(/^#[0-9a-f]{6}$/i)).min(3),
  composition: z.array(z.string().min(1)).min(1), motion: z.array(z.string().min(1)).min(1)
}).strict();
export const GeneratedIllustrationSchema = z.object({
  tool: z.literal('imagegen'), style: IllustrationStyleRefSchema,
  planId: z.string().min(1), planHash: z.string().regex(/^[a-f0-9]{64}$/),
  promptHash: z.string().regex(/^[a-f0-9]{64}$/), fileHash: z.string().regex(/^[a-f0-9]{64}$/),
  review: z.object({reviewer: z.string().min(1), reviewedAt: z.string().datetime()}).strict()
}).strict();

export type IllustrationPlan = z.infer<typeof IllustrationPlanSchema>;
