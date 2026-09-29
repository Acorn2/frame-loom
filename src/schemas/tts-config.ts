import {z} from 'zod';

export const TtsConfigSchema = z.object({
  schemaVersion: z.literal('1.0'),
  enabled: z.boolean(),
  provider: z.enum(['doubao', 'openai', 'elevenlabs', 'aliyun', 'mock']),
  apiVersion: z.enum(['generic', 'v3']).default('generic'),
  endpoint: z.string().url().optional(),
  apiKeyEnv: z.string().min(1).optional(),
  appIdEnv: z.string().min(1).optional(),
  accessTokenEnv: z.string().min(1).optional(),
  resourceIdEnv: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  voiceType: z.string().min(1),
  format: z.enum(['wav', 'mp3']).default('wav'),
  sampleRate: z.number().int().positive().default(24000),
  speedRatio: z.number().positive().default(1),
  volumeRatio: z.number().positive().default(1),
  pitchRatio: z.number().positive().default(1),
  outputDirectory: z.string().min(1).default('audio/generated'),
  timeoutMs: z.number().int().positive().default(30000),
  requestBody: z.record(z.string(), z.unknown()).optional()
}).strict();

export type TtsConfig = z.infer<typeof TtsConfigSchema>;
