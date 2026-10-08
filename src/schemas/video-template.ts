import {z} from 'zod';
import {SHOT_IDS} from './shot-recipe';
export const VideoTemplateRefSchema = z.object({id: z.literal('retro-zine-explainer'), version: z.enum(['1.0.0', '1.1.0', '1.2.0'])}).strict();
export const VideoTemplateSchema = z.object({
  ...VideoTemplateRefSchema.shape, status: z.enum(['experimental', 'stable', 'deprecated']),
  defaultStyle: z.object({id: z.string().min(1), version: z.string().min(1)}).strict(),
  shots: z.array(z.object({id: z.enum(SHOT_IDS), version: z.enum(['1.0.0', '1.1.0', '1.2.0'])}).strict()).min(1),
  orientations: z.array(z.enum(['landscape', 'portrait'])).min(1), inputModes: z.array(z.enum(['document-only', 'document-with-assets'])).min(1),
  selectionRules: z.array(z.object({content: z.string().min(1), shotId: z.enum(SHOT_IDS)}).strict()),
  handoff: z.object({type: z.literal('cut'), readingSec: z.number().positive(), maxNarrationGapSec: z.number().positive()}).strict(),
  sound: z.object({music: z.literal(false), sfx: z.literal(false)}).strict(), validatedExamples: z.array(z.string())
}).strict();
export type VideoTemplateRef = z.infer<typeof VideoTemplateRefSchema>;
