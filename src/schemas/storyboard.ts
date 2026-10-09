import {z} from 'zod';
import {ShotSchema, ShotSelectionSchema} from './shot-recipe';
import {VideoTemplateRefSchema} from './video-template';
import {FontRefSchema} from './font';
import {ProjectPaletteSchema, PROJECT_PALETTE_STYLES} from './project-palette';

export const STORYBOARD_SCHEMA_VERSION = '2.4' as const;
export const VISUAL_KINDS = ['statement', 'compare', 'sequence', 'network', 'change', 'metric', 'media'] as const;
export const VISUAL_GLYPHS = ['document', 'search', 'map', 'list', 'person', 'timeline', 'video', 'quote', 'spark', 'database', 'chart', 'link'] as const;
export const SCENE_PURPOSES = ['opening', 'claim', 'process', 'evidence', 'media', 'closing'] as const;
export const TEMPLATE_IDS = ['statement', 'graph-explainer', 'metric-grid', 'interaction-flow'] as const;
export const LAYER_TYPES = ['node', 'card', 'label', 'annotation', 'metric', 'screenshot', 'object', 'callout'] as const;
export const ACTION_IDS = ['enter', 'reveal', 'draw', 'focus', 'highlight', 'count', 'camera-push', 'rotate', 'set-state', 'dock', 'demote', 'trace', 'tape'] as const;
export const TRANSITION_IDS = ['fade', 'slide', 'paper-wipe', 'carry'] as const;
export const OVERLAP_TRANSITION_IDS = ['overlap-fade', 'overlap-slide', 'overlap-carry', 'overlap-blinds', 'overlap-push-stack', 'overlap-line-carry', 'overlap-ink', 'overlap-barn-door'] as const;
export const NODE_STATES = ['upcoming', 'current', 'completed', 'resolved'] as const;

export const StoryboardStatusSchema = z.enum(['draft', 'generated', 'validated', 'reviewed', 'approved']);
export const TemplateIdSchema = z.enum(TEMPLATE_IDS);
export const ScenePurposeSchema = z.enum(SCENE_PURPOSES);
export const LayerTypeSchema = z.enum(LAYER_TYPES);
export const ActionIdSchema = z.enum(ACTION_IDS);
export const TransitionIdSchema = z.enum(TRANSITION_IDS);
export const NodeStateSchema = z.enum(NODE_STATES);
export const VisualKindSchema = z.enum(VISUAL_KINDS);
export const VisualGlyphSchema = z.enum(VISUAL_GLYPHS);
export const OverlapTransitionSchema = z.union([
  z.object({type: z.enum(['overlap-fade', 'overlap-slide', 'overlap-carry']), durationFrames: z.number().int().positive()}).strict(),
  z.object({type: z.enum(['overlap-blinds', 'overlap-push-stack', 'overlap-ink', 'overlap-barn-door']), durationFrames: z.number().int().positive(), chapterBoundary: z.literal(true)}).strict(),
  z.object({type: z.literal('overlap-line-carry'), durationFrames: z.number().int().positive(), chapterBoundary: z.literal(true), carryKey: z.string().min(1).max(50)}).strict()
]);

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
  rotationDegrees: z.number().optional(),
  semanticRole: z.string().min(1).optional(),
  glyph: VisualGlyphSchema.optional(),
  target: z.string().min(1).optional(),
  fit: z.enum(['contain', 'cover']).optional(),
  state: NodeStateSchema.optional(),
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
  state: NodeStateSchema.optional(),
  start: z.number().nonnegative(),
  duration: z.number().positive()
}).strict();

export const StoryboardCaptionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  start: z.number().nonnegative(),
  end: z.number().positive()
}).strict();

export const SceneVisualSchema = z.object({
  kind: VisualKindSchema,
  explanation: z.string().min(1),
  representation: z.enum(['diagram', 'source-media']),
  shotPattern: z.enum(['document-conclusion-deal']).optional(),
  networkDirection: z.enum(['outward', 'inward']).optional(),
  changeMode: z.enum(['compare', 'replace']).optional(),
  mediaFocus: z.object({
    x: z.number().min(0).max(1), y: z.number().min(0).max(1),
    width: z.number().min(0.25).max(1), height: z.number().min(0.25).max(1),
    start: z.number().nonnegative(), duration: z.number().positive(),
    label: z.string().min(1).max(40)
  }).strict().refine((focus) => focus.x + focus.width <= 1 && focus.y + focus.height <= 1, '聚焦区域不能超出图片。').optional(),
  anchorId: z.string().min(1).optional(),
  beforeId: z.string().min(1).optional(),
  afterId: z.string().min(1).optional(),
  unit: z.string().min(1).optional(),
  source: z.string().min(1).optional()
}).strict();

