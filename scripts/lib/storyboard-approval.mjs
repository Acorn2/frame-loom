import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {collectManifestAssetFiles, fingerprintFiles} from './input-fingerprint.mjs';

function collectFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(filePath) : entry.isFile() ? [filePath] : [];
  });
}

export function storyboardApprovalFingerprint(projectPath) {
  const files = ['storyboard.json', 'script.md', 'asset-manifest.json'].map((name) => path.join(projectPath, name));
  files.push(...collectFiles(path.join(projectPath, 'assets')));
  files.push(...collectManifestAssetFiles(projectPath));
  const handoffPath = path.join(projectPath, 'visual-handoff.json');
  if (fs.existsSync(handoffPath)) files.push(handoffPath);
  try {
    const storyboard = JSON.parse(fs.readFileSync(path.join(projectPath, 'storyboard.json'), 'utf8'));
    const styleId = storyboard.style?.id;
    if (typeof styleId === 'string' && /^[a-z0-9-]+$/u.test(styleId)) {
      const styleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'styles');
      files.push(path.join(styleRoot, styleId, 'style.json'), path.join(styleRoot, styleId, 'motion.json'));
    }
  } catch {
    // The storyboard validator reports malformed JSON separately.
  }
  return fingerprintFiles(files, projectPath);
}

export function assertStoryboardApproval(projectPath) {
  const approvalPath = path.join(projectPath, 'storyboard-approval.json');
  if (!fs.existsSync(approvalPath)) throw new Error('review 模式缺少 storyboard-approval.json；请先让创作者审核讲稿、分镜和预留区域。');
  const approval = JSON.parse(fs.readFileSync(approvalPath, 'utf8'));
  if (typeof approval?.reviewer !== 'string' || !approval.reviewer.trim() || typeof approval?.notes !== 'string' || !approval.notes.trim()) throw new Error('分镜审核记录必须包含 reviewer 和 notes。');
  if (approval.fingerprint !== storyboardApprovalFingerprint(projectPath)) {
    throw new Error('讲稿、分镜或画面预留区域在审核后已变化；请展示改动并重新审核。');
  }
  return approval;
}
