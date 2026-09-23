import {z} from 'zod';

export const AssetManifestItemSchema = z.object({
  id: z.string().min(1), path: z.string().min(1),
  type: z.enum(['image', 'screenshot', 'font', 'audio', 'video', 'other']),
  source: z.string().min(1), license: z.string().min(1), intendedUse: z.string().min(1)
}).strict();

export const AssetManifestSchema = z.object({
  schemaVersion: z.literal('1.0'), assets: z.array(AssetManifestItemSchema), notes: z.string().optional()
}).strict();

export type AssetManifest = z.infer<typeof AssetManifestSchema>;
