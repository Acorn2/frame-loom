import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {samplePalette} from './lib/palette-sampling.mjs';
export {samplePalette} from './lib/palette-sampling.mjs';

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const [project, assetFlag, assetId, regionFlag, region, ...rest] = process.argv.slice(2);
    if (!project || assetFlag !== '--asset' || !assetId || regionFlag !== '--region' || !region || rest.length) throw new Error('Usage: npm run sample:palette -- <project-dir> --asset <id> --region <x,y,width,height>');
    console.log(JSON.stringify(samplePalette(project, assetId, region.split(',').map(Number)), null, 2));
  } catch (error) {console.error(error.message); process.exitCode = 1;}
}
