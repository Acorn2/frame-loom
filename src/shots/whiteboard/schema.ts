import {z} from 'zod';
export const WHITEBOARD_IDS = ['whiteboard-process', 'whiteboard-compare', 'whiteboard-explain'] as const;
const ref = z.string().min(1), base = {version: z.literal('1.2.0')};
export const WHITEBOARD_SCHEMAS = [
  z.object({id: z.literal('whiteboard-process'), ...base, slots: z.object({items: z.array(ref).min(2).max(4)}).strict()}).strict(),
  z.object({id: z.literal('whiteboard-compare'), ...base, slots: z.object({items: z.array(ref).length(2)}).strict()}).strict(),
  z.object({id: z.literal('whiteboard-explain'), ...base, slots: z.object({subject: ref, items: z.array(ref).min(2).max(3)}).strict()}).strict()
] as const;
export const WhiteboardShotSchema = z.discriminatedUnion('id', WHITEBOARD_SCHEMAS);
export type WhiteboardShot = z.infer<typeof WhiteboardShotSchema>;
export function isWhiteboardShot(shot: {id: string}): shot is WhiteboardShot {
  return (WHITEBOARD_IDS as readonly string[]).includes(shot.id);
}
