import {z} from 'zod';
export const P2_IDS = ['research-stack', 'list-stack-press', 'integration-hub', 'scroll-brake', 'chart-live', 'particle-sand-fill', 'member-grid', 'ring-annotation', 'cycle-mechanism', 'media-before-after', 'document-write', 'code-reveal', 'letterspace-materialize'] as const;
export const P2_EFFECT_IDS = ['scanline-annotate-focus', 'scan-bracket-sweep', 'line-boil', 'speed-ramp-freeze', 'mosaic-reframe'] as const;
const ref = z.string().min(1);
const items = (min: number, max: number) => z.array(ref).min(min).max(max);
const effect = z.object({id: z.enum(P2_EFFECT_IDS), target: ref}).strict();
const base = {version: z.literal('1.2.0'), effects: z.array(effect).max(1).optional()};
const path = z.string().min(3).max(2400).regex(/^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\s-]+$/u, '只允许 SVG 路径几何，不接受标记或外部内容').refine(d=>/^[Mm]\s*[-+0-9.]/.test(d) && (d.match(/[-+]?(?:\d*\.?\d+)(?:[eE][-+]?\d+)?/g)??[]).every(n=>Number.isFinite(Number(n)) && Math.abs(Number(n))<=120), '字形坐标须落在120单位范围内');
export const P2_SCHEMAS = [
  z.object({id: z.literal('research-stack'), ...base, authors: z.record(ref, z.string().min(1).max(40)), slots: z.object({items: items(2, 5)}).strict()}).strict(),
  z.object({id: z.literal('list-stack-press'), ...base, slots: z.object({items: items(2, 5)}).strict()}).strict(),
  z.object({id: z.literal('integration-hub'), ...base, slots: z.object({before: ref, hub: ref, items: items(2, 4)}).strict()}).strict(),
  z.object({id: z.literal('scroll-brake'), ...base, focusId: ref, slots: z.object({items: items(4, 8)}).strict()}).strict(),
  z.object({id: z.literal('chart-live'), ...base, samples: z.array(z.object({label: z.string().min(1).max(6), value: z.number().min(0).max(1e9)}).strict()).min(4).max(24), slots: z.object({series: ref}).strict()}).strict(),
  z.object({id: z.literal('particle-sand-fill'), ...base, grainUnit: z.number().positive().max(1e9), slots: z.object({items: items(3, 5)}).strict()}).strict(),
  z.object({id: z.literal('member-grid'), ...base, flagged: z.array(ref).max(12), slots: z.object({items: items(4, 12)}).strict()}).strict(),
  z.object({id: z.literal('ring-annotation'), ...base, slots: z.object({subject: ref, items: items(2, 4)}).strict()}).strict(),
  z.object({id: z.literal('cycle-mechanism'), ...base, slots: z.object({subject: ref, items: items(3, 4)}).strict()}).strict(),
  z.object({id: z.literal('media-before-after'), ...base, slots: z.object({before: ref, after: ref}).strict()}).strict(),
  z.object({id: z.literal('document-write'), ...base, slots: z.object({blocks: items(2, 5)}).strict()}).strict(),
  z.object({id: z.literal('code-reveal'), ...base, mode: z.enum(['lines', 'characters']), tokens: z.array(z.object({text: z.string().min(1), kind: z.enum(['plain', 'keyword', 'string', 'number', 'comment'])}).strict()).min(1).max(80), slots: z.object({code: ref}).strict()}).strict(),
  z.object({id: z.literal('letterspace-materialize'), ...base, glyphs: z.array(z.object({character: z.string().length(1), paths: z.array(path).min(1).max(8), advance: z.number().min(20).max(120)}).strict()).min(2).max(8), slots: z.object({title: ref}).strict()}).strict()
] as const;
export const P2ShotSchema = z.discriminatedUnion('id', P2_SCHEMAS);
export type P2Shot = z.infer<typeof P2ShotSchema>;
export function isP2Shot(shot: {id: string}): shot is P2Shot {return (P2_IDS as readonly string[]).includes(shot.id);}
