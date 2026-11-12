import {z} from 'zod';

export const DIRECTION_IDS = ['mechanism-map', 'product-showcase'] as const;
const ref = z.string().min(1);
export const DirectionBoxSchema = z.object({
  x: z.number().min(0).max(1920), y: z.number().min(0).max(1080),
  width: z.number().positive().max(1920), height: z.number().positive().max(1080)
}).strict();
export const DirectionCropSchema = z.object({x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().positive().max(1), height: z.number().positive().max(1)}).strict();
export const DirectionElementSchema = DirectionBoxSchema.extend({
  kind: z.enum(['text', 'panel', 'film', 'gate', 'plane', 'media']),
  fontSize: z.number().min(20).max(112).default(32), bodySize: z.number().min(20).max(48).default(24),
  weight: z.enum(['regular', 'medium', 'bold']).default('regular'),
  color: z.enum(['ink', 'muted', 'accent', 'accentAlt']).default('ink'),
  align: z.enum(['left', 'center', 'right']).default('left'),
  emphasis: z.string().min(1).max(80).optional(),
  crop: DirectionCropSchema.optional()
}).strict();
const common = {version: z.literal('1.2.0'), slots: z.object({items: z.array(ref).min(2).max(40)}).strict(), elements: z.record(ref, DirectionElementSchema)};
export const DIRECTION_SCHEMAS = [
  z.object({id: z.literal('mechanism-map'), ...common,
    composition: z.enum(['layers', 'route', 'timeline', 'gate', 'summary']),
    routes: z.record(ref, z.object({fromSide: z.enum(['left', 'right', 'top', 'bottom']), toSide: z.enum(['left', 'right', 'top', 'bottom']),
      via: z.array(z.tuple([z.number().min(0).max(1920), z.number().min(0).max(1080)])).max(6).default([]),
      arrow: z.boolean().default(true), color: z.enum(['accent', 'accentAlt', 'muted']).default('accentAlt')}).strict())
  }).strict(),
  z.object({id: z.literal('product-showcase'), ...common,
    composition: z.enum(['hero', 'focus', 'detail', 'handoff', 'summary']),
    focus: z.array(z.object({trigger: ref, target: ref, box: DirectionBoxSchema, crop: DirectionCropSchema,
      verticalDelay: z.number().min(0).max(.8).default(0)}).strict()).max(6)
  }).strict()
] as const;
export const DirectionShotSchema = z.discriminatedUnion('id', DIRECTION_SCHEMAS);
export type DirectionShot = z.infer<typeof DirectionShotSchema>;
export type DirectionElement = z.infer<typeof DirectionElementSchema>;
export type DirectionBox = z.infer<typeof DirectionBoxSchema>;
export type DirectionCrop = z.infer<typeof DirectionCropSchema>;
export function isDirectionShot(shot: {id: string}): shot is DirectionShot {return (DIRECTION_IDS as readonly string[]).includes(shot.id);}
