import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {inspectTtsProfiles} from './lib/tts-profiles.mjs';

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const projectPath = process.argv[2];
  if (!projectPath) { console.error('Usage: npm run list:tts-profiles -- <project-dir>'); process.exit(1); }
  console.log(JSON.stringify(inspectTtsProfiles(path.resolve(projectPath)), null, 2));
}
