import {P2_IDS, P2_SCHEMAS} from '../shots/p2/schema';
import {z} from 'zod';

export const SHOT_IDS = ['semantic-default', 'paper-title', 'title-to-label', 'document-conclusions', 'list-reveal', 'compare-reveal', 'network-expand', 'blur-slide', 'split-text-stagger', 'card-stack', 'concept-matrix', 'platform-hinge-rise', 'source-converge', 'diagram-cascade', 'lead-word-assemble', 'brace-expand', 'pill-slot-cycle', 'word-roll', 'text-column-converge', 'evidence-relay', 'row-embed', 'structure-then-text', 'timeline-travel', 'odometer-roll', ...P2_IDS] as const;
export const ShotRefSchema = z.object({id: z.enum(SHOT_IDS), version: z.enum(['1.0.0', '1.1.0', '1.2.0'])}).strict();
export const ShotSelectionSchema = z.array(ShotRefSchema).min(1).max(SHOT_IDS.length).refine((shots) => new Set(shots.map((shot) => shot.id)).size === shots.length, '镜头配方集合不能包含重复 ID。');
export type ShotRef = z.infer<typeof ShotRefSchema>;
const ref = z.string().min(1);
const identity = {version: z.enum(['1.0.0', '1.1.0', '1.2.0'])};
export const DocumentConclusionsSchema = z.object({id: z.literal('document-conclusions'), ...identity, slots: z.object({source: ref, items: z.array(ref).length(3)}).strict()}).strict();
export const ShotSchema = z.discriminatedUnion('id', [
  ...P2_SCHEMAS,
  z.object({id: z.literal('semantic-default'), ...identity, slots: z.object({}).strict()}).strict(),
  z.object({id: z.literal('paper-title'), ...identity, slots: z.object({phrases: z.array(ref).min(1).max(4), emphasis: ref.optional()}).strict()}).strict(),
  z.object({id: z.literal('title-to-label'), ...identity, slots: z.object({title: ref, items: z.array(ref).min(2).max(4)}).strict()}).strict(),
  DocumentConclusionsSchema,
  z.object({id: z.literal('list-reveal'), ...identity, slots: z.object({items: z.array(ref).min(2).max(4)}).strict()}).strict(),
  z.object({id: z.literal('compare-reveal'), ...identity, slots: z.object({items: z.array(ref).min(2).max(3)}).strict()}).strict(),
  z.object({id: z.literal('network-expand'), ...identity, slots: z.object({anchor: ref, items: z.array(ref).min(2).max(5)}).strict()}).strict(),
  z.object({id: z.literal('blur-slide'), ...identity, slots: z.object({phrases: z.array(ref).min(1).max(4), subtitle: ref, emphasis: ref.optional()}).strict()}).strict(),
  z.object({id: z.literal('split-text-stagger'), ...identity, slots: z.object({phrases: z.array(ref).min(1).max(4), emphasis: ref.optional()}).strict()}).strict(),
  z.object({id: z.literal('card-stack'), ...identity, treatment: z.literal('masking-tape').optional(), slots: z.object({items: z.array(ref).min(2).max(4)}).strict()}).strict(),
  z.object({id: z.literal('concept-matrix'), ...identity, variant: z.enum(['bento-light-up', 'wireframe-draw-on']), revealMode: z.literal('card-flip').optional(), slots: z.object({items: z.array(ref).min(2).max(4), fronts: z.array(ref).min(2).max(4).optional()}).strict()}).strict(),
  z.object({id: z.literal('platform-hinge-rise'), ...identity, slots: z.object({items: z.array(ref).length(2), result: ref}).strict()}).strict(),
  z.object({id: z.literal('source-converge'), ...identity, slots: z.object({items: z.array(ref).min(2).max(4), result: ref}).strict()}).strict(),
  z.object({id: z.literal('diagram-cascade'), ...identity, slots: z.object({root: ref, items: z.array(ref).min(2).max(4)}).strict()}).strict(),
  z.object({id: z.literal('lead-word-assemble'), ...identity, slots: z.object({phrases: z.array(ref).min(2).max(4)}).strict()}).strict(),
  z.object({id: z.literal('brace-expand'), ...identity, slots: z.object({title: ref}).strict()}).strict(),
  z.object({id: z.literal('pill-slot-cycle'), ...identity, slots: z.object({prefix: ref, items: z.array(ref).min(2).max(4), suffix: ref.optional()}).strict()}).strict(),
  z.object({id: z.literal('word-roll'), ...identity, slots: z.object({prefix: ref, items: z.array(ref).min(2).max(4), suffix: ref.optional()}).strict()}).strict(),
  z.object({id: z.literal('text-column-converge'), ...identity, slots: z.object({prefix: ref, items: z.array(ref).min(2).max(4), result: ref}).strict()}).strict(),
  z.object({id: z.literal('evidence-relay'), ...identity, slots: z.object({items: z.array(ref).min(2).max(4), keywords: z.array(ref).min(2).max(4)}).strict()}).strict(),
  z.object({id: z.literal('row-embed'), ...identity, treatment: z.literal('masking-tape').optional(), slots: z.object({items: z.array(ref).min(2).max(4)}).strict()}).strict(),
  z.object({id: z.literal('structure-then-text'), ...identity, slots: z.object({items: z.array(ref).min(2).max(4)}).strict()}).strict(),
  z.object({id: z.literal('timeline-travel'), ...identity, spacing: z.literal('ordinal'), slots: z.object({items: z.array(ref).min(2).max(4)}).strict()}).strict(),
  z.object({id: z.literal('odometer-roll'), ...identity, slots: z.object({metric: ref}).strict()}).strict()
]);
const budget = z.object({min: z.number().int().nonnegative(), max: z.number().int().positive(), labelMax: z.number().int().positive().optional(), textMax: z.number().int().positive().optional()}).strict();
export const ShotManifestSchema = z.object({
  id: z.enum(SHOT_IDS), version: z.enum(['1.0.0', '1.1.0', '1.2.0']), status: z.enum(['experimental', 'stable', 'deprecated']), registered: z.literal(true),
  visualKinds: z.array(z.enum(['statement', 'compare', 'sequence', 'network', 'change', 'metric', 'media'])).min(1), purpose: z.string().min(1),
  inputModes: z.array(z.enum(['document-only', 'document-with-assets'])).min(1), requiredAssets: z.array(z.string()),
  styles: z.array(z.string()).min(1), orientations: z.array(z.enum(['landscape', 'portrait'])).min(1), slots: z.record(z.string(), budget),
  timing: z.object({actions: z.record(z.string(), z.object({minSec: z.number().positive(), maxSec: z.number().positive()}).strict()), readingSec: z.number().positive(), titleHoldSec: z.number().positive(), sourceHoldSec: z.number().positive(), itemHoldSec: z.number().positive()}).strict(),
  motion: z.object({recipeOwned: z.array(z.string()), styleOwned: z.array(z.string()), continuousDrift: z.literal(false)}).strict(),
  qa: z.array(z.string()).min(1), sound: z.object({enabled: z.literal(false), events: z.array(z.string())}).strict()
}).strict();
export type Shot = z.infer<typeof ShotSchema>;
export type ShotId = Shot['id'];
export type ShotManifest = z.infer<typeof ShotManifestSchema>;
