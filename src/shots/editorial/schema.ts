import {z} from 'zod';
import {DirectionBoxSchema} from '../directions/schema';

const ref = z.string().min(1);
const domain = z.object({min: z.number().min(0).multipleOf(.01), max: z.number().positive().multipleOf(.01)}).strict();
export const EditorialElementSchema = DirectionBoxSchema.extend({
  kind: z.enum(['text', 'chart']), fontSize: z.number().min(20).max(160).default(32), bodySize: z.number().min(20).max(48).default(26),
  weight: z.enum(['regular', 'medium', 'bold']).default('regular'), color: z.enum(['ink', 'muted', 'accent', 'accentAlt']).default('ink'),
  align: z.enum(['left', 'center', 'right']).default('left'), underline: z.string().min(1).max(80).optional(),
  valueSize: z.number().min(24).max(112).default(43), axisWidth: z.number().min(55).max(180).default(70), barWidth: z.number().min(.25).max(.8).default(.52), grid: z.boolean().default(true)
}).strict();
export const EDITORIAL_IDS = ['editorial-explainer'] as const;
export const EDITORIAL_SCHEMAS = [z.object({id: z.literal('editorial-explainer'), version: z.literal('1.2.0'),
  composition: z.enum(['opening', 'source', 'compare', 'rescale', 'closing']),
  slots: z.object({items: z.array(ref).min(2).max(40), metrics: z.array(ref).max(18)}).strict(),
  elements: z.record(ref, EditorialElementSchema),
  charts: z.record(ref, z.object({metrics: z.array(ref).min(1).max(6), domain,
    accent: ref.optional(), rescale: z.object({trigger: ref, domain}).strict().optional()
  }).strict()),
  rules: z.array(z.object({x: z.number(), y: z.number(), length: z.number().positive(), vertical: z.boolean().default(false),
    color: z.enum(['ink', 'muted', 'accent', 'accentAlt']).default('muted'), width: z.number().min(1).max(4).default(1)
  }).strict()).max(8)
}).strict()] as const;
export type EditorialShot = z.infer<typeof EDITORIAL_SCHEMAS[0]>;
export type EditorialElement = z.infer<typeof EditorialElementSchema>;
export function isEditorialShot(shot: {id: string}): shot is EditorialShot {return shot.id === 'editorial-explainer';}
