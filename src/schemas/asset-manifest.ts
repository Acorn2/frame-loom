import {z} from 'zod';
import {GeneratedIllustrationSchema} from './illustration';

export const AssetManifestItemSchema = z.object({
  id: z.string().min(1), path: z.string().min(1),
  type: z.enum(['image', 'screenshot', 'font', 'audio', 'video', 'other']),
  source: z.string().min(1), license: z.string().min(1), intendedUse: z.string().min(1),
  usage: z.enum(['scene-media', 'palette-reference', 'both']).optional(),
  generation: GeneratedIllustrationSchema.optional()
}).strict();

export const AssetManifestSchema = z.object({
  schemaVersion: z.literal('1.0'), assets: z.array(AssetManifestItemSchema), notes: z.string().optional()
}).strict();

export type AssetManifest = z.infer<typeof AssetManifestSchema>;
