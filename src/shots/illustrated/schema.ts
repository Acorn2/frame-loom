import {z} from 'zod';
export const ILLUSTRATED_IDS = ['illustrated-hero', 'illustrated-compare', 'illustrated-process', 'illustrated-explain', 'illustrated-breakdown', 'illustrated-metric'] as const;
const ref = z.string().min(1), base = {version: z.literal('1.2.0')};
export const ILLUSTRATED_SCHEMAS = [
  z.object({id: z.literal('illustrated-hero'), ...base, slots: z.object({subject: ref, items: z.array(ref).length(1)}).strict()}).strict(),
  z.object({id: z.literal('illustrated-compare'), ...base, slots: z.object({items: z.array(ref).length(2)}).strict()}).strict(),
  z.object({id: z.literal('illustrated-process'), ...base, slots: z.object({items: z.array(ref).min(2).max(4)}).strict()}).strict(),
  z.object({id: z.literal('illustrated-explain'), ...base, slots: z.object({subject: ref, items: z.array(ref).min(2).max(3)}).strict()}).strict(),
  z.object({id: z.literal('illustrated-breakdown'), ...base, slots: z.object({subject: ref, items: z.array(ref).min(2).max(4)}).strict()}).strict(),
  z.object({id: z.literal('illustrated-metric'), ...base, slots: z.object({subject: ref, items: z.array(ref).min(1).max(3)}).strict()}).strict()
] as const;
export const IllustratedShotSchema = z.discriminatedUnion('id', ILLUSTRATED_SCHEMAS);
export type IllustratedShot = z.infer<typeof IllustratedShotSchema>;
export function isIllustratedShot(shot: {id: string}): shot is IllustratedShot {
  return (ILLUSTRATED_IDS as readonly string[]).includes(shot.id);
}
