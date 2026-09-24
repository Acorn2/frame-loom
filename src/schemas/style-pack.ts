import {z} from 'zod';
import {ACTION_IDS, LAYER_TYPES, OVERLAP_TRANSITION_IDS, SCENE_PURPOSES, TEMPLATE_IDS, TRANSITION_IDS} from './storyboard';

const SafeAreaSchema = z.object({
  top: z.number().nonnegative(),
  right: z.number().nonnegative(),
  bottom: z.number().nonnegative(),
  left: z.number().nonnegative()
}).strict();

export const StyleTokensSchema = z.object({
  background: z.string().min(1), ink: z.string().min(1), muted: z.string().min(1),
  accent: z.string().min(1), accentAlt: z.string().min(1), paper: z.string().min(1),
  grid: z.string().min(1), displayFont: z.string().min(1), bodyFont: z.string().min(1),
  pattern: z.enum(['grid', 'desktop', 'dots', 'solid']), surfaceRadius: z.number().nonnegative(),
  surfaceBorder: z.string(), surfaceShadow: z.string(), labelRadius: z.number().nonnegative(),
  titleFontSize: z.number().positive()
}).strict();

export const StylePackSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  tokens: StyleTokensSchema,
  safeArea: z.object({landscape: SafeAreaSchema, portrait: SafeAreaSchema}).strict(),
  supports: z.object({
    templates: z.array(z.enum(TEMPLATE_IDS)).min(1),
    purposes: z.array(z.enum(SCENE_PURPOSES)).min(1).optional(),
    layers: z.array(z.enum(LAYER_TYPES)).min(1),
    actions: z.array(z.enum(ACTION_IDS)).min(1),
    transitions: z.array(z.enum(TRANSITION_IDS)).min(1),
    overlapTransitions: z.array(z.enum(OVERLAP_TRANSITION_IDS)).optional()
  }).strict(),
  provenance: z.object({fonts: z.string().min(1), assets: z.string().min(1)}).strict()
}).strict();

const MotionRuleSchema = z.object({durationFrames: z.number().int().positive(), easing: z.string().min(1)}).strict();

export const MotionPackSchema = z.object({
  runtime: z.object({
    enterOffset: z.number().nonnegative(), damping: z.number().positive(),
    stiffness: z.number().positive(), mass: z.number().positive(), emphasisScale: z.number().nonnegative()
  }).strict(),
  enter: MotionRuleSchema, reveal: MotionRuleSchema, highlight: MotionRuleSchema,
  focus: MotionRuleSchema, count: MotionRuleSchema
}).strict();

export const StyleIndexEntrySchema = z.object({
  id: z.string().min(1), name: z.string().min(1), version: z.string().min(1), category: z.string().min(1),
  mood: z.array(z.string().min(1)).min(1), bestFor: z.array(z.string().min(1)).min(1),
  canvas: z.array(z.enum(['landscape', 'portrait'])).min(1), templates: z.array(z.enum(TEMPLATE_IDS)).min(1),
  preview: z.string().min(1), status: z.enum(['experimental', 'stable', 'deprecated'])
}).strict();

export const StyleIndexSchema = z.object({schemaVersion: z.literal('1.0'), styles: z.array(StyleIndexEntrySchema).min(1)}).strict();

export type StylePack = z.infer<typeof StylePackSchema>;
export type MotionPack = z.infer<typeof MotionPackSchema>;
export type StyleIndex = z.infer<typeof StyleIndexSchema>;
