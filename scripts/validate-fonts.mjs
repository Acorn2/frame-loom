import {verifyAllFonts} from '../src/fonts/assets.ts';

for (const font of verifyAllFonts()) console.log(`FONT OK ${font.id}@${font.version} (${font.faces.length} files, ${font.license})`);
