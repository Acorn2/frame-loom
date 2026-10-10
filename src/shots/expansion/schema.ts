import {z} from 'zod';

// Three source-driven recipes, with separate compositions for 16:9 and 9:16.
export const EXPANSION_IDS = ['type-and-filter', 'ai-stream-response', 'unit-dot-regroup'] as const;
const ref = z.string().min(1);
const base = {version: z.literal('1.2.0')};
export const EXPANSION_SCHEMAS = [
  z.object({id: z.literal('type-and-filter'), ...base, selectedId: ref,
    slots: z.object({query: ref, items: z.array(ref).min(2).max(4), detail: ref}).strict()}).strict(),
  z.object({id: z.literal('ai-stream-response'), ...base,
    slots: z.object({summary: ref, items: z.array(ref).min(2).max(4), completion: ref}).strict()}).strict(),
  z.object({id: z.literal('unit-dot-regroup'), ...base,
    slots: z.object({items: z.array(ref).min(2).max(4), total: ref}).strict()}).strict()
] as const;
export const ExpansionShotSchema = z.discriminatedUnion('id', EXPANSION_SCHEMAS);
export type ExpansionShot = z.infer<typeof ExpansionShotSchema>;
export function isExpansionShot(shot: {id: string}): shot is ExpansionShot {
  return (EXPANSION_IDS as readonly string[]).includes(shot.id);
}
