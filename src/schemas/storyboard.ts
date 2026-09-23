import {z} from 'zod';

export const STORYBOARD_SCHEMA_VERSION = '2.1' as const;
export const TEMPLATE_IDS = ['statement', 'graph-explainer', 'metric-grid', 'interaction-flow'] as const;
export const LAYER_TYPES = ['node', 'card', 'label', 'annotation', 'metric', 'screenshot'] as const;
export const ACTION_IDS = ['enter', 'reveal', 'draw', 'focus', 'highlight', 'count', 'camera-push'] as const;
export const TRANSITION_IDS = ['fade', 'slide', 'paper-wipe', 'carry'] as const;

export const StoryboardStatusSchema = z.enum(['draft', 'reviewed', 'approved']);
export const TemplateIdSchema = z.enum(TEMPLATE_IDS);
export const LayerTypeSchema = z.enum(LAYER_TYPES);
export const ActionIdSchema = z.enum(ACTION_IDS);
export const TransitionIdSchema = z.enum(TRANSITION_IDS);

export const StoryboardStyleRefSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1)
}).strict();

export const StoryboardProjectSchema = z.object({
  title: z.string().min(1),
  width: z.number().positive(),
  height: z.number().positive(),
  fps: z.number().positive(),
  durationSec: z.number().positive(),
  durationFrames: z.number().int().positive(),
  status: StoryboardStatusSchema
}).strict();

export const StoryboardLayerSchema = z.object({
  id: z.string().min(1),
  type: LayerTypeSchema,
  text: z.string().optional(),
  label: z.string().optional(),
  value: z.union([z.string(), z.number()]).optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  color: z.string().optional(),
  asset: z.string().min(1).optional(),
  assetDataUri: z.string().min(1).optional(),
  rotate: z.number().optional(),
  replacementGroup: z.string().min(1).optional(),
  visibleFrom: z.number().nonnegative().optional(),
  visibleUntil: z.number().positive().optional()
}).strict();

export const StoryboardConnectionSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  label: z.string().optional()
}).strict();

export const StoryboardBeatSchema = z.object({
  id: z.string().min(1),
  target: z.string().min(1),
  action: ActionIdSchema,
  start: z.number().nonnegative(),
  duration: z.number().positive()
}).strict();

export const StoryboardCaptionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  start: z.number().nonnegative(),
  end: z.number().positive()
}).strict();

export const StoryboardSceneSchema = z.object({
  id: z.string().min(1),
  template: TemplateIdSchema,
  title: z.string(),
  narration: z.string(),
  durationFrames: z.number().int().positive(),
  layers: z.array(StoryboardLayerSchema),
  connections: z.array(StoryboardConnectionSchema),
  beats: z.array(StoryboardBeatSchema),
  captions: z.array(StoryboardCaptionSchema),
  transitionOut: TransitionIdSchema.optional()
}).strict();

export const StoryboardSchema = z.object({
  schemaVersion: z.literal(STORYBOARD_SCHEMA_VERSION),
  style: StoryboardStyleRefSchema,
  project: StoryboardProjectSchema,
  scenes: z.array(StoryboardSceneSchema).min(1)
}).strict();

export type StoryboardStatus = z.infer<typeof StoryboardStatusSchema>;
export type TemplateId = z.infer<typeof TemplateIdSchema>;
export type LayerType = z.infer<typeof LayerTypeSchema>;
export type ActionId = z.infer<typeof ActionIdSchema>;
export type TransitionId = z.infer<typeof TransitionIdSchema>;
export type StoryboardStyleRef = z.infer<typeof StoryboardStyleRefSchema>;
export type StoryboardProject = z.infer<typeof StoryboardProjectSchema>;
export type StoryboardLayer = z.infer<typeof StoryboardLayerSchema>;
export type StoryboardConnection = z.infer<typeof StoryboardConnectionSchema>;
export type StoryboardBeat = z.infer<typeof StoryboardBeatSchema>;
export type StoryboardCaption = z.infer<typeof StoryboardCaptionSchema>;
export type StoryboardScene = z.infer<typeof StoryboardSceneSchema>;
export type Storyboard = z.infer<typeof StoryboardSchema>;

export function isStoryboard(value: unknown): value is Storyboard {
  return StoryboardSchema.safeParse(value).success;
}
