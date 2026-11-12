import fs from 'node:fs';
import path from 'node:path';
import {assertProjectOutput} from './project-files.mjs';

export const ledgerName = 'review-feedback.json';
export function readFeedback(project) {
  const file = assertProjectOutput(project, path.join(project, ledgerName));
  if (!fs.existsSync(file)) return [];
  const ledger = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (ledger.schemaVersion !== '1.0' || !Array.isArray(ledger.issues)) throw new Error('审片反馈记录无效。');
  return ledger.issues;
}

export const versionOf = run => run.inputFingerprint + '.' + run.outputFingerprint;
export function clipFile(project, id) {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/u.test(id)) throw new Error('预览编号无效。');
  return assertProjectOutput(project, path.join(project, 'output', 'feedback-clips', id + '.mp4'));
}

export function basisFile(project, version) {
  if (!/^[a-f0-9]{64}\.[a-f0-9]{64}$/u.test(version)) throw new Error('反馈版本无效。');
  return assertProjectOutput(project, path.join(project, 'output', 'feedback-clips', version + '.json'));
}
