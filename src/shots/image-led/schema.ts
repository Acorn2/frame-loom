import {z} from 'zod';
export const IMAGE_LED_IDS = ['annotated-image', 'scene-narrative'] as const;
const ref = z.string().min(1);
export const ImageCropSchema = z.object({x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().positive().max(1), height: z.number().positive().max(1)}).strict();
export const ImageElementSchema = z.object({
  kind: z.enum(['text', 'image']), x: z.number().min(110), y: z.number().min(160), width: z.number().positive(), height: z.number().positive(),
  fontSize: z.number().min(24).max(112).default(40), bodySize: z.number().min(24).max(48).default(30),
  weight: z.enum(['regular', 'semibold']).default('regular'), align: z.enum(['left', 'center', 'right']).default('left'),
  color: z.enum(['ink', 'muted', 'accent', 'accentAlt']).default('ink'), crop: ImageCropSchema.optional(), underline: z.boolean().default(false)
}).strict();
const common = {
  version: z.literal('1.2.0'), composition: z.enum(['establish', 'detail', 'compare', 'question', 'closing']),
  kicker: z.string().min(1).max(56).regex(/^[^\n]+$/).optional(),
  slots: z.object({items: z.array(ref).min(2).max(24)}).strict(), elements: z.record(ref, ImageElementSchema),
  focus: z.array(z.object({trigger: ref, target: ref, crop: ImageCropSchema}).strict()).max(6)
};
export const IMAGE_LED_SCHEMAS = [
  z.object({id: z.literal('annotated-image'), ...common, annotations: z.record(ref, z.object({
    region: ImageCropSchema, color: z.enum(['accent', 'accentAlt']).default('accentAlt'),
    fromSide: z.enum(['left', 'right', 'top', 'bottom']), toSide: z.enum(['left', 'right', 'top', 'bottom']),
    via: z.array(z.tuple([z.number().min(110).max(1810), z.number().min(160).max(900)])).max(4)
  }).strict())}).strict(),
  z.object({id: z.literal('scene-narrative'), ...common}).strict()
] as const;
export const ImageLedShotSchema = z.discriminatedUnion('id', IMAGE_LED_SCHEMAS);
export type ImageLedShot = z.infer<typeof ImageLedShotSchema>;
export type ImageCrop = z.infer<typeof ImageCropSchema>;
export type ImageElement = z.infer<typeof ImageElementSchema>;
export function isImageLedShot(shot: {id: string}): shot is ImageLedShot {return (IMAGE_LED_IDS as readonly string[]).includes(shot.id);}
