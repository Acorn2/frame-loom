import {AuxiliaryManifestSchema} from '../src/shots/auxiliary-catalog.ts';
import {ChapterManifestSchema} from '../src/shots/shortlist/chapter-transitions.tsx';
import fs from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {ShotSchema, ShotManifestSchema} from '../src/schemas/shot-recipe.ts';
import {VideoTemplateSchema} from '../src/schemas/video-template.ts';
import {AssetManifestSchema} from '../src/schemas/asset-manifest.ts';
import {StoryboardSchema} from '../src/schemas/storyboard.ts';
import {MotionPackSchema, StylePackSchema} from '../src/schemas/style-pack.ts';
import {AudioConfigSchema} from '../src/schemas/audio-config.ts';
import {AudioManifestSchema} from '../src/schemas/audio-manifest.ts';
import {ProjectInputSchema} from '../src/schemas/project-input.ts';
import {TtsConfigSchema} from '../src/schemas/tts-config.ts';

const schemas = [
  ['auxiliary-recipe.schema.json', 'FrameLoom Hosted Action Recipe', AuxiliaryManifestSchema],
  ['chapter-transition.schema.json', 'FrameLoom Chapter Transition Recipe', ChapterManifestSchema],
  ['shot.schema.json', 'FrameLoom Shot Selection', ShotSchema],
  ['shot-recipe.schema.json', 'FrameLoom Shot Recipe', ShotManifestSchema],
  ['video-template.schema.json', 'FrameLoom Video Template', VideoTemplateSchema],
  ['storyboard.schema.json', 'FrameLoom Storyboard V2.1–2.4', StoryboardSchema],
  ['style-pack.schema.json', 'FrameLoom Style Pack', StylePackSchema],
  ['motion-pack.schema.json', 'FrameLoom Motion Pack', MotionPackSchema],
  ['asset-manifest.schema.json', 'FrameLoom Asset Manifest', AssetManifestSchema],
  ['audio-config.schema.json', 'FrameLoom Audio Config', AudioConfigSchema],
  ['audio-manifest.schema.json', 'FrameLoom Audio Manifest', AudioManifestSchema],
  ['project-input.schema.json', 'FrameLoom Project Input', ProjectInputSchema],
  ['tts-config.schema.json', 'FrameLoom TTS Config', TtsConfigSchema]
];

const schemaRoot = path.resolve('schemas');
fs.mkdirSync(schemaRoot, {recursive: true});
for (const [fileName, title, schema] of schemas) {
  const jsonSchema = z.toJSONSchema(schema);
  if (fileName === 'storyboard.schema.json') {
    jsonSchema.allOf = [
      {if: {properties: {schemaVersion: {const: '2.4'}}}, then: {properties: {shotRecipes: {uniqueItems: true}, scenes: {items: {required: ['shot', 'visual'], properties: {visual: {not: {required: ['shotPattern']}}}}}}}, else: {not: {anyOf: [{required: ['videoTemplate']}, {required: ['shotRecipes']}]}, properties: {scenes: {items: {not: {required: ['shot']}, properties: {transitionIn: {properties: {type: {not: {enum: ['overlap-blinds', 'overlap-push-stack', 'overlap-line-carry', 'overlap-ink', 'overlap-barn-door']}}}}, beats: {items: {properties: {action: {not: {enum: ['dock', 'demote', 'trace', 'tape']}}}}}}}}}}}
    ];
  }
  fs.writeFileSync(path.join(schemaRoot, fileName), `${JSON.stringify({
    $schema: 'https://json-schema.org/draft/2020-12/schema', title, ...jsonSchema
  }, null, 2)}\n`);
  console.log(`GENERATED ${path.join('schemas', fileName)}`);
}
