import {z} from 'zod';

export const ProjectInputSchema = z.object({
  schemaVersion: z.literal('1.0'),
  inputMode: z.enum(['document', 'document-images']),
  colorMode: z.enum(['auto', 'style', 'source']).optional(),
  colorFallbackReason: z.string().min(1).optional()
}).strict();

export type ProjectInput = z.infer<typeof ProjectInputSchema>;