export const StoryboardSceneSchema = z.object({
  id: z.string().min(1).max(120).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'scene id 只能包含字母、数字、下划线和连字符，且不能作为路径。'),
  template: TemplateIdSchema,
  purpose: ScenePurposeSchema.optional(),
  title: z.string(),
  primaryClaim: z.string().min(1).optional(),
  visual: SceneVisualSchema.optional(),
  shot: ShotSchema.optional(),
  attentionTarget: z.string().min(1).optional(),
  narration: z.string(),
  durationFrames: z.number().int().positive(),
  layers: z.array(StoryboardLayerSchema),
  connections: z.array(StoryboardConnectionSchema),
  beats: z.array(StoryboardBeatSchema),
  captions: z.array(StoryboardCaptionSchema),
  transitionIn: OverlapTransitionSchema.optional(),
  transitionOut: TransitionIdSchema.optional(),
  outro: z.object({holdFrames: z.number().int().nonnegative(), fadeFrames: z.number().int().nonnegative()}).strict().optional()
}).strict();

export const StoryboardSchema = z.object({
  schemaVersion: z.enum(['2.1', '2.2', '2.3', STORYBOARD_SCHEMA_VERSION]),
  style: StoryboardStyleRefSchema,
  font: FontRefSchema.optional(),
  palette: ProjectPaletteSchema.optional(),
  videoTemplate: VideoTemplateRefSchema.optional(),
  shotRecipes: ShotSelectionSchema.optional(),
  project: StoryboardProjectSchema,
  scenes: z.array(StoryboardSceneSchema).min(1)
}).strict().superRefine((board, ctx) => {
  if (board.palette) {
    if (board.schemaVersion !== '2.4') ctx.addIssue({code: 'custom', path: ['palette'], message: '项目配色仅支持 2.4。'});
    if (board.project.width <= board.project.height) ctx.addIssue({code: 'custom', path: ['palette'], message: '项目配色首版仅支持横屏。'});
    if (!(PROJECT_PALETTE_STYLES as readonly string[]).includes(board.style.id)) ctx.addIssue({code: 'custom', path: ['palette'], message: '当前风格未声明项目配色能力。'});
    for (const scene of board.scenes) {
      const native = scene.shot && ['semantic-default', 'compare-reveal', 'network-expand'].includes(scene.shot.id);
      if (!scene.shot || scene.shot.version !== (native ? '1.0.0' : '1.2.0')) ctx.addIssue({code: 'custom', path: ['palette'], message: '项目配色不能用于历史镜头版本。'});
    }
  }
  if (board.schemaVersion !== '2.4' && board.videoTemplate) ctx.addIssue({code: 'custom', path: ['videoTemplate'], message: 'videoTemplate 仅支持 2.4。'});
  if (board.schemaVersion !== '2.4' && board.shotRecipes) ctx.addIssue({code: 'custom', path: ['shotRecipes'], message: 'shotRecipes 仅支持 2.4。'});
  board.scenes.forEach((scene, index) => {
    const fail = (field: string, message: string) => ctx.addIssue({code: 'custom', path: ['scenes', index, field], message});
    if (board.schemaVersion === '2.4') {
      if (!scene.shot) fail('shot', '2.4 每场必须显式声明 shot。');
      if (!scene.visual) fail('visual', '2.4 每场必须声明 visual。');
      if (scene.visual?.shotPattern) fail('visual.shotPattern', '2.4 不接受旧 shotPattern，请显式迁移。');
    } else {
      if (scene.transitionIn && ['overlap-blinds', 'overlap-push-stack', 'overlap-line-carry', 'overlap-ink', 'overlap-barn-door'].includes(scene.transitionIn.type)) fail('transitionIn', '换章配方仅支持 2.4。');
      if (scene.shot) fail('shot', 'shot 仅支持 2.4。');
      if (scene.beats.some((beat) => ['dock', 'demote', 'trace', 'tape'].includes(beat.action))) fail('beats', '配方专用动作仅支持 2.4。');
    }
  });
});

export type StoryboardStatus = z.infer<typeof StoryboardStatusSchema>;
export type TemplateId = z.infer<typeof TemplateIdSchema>;
export type ScenePurpose = z.infer<typeof ScenePurposeSchema>;
export type LayerType = z.infer<typeof LayerTypeSchema>;
export type ActionId = z.infer<typeof ActionIdSchema>;
export type TransitionId = z.infer<typeof TransitionIdSchema>;
export type StoryboardStyleRef = z.infer<typeof StoryboardStyleRefSchema>;
export type StoryboardProject = z.infer<typeof StoryboardProjectSchema>;
export type StoryboardLayer = z.infer<typeof StoryboardLayerSchema>;
export type StoryboardConnection = z.infer<typeof StoryboardConnectionSchema>;
export type StoryboardBeat = z.infer<typeof StoryboardBeatSchema>;
export type StoryboardCaption = z.infer<typeof StoryboardCaptionSchema>;
export type SceneVisual = z.infer<typeof SceneVisualSchema>;
export type StoryboardScene = z.infer<typeof StoryboardSceneSchema>;
export type Storyboard = z.infer<typeof StoryboardSchema>;

export function isStoryboard(value: unknown): value is Storyboard {
  return StoryboardSchema.safeParse(value).success;
}
