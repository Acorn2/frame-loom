import {z} from 'zod';

const AudioFileSchema = z.object({
  enabled: z.boolean(),
  path: z.string().min(1),
  volume: z.number().min(0).max(1),
  source: z.string().min(1),
  license: z.string().min(1)
}).strict();

const SoundEffectSchema = AudioFileSchema.extend({
  startSec: z.number().nonnegative().optional()
}).strict();

const MusicDuckingSchema = z.object({
  enabled: z.boolean(),
  volume: z.number().min(0).max(1),
  attackSec: z.number().nonnegative().default(0.08),
  releaseSec: z.number().nonnegative().default(0.18)
}).strict();

const MusicFileSchema = AudioFileSchema.extend({
  ducking: MusicDuckingSchema.optional()
}).strict();

export const AudioConfigSchema = z.object({
  schemaVersion: z.literal('1.0'),
  voiceover: AudioFileSchema.optional(),
  captions: z.object({
    enabled: z.boolean(),
    path: z.string().min(1),
    format: z.enum(['srt', 'vtt', 'auto']).default('auto'),
    source: z.string().min(1)
  }).strict().optional(),
  music: MusicFileSchema.optional(),
  sfx: z.array(SoundEffectSchema).optional()
}).strict();

export type AudioConfig = z.infer<typeof AudioConfigSchema>;
