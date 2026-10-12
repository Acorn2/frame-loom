import {registerIllustration} from './lib/illustrations.mjs';
const args = process.argv.slice(2);
if (args.length !== 5 || args[3] !== '--reviewer') throw new Error('Usage: npm run register:illustration -- <project-directory> <asset-id> <generated-png> --reviewer <reviewer>');
console.log(`REGISTERED ILLUSTRATION ${registerIllustration(args[0], args[1], args[2], args[4])}`);
