import {prepareIllustrations} from './lib/illustrations.mjs';
if (process.argv.length !== 3) throw new Error('Usage: npm run prepare:illustrations -- <project-directory>');
console.log(`ILLUSTRATION PROMPTS ${prepareIllustrations(process.argv[2])}`);
console.log('Agent: invoke native imagegen for each subject, inspect each result, then register:illustration. This command prepares prompts; it does not generate images.');
