import {z} from 'zod';
import {FONT_IDS} from '../fonts/catalog';

export const FontRefSchema = z.object({
  id: z.enum(FONT_IDS),
  version: z.string().regex(/^\d+\.\d+(?:\.\d+)?$/)
}).strict();
