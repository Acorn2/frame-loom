import fs from 'node:fs';
import {acquireProjectLock} from './lib/project-files.mjs';
import {changeFeedback} from './lib/review-feedback.mjs';
import {reviewCandidate} from './lib/review-candidate.mjs';

try {
  const [directory, id, scene, ...extra] = process.argv.slice(2);
  if (!directory || !id || extra.length) throw new Error('Usage: npm run review:revision -- <project> <feedback-id> [replacement-scene-id]');
  const project = fs.realpathSync(directory);
  const release = acquireProjectLock(project, 'production');
  try {
    const candidate = reviewCandidate(project, {requireCurrentInputs: true});
    changeFeedback(project, candidate, {type: 'revision', version: candidate.version, id, scene});
    console.log('新版镜头已登记。刷新审片播放器后可查看修改。');
  } finally {release();}
} catch (error) {console.error(error.message); process.exitCode = 1;}
