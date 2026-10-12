import {z} from 'zod';
const box = {x: z.number().min(0).max(1920), y: z.number().min(0).max(960), width: z.number().positive().max(1920), height: z.number().positive().max(960)};
const text = {fontSize: z.number().min(28).max(140), align: z.enum(['left', 'center', 'right']).default('left'), color: z.enum(['ink', 'muted', 'accent', 'negative']).default('ink')};
export const BoardElementSchema = z.discriminatedUnion('kind', [
  z.object({kind: z.literal('text'), ...box, ...text}).strict(),
  z.object({kind: z.literal('sticker'), ...box, labelSize: z.number().min(28).max(56).default(36)}).strict(),
  z.object({kind: z.enum(['rectangle', 'ellipse', 'checkbox']), ...box, ...text, fill: z.enum(['none', 'blue', 'yellow', 'green', 'red']).default('none'), fillStyle: z.enum(['solid', 'hachure']).default('hachure')}).strict()
]);
export const BoardRouteSchema = z.object({points: z.array(z.tuple([z.number().min(0).max(1920), z.number().min(0).max(960)])).min(2).max(8), color: z.enum(['ink', 'muted', 'accent', 'negative']).default('muted'), dashed: z.boolean().default(false)}).strict();
export const WHITEBOARD_BOARD_IDS = ['whiteboard-board'] as const;
export const WHITEBOARD_BOARD_SCHEMAS = [z.object({id: z.literal('whiteboard-board'), version: z.literal('1.2.0'), slots: z.object({items: z.array(z.string().min(1)).min(2).max(24)}).strict(), elements: z.record(z.string(), BoardElementSchema), routes: z.record(z.string(), BoardRouteSchema)}).strict()] as const;
export type WhiteboardBoard = z.infer<typeof WHITEBOARD_BOARD_SCHEMAS[0]>;
export type BoardElement = z.infer<typeof BoardElementSchema>;
