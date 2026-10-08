import {VIDEO_TEMPLATES} from '../src/video-templates/resolve-template.ts';
import {SHOT_CATALOG} from '../src/shots/catalog.ts';
const args = process.argv.slice(2);
if (args.length && !(args.length === 2 && args[0] === '--template')) throw new Error('Usage: npm run list:video-templates -- [--template <id>]');
const selected = args.length ? VIDEO_TEMPLATES.filter((item) => item.id === args[1]) : VIDEO_TEMPLATES;
if (!selected.length) throw new Error(`未知视频模板 ${args[1]}。`);
for (const template of selected) {
  console.log(`${template.id}@${template.version} (${template.status}) style=${template.defaultStyle.id}@${template.defaultStyle.version} canvas=${template.orientations.join(',')}`);
  for (const shot of template.shots) console.log(`  ${shot.id}@${shot.version}: ${SHOT_CATALOG.find((item) => item.id === shot.id).purpose}`);
}
