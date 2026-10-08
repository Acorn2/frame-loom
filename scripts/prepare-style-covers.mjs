import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {loadStyleIndex, projectRoot} from './lib/style-catalog.mjs';

// A readable title frame from the same existing public video as the full preview.
// No new motion, facts or user production video is generated.
const folder = path.join(projectRoot, 'library/style-covers');
fs.mkdirSync(folder, {recursive: true});
const covers = [];
for (const style of loadStyleIndex().styles.filter(item => item.status !== 'deprecated')) {
  const source = `examples/template-families/previews/${style.id}-semantic.mp4`;
  const file = path.join(projectRoot, source);
  const cover = path.join(folder, `${style.id}.png`);
  const result = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '4.5', '-i', file, '-frames:v', '1', '-vf', 'scale=960:540', cover], {encoding:'utf8'});
  if (result.error || result.status !== 0) throw new Error(`无法准备 ${style.id} 封面：${result.error?.message ?? result.stderr}`);
  covers.push({id:style.id, source, sourceSha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex'), timeSec:4.5, width:960, height:540});
}
fs.writeFileSync(path.join(folder, 'manifest.json'), `${JSON.stringify({purpose:'public-style-card-covers', covers}, null, 2)}\n`);
console.log(`STYLE COVERS ${covers.length} title frames extracted from existing public videos`);
