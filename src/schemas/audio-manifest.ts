import {z} from 'zod';
import {SpeechWordSchema} from '../audio/speech-timing';

const AudioManifestSegmentSchema = z.object({
  sceneId: z.string().min(1),
  text: z.string().min(1),
  textHash: z.string().regex(/^[a-f0-9]{64}$/),
  path: z.string().min(1),
  startSec: z.number().nonnegative(),
  durationSec: z.number().positive(),
  endSec: z.number().positive(),
  source: z.enum(['tts', 'external']),
  speechWords: z.array(SpeechWordSchema).min(1).optional(),
  captionTimingSource: z.enum(['provider', 'estimated', 'manual']).optional()
}).strict();

export const AudioManifestSchema = z.object({
  schemaVersion: z.literal('1.0'),
  kind: z.literal('voiceover'),
  provider: z.string().min(1),
  ttsConfigFingerprint: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  artifactFingerprint: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  generatedAt: z.string().datetime(),
  storyboardPath: z.string().min(1),
  textSource: z.literal('scene.narration'),
  segments: z.array(AudioManifestSegmentSchema).min(1),
  fullAudioPath: z.string().min(1),
  captionsPath: z.string().min(1),
  audioConfigPath: z.string().min(1),
  projectDurationSec: z.number().positive(),
  captionInputFingerprint: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  captionTimingSource: z.enum(['estimated', 'manual', 'provider', 'mixed']).optional(),
  notes: z.array(z.string()).default([])
}).strict();

export type AudioManifest = z.infer<typeof AudioManifestSchema>;
export type AudioManifestSegment = z.infer<typeof AudioManifestSegmentSchema>;
