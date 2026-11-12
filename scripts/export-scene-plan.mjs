import fs from 'node:fs';
import {acquireProjectLock} from './lib/project-files.mjs';
import {readScenePlan, writeScenePlanDocuments} from './lib/scene-plan.mjs';

try {
  const [directory, ...extra] = process.argv.slice(2);
  if (!directory || extra.length) throw new Error('Usage: npm run export:scene-plan -- <project-dir>');
  const root = fs.realpathSync(directory);
  const release = acquireProjectLock(root, 'production');
  try {
    const plan = readScenePlan(root);
    if (!plan.scenes.length) throw new Error('请先填写逐场计划。');
    writeScenePlanDocuments(root, plan);
    console.log(`已从 ${plan.scenes.length} 场计划导出 script.md 和 scene-review.md：${root}`);
  } finally {release();}
} catch (error) {console.error(error.message); process.exitCode = 1;}
