import {z} from 'zod';

// Approved text-first designs: bounded geometry and declarative stages, never
// episode code. Legacy illustration recipes remain independently registered.
export const TEXT_LED_IDS = ['annotated-manuscript', 'editorial-flow'] as const;
const ref = z.string().min(1);
const position = {
  x: z.number().min(0).max(1920), y: z.number().min(0).max(960),
  width: z.number().positive().max(1920), height: z.number().positive().max(960),
  opacity: z.number().min(0).max(1).default(1)
};
export const TextLedPlacementSchema = z.object({...position,
  fontSize: z.number().min(28).max(112).default(48), weight: z.enum(['regular', 'medium', 'semibold']).default('regular'),
  align: z.enum(['left', 'center', 'right']).default('left'), color: z.enum(['ink', 'muted', 'accent', 'accentAlt']).default('ink')
}).strict();
export const TextLedElementSchema = z.object({kind: z.enum(['text', 'sticker']), ...TextLedPlacementSchema.shape}).strict();
const common = {version: z.literal('1.2.0'), slots: z.object({items: z.array(ref).min(2).max(36)}).strict(), elements: z.record(ref, TextLedElementSchema)};
export const TEXT_LED_SCHEMAS = [
  z.object({id: z.literal('annotated-manuscript'), ...common,
    annotations: z.record(ref, z.object({phrase: z.string().min(1).max(42), kind: z.enum(['underline', 'circle']), color: z.enum(['accent', 'accentAlt']).default('accentAlt')}).strict()),
    routes: z.record(ref, z.object({points: z.array(z.tuple([z.number().min(0).max(1920), z.number().min(0).max(960)])).min(2).max(8), arrow: z.boolean().default(false)}).strict())
  }).strict(),
  z.object({id: z.literal('editorial-flow'), ...common,
    stages: z.array(z.object({trigger: ref, placements: z.record(ref, TextLedPlacementSchema)}).strict()).min(1).max(6),
    routes: z.record(ref, z.object({stage: z.number().int().nonnegative().max(6), arrow: z.boolean().default(true), track: z.boolean().default(false)}).strict())
  }).strict()
] as const;
export const TextLedShotSchema = z.discriminatedUnion('id', TEXT_LED_SCHEMAS);
export type TextLedShot = z.infer<typeof TextLedShotSchema>;
export type TextLedPlacement = z.infer<typeof TextLedPlacementSchema>;
export function isTextLedShot(shot: {id: string}): shot is TextLedShot {return (TEXT_LED_IDS as readonly string[]).includes(shot.id);}
