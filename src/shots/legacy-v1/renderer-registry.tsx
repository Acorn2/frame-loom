import {TitleP1} from './shortlist/TitleP1';
import {WordP1} from './shortlist/WordP1';
import {StructureP1} from './shortlist/StructureP1';
import {DataP1} from './shortlist/DataP1';
import React from 'react';
import {useVideoConfig} from 'remotion';
import {compileShot} from '../compile-shot';
import type {ShotRenderProps} from './ShotShell';
import {DocumentConclusions} from './document-conclusions/DocumentConclusions';
import {PaperTitle} from './paper-title/PaperTitle';
import {ListReveal} from './list-reveal/ListReveal';
import {TitleToLabel} from './title-to-label/TitleToLabel';
import {SemanticScene} from '../../templates/semantic/SemanticScene';
import type {ShotId} from '../../schemas/shot-recipe';
import type {ShotPlan} from '../compile-shot';
import {TitleEntrance} from './shortlist/TitleEntrance';
import {CollectionShots} from './shortlist/CollectionShots';
import {RelationShots} from './shortlist/RelationShots';

const NativeShot = ({plan: _plan, ...props}: ShotRenderProps & {plan: ShotPlan}) => <SemanticScene {...props} />;
export const SHOT_RENDERERS = {
  'semantic-default': NativeShot,
  'paper-title': PaperTitle,
  'title-to-label': TitleToLabel,
  'document-conclusions': DocumentConclusions,
  'list-reveal': ListReveal,
  'compare-reveal': NativeShot,
  'network-expand': NativeShot,
  'blur-slide': TitleEntrance,
  'split-text-stagger': TitleEntrance,
  'card-stack': CollectionShots,
  'concept-matrix': CollectionShots,
  'platform-hinge-rise': CollectionShots,
  'source-converge': RelationShots,
  'diagram-cascade': RelationShots,
  'lead-word-assemble': TitleP1,
  'brace-expand': TitleP1,
  'pill-slot-cycle': WordP1,
  'word-roll': WordP1,
  'text-column-converge': WordP1,
  'evidence-relay': StructureP1,
  'row-embed': StructureP1,
  'structure-then-text': StructureP1,
  'timeline-travel': DataP1,
  'odometer-roll': DataP1
} satisfies Partial<Record<ShotId, React.ComponentType<ShotRenderProps & {plan: ShotPlan}>>>;

export function RenderShot(props: ShotRenderProps & {styleVersion: string}) {
  const config = useVideoConfig();
  const shot = props.scene.shot;
  if (!shot) throw new Error('2.4 requires explicit shot');
  const plan = compileShot(props.scene, {...config, style: {id: props.tokens.id, version: props.styleVersion}, overlapOutFrames: props.overlapOutFrames});
  const renderers: Partial<Record<ShotId, React.ComponentType<ShotRenderProps & {plan: ShotPlan}>>> = SHOT_RENDERERS;
  const Renderer = renderers[shot.id];
  if (!Renderer) throw new Error(`Missing historical renderer: ${shot.id}`);
  const ordered = 'items' in shot.slots && ['compare-reveal', 'network-expand'].includes(shot.id)
    ? {...props.scene, layers: [...('anchor' in shot.slots ? [shot.slots.anchor] : []), ...shot.slots.items].map((id) => props.scene.layers.find((layer) => layer.id === id)!)} : props.scene;
  return <Renderer {...props} scene={ordered} plan={plan} />;
}
