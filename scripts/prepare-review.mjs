import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createReviewTemplate} from './lib/manual-review.mjs';
import {writeProjectJson} from './lib/project-files.mjs';
import {fingerprintFiles, fingerprintProjectInputs} from './lib/input-fingerprint.mjs';
import {projectRoot} from './lib/style-catalog.mjs';

export function prepareReview(projectDirectory, outputFile) {
  const root = path.resolve(projectDirectory);
  const run = JSON.parse(fs.readFileSync(path.join(root, 'run.json'), 'utf8'));
  const template = createReviewTemplate(run);
  if (!run.artifacts?.video || run.outputFingerprint !== fingerprintFiles([path.resolve(root, run.artifacts.video)], root)
    || run.inputFingerprint !== fingerprintProjectInputs(root, path.join(projectRoot, 'styles'), run.audioConfigPath, run.ttsConfigPath, {includeAudio: run.outputPurpose !== 'visual-master'})) throw new Error('候选视频或输入已变化，先重新生产与 QA。');
  writeProjectJson(root, path.resolve(outputFile), template, {overwrite: false});
  return path.resolve(outputFile);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [root, output, ...rest] = process.argv.slice(2);
  if (!root || !output || rest.length) throw new Error('Usage: npm run prepare:review -- <project-dir> <new-review.json>');
  console.log(`REVIEW TEMPLATE ${prepareReview(root, output)}; all checks remain false until actual review.`);
}
