import {z} from 'zod';

export const ProjectInputSchema = z.object({
  schemaVersion: z.literal('1.0'),
  inputMode: z.enum(['document', 'document-images'])
}).strict();

export type ProjectInput = z.infer<typeof ProjectInputSchema>;
