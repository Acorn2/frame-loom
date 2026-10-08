import p2effect0 from '../../shots/scanline-annotate-focus/manifest.json';
import p2effect1 from '../../shots/scan-bracket-sweep/manifest.json';
import p2effect2 from '../../shots/line-boil/manifest.json';
import p2effect3 from '../../shots/speed-ramp-freeze/manifest.json';
import p2effect4 from '../../shots/mosaic-reframe/manifest.json';
import previous0 from '../../shots/marker-underline/history/1.1.0.manifest.json';
import previous1 from '../../shots/paper-tape/history/1.1.0.manifest.json';
import previous2 from '../../shots/card-flip/history/1.1.0.manifest.json';
import previous3 from '../../shots/outline-trace/history/1.1.0.manifest.json';
import history3 from '../../shots/card-flip/history/1.0.0.manifest.json';
import history2 from '../../shots/paper-tape/history/1.0.0.manifest.json';
import history1 from '../../shots/outline-trace/history/1.0.0.manifest.json';
import history0 from '../../shots/marker-underline/history/1.0.0.manifest.json';
import {z} from 'zod';
import marker from '../../shots/marker-underline/manifest.json';
import outline from '../../shots/outline-trace/manifest.json';
import tape from '../../shots/paper-tape/manifest.json';
import flip from '../../shots/card-flip/manifest.json';
import type {StoryboardScene} from '../schemas/storyboard';
const common = {version: z.enum(['1.0.0', '1.1.0', '1.2.0']), status: z.literal('experimental'), kind: z.literal('hosted-action'), styles: z.array(z.string()).min(1), orientations: z.array(z.literal('landscape')).min(1), sound: z.literal(false), requires: z.array(z.string()).min(1)};
export const AuxiliaryManifestSchema = z.discriminatedUnion('id', [
  z.object({...common, id: z.literal('scanline-annotate-focus'), shortlist: z.literal('C04'), hosts: z.array(z.literal('document-write')).min(1), action: z.literal('highlight'), targetSlot: z.literal('blocks')}).strict(),
  z.object({...common, id: z.literal('scan-bracket-sweep'), shortlist: z.literal('C05'), hosts: z.array(z.literal('document-write')).min(1), action: z.literal('highlight'), targetSlot: z.literal('blocks')}).strict(),
  z.object({...common, id: z.literal('line-boil'), shortlist: z.literal('C06'), hosts: z.array(z.literal('ring-annotation')).min(1), action: z.literal('highlight'), targetSlot: z.literal('subject')}).strict(),
  z.object({...common, id: z.literal('speed-ramp-freeze'), shortlist: z.literal('C07'), hosts: z.array(z.literal('scroll-brake')).min(1), action: z.literal('highlight'), targetSlot: z.literal('items')}).strict(),
  z.object({...common, id: z.literal('mosaic-reframe'), shortlist: z.literal('C14'), hosts: z.array(z.literal('member-grid')).min(1), action: z.literal('highlight'), targetSlot: z.literal('items')}).strict(),
  z.object({...common, id: z.literal('marker-underline'), shortlist: z.literal('C01'), hosts: z.array(z.enum(['paper-title', 'blur-slide', 'split-text-stagger'])).min(1), action: z.literal('highlight'), targetSlot: z.literal('emphasis')}).strict(),
  z.object({...common, id: z.literal('outline-trace'), shortlist: z.literal('C02'), hosts: z.array(z.literal('structure-then-text')).min(1), action: z.literal('trace'), targetSlot: z.literal('items')}).strict(),
  z.object({...common, id: z.literal('paper-tape'), shortlist: z.literal('C03'), hosts: z.array(z.enum(['card-stack', 'row-embed'])).min(1), action: z.literal('tape'), targetSlot: z.literal('items')}).strict(),
  z.object({...common, id: z.literal('card-flip'), shortlist: z.literal('C08'), hosts: z.array(z.literal('concept-matrix')).min(1), action: z.literal('enter'), targetSlot: z.literal('items')}).strict()
]);
export const AUXILIARY_CATALOG = [marker, outline, tape, flip, p2effect0, p2effect1, p2effect2, p2effect3, p2effect4].map((value) => AuxiliaryManifestSchema.parse(value));
const LEGACY_AUXILIARIES = [history0, history1, history2, history3].map((value) => AuxiliaryManifestSchema.parse(value));
const PREVIOUS_AUXILIARIES = [previous0, previous1, previous2, previous3].map(value => AuxiliaryManifestSchema.parse(value));
export function sceneAuxiliaries(scene: StoryboardScene) {
  const shot = scene.shot;
  return (shot?.version === '1.0.0' ? LEGACY_AUXILIARIES : shot?.version === '1.1.0' ? PREVIOUS_AUXILIARIES : AUXILIARY_CATALOG).filter((recipe) => {
    if (!recipe.hosts.some((id) => id === shot?.id)) return false;
    if (shot && 'effects' in shot && shot.effects?.some(effect => effect.id === recipe.id)) return true;
    if (recipe.id === 'outline-trace') return scene.beats.some((beat) => beat.action === 'trace');
    if (recipe.id === 'paper-tape') return shot && 'treatment' in shot && shot.treatment === 'masking-tape' && scene.beats.some((beat) => beat.action === 'tape');
    if (recipe.id === 'card-flip') return shot?.id === 'concept-matrix' && shot.revealMode === 'card-flip';
    const emphasis = shot && 'emphasis' in shot.slots ? shot.slots.emphasis : undefined;
    return emphasis && scene.beats.some((beat) => beat.action === 'highlight' && beat.target === emphasis);
  });
}
