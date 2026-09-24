import fs from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {AssetManifestSchema} from '../src/schemas/asset-manifest.ts';
import {StoryboardSchema} from '../src/schemas/storyboard.ts';
import {MotionPackSchema, StylePackSchema} from '../src/schemas/style-pack.ts';
import {AudioConfigSchema} from '../src/schemas/audio-config.ts';

const schemas = [
  ['storyboard.schema.json', 'FrameLoom Storyboard V2.1–2.2', StoryboardSchema],
  ['style-pack.schema.json', 'FrameLoom Style Pack', StylePackSchema],
  ['motion-pack.schema.json', 'FrameLoom Motion Pack', MotionPackSchema],
  ['asset-manifest.schema.json', 'FrameLoom Asset Manifest', AssetManifestSchema],
  ['audio-config.schema.json', 'FrameLoom Audio Config', AudioConfigSchema]
];

const schemaRoot = path.resolve('schemas');
fs.mkdirSync(schemaRoot, {recursive: true});
for (const [fileName, title, schema] of schemas) {
  const jsonSchema = z.toJSONSchema(schema);
  fs.writeFileSync(path.join(schemaRoot, fileName), `${JSON.stringify({
    $schema: 'https://json-schema.org/draft/2020-12/schema', title, ...jsonSchema
  }, null, 2)}\n`);
  console.log(`GENERATED ${path.join('schemas', fileName)}`);
}
