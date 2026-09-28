import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {StoryboardSchema} from '../src/schemas/storyboard.ts';
import {storyboardApprovalFingerprint} from './lib/storyboard-approval.mjs';

export function approveStoryboard(projectDirectory, reviewFilePath) {
  const projectPath = path.resolve(projectDirectory);
  const storyboard = StoryboardSchema.parse(JSON.parse(fs.readFileSync(path.join(projectPath, 'storyboard.json'), 'utf8')));
  if (!['reviewed', 'approved'].includes(storyboard.project.status)) throw new Error('review 模式的 storyboard.status 必须是 reviewed 或 approved。');
  const review = JSON.parse(fs.readFileSync(path.resolve(reviewFilePath), 'utf8'));
  if (typeof review?.reviewer !== 'string' || !review.reviewer.trim() || typeof review?.notes !== 'string' || !review.notes.trim()) throw new Error('审核记录需要 reviewer 和 notes。');
  const approval = {
    schemaVersion: '1.0',
    approvedAt: new Date().toISOString(),
    reviewer: review.reviewer.trim(),
    notes: review.notes.trim(),
    fingerprint: storyboardApprovalFingerprint(projectPath)
  };
  const approvalPath = path.join(projectPath, 'storyboard-approval.json');
  fs.writeFileSync(approvalPath, `${JSON.stringify(approval, null, 2)}\n`);
  return approvalPath;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const [projectPath, reviewPath] = process.argv.slice(2);
  if (!projectPath || !reviewPath) {
    console.error('Usage: npm run approve:storyboard -- <project-dir> <review.json>');
    process.exit(1);
  }
  try { console.log(`STORYBOARD APPROVED ${approveStoryboard(projectPath, reviewPath)}`); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); }
}
