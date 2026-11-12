import fs from 'node:fs';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {assertProjectOutput, writeProjectJson} from './lib/project-files.mjs';

const recordName = 'workflow-checkpoint.json';

function localDocument(project, relativePath) {
  if (typeof relativePath !== 'string' || path.isAbsolute(relativePath) ||
      !/\.(md|txt|json)$/iu.test(relativePath)) throw new Error('待办文件需要使用项目内文档的相对路径。');
  const file = assertProjectOutput(project, path.resolve(project, relativePath));
  if (file === path.join(project, recordName) || file === path.join(project, 'run.json')) {
    throw new Error('工作流记录不能作为待办文档。');
  }
  return file;
}

function checkRecord(project, checkpoint) {
  if (checkpoint?.schemaVersion !== '1.0' || typeof checkpoint.id !== 'string' || !checkpoint.id ||
      !['prepare', 'review'].includes(checkpoint.stage) || typeof checkpoint.goal !== 'string' || !checkpoint.goal.trim() ||
      (checkpoint.stage === 'review' && !/^[a-f0-9]{64}$/u.test(checkpoint.sha256))) {
    throw new Error('工作流交接记录无效，请核对 workflow-checkpoint.json。');
  }
  return localDocument(project, checkpoint.document);
}

export function readCheckpoint(project) {
  const file = assertProjectOutput(project, path.join(project, recordName));
  if (!fs.existsSync(file)) return null;
  const checkpoint = JSON.parse(fs.readFileSync(file, 'utf8'));
  checkRecord(project, checkpoint);
  return checkpoint;
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function recordCheckpoint(directory, stage, relativePath, goal) {
  const project = fs.realpathSync(directory);
  const file = localDocument(project, relativePath);
  const checkpoint = {schemaVersion: '1.0', id: randomUUID(), stage, document: path.relative(project, file), goal};
  if (stage === 'review') {
    const bytes = fs.readFileSync(file);
    if (!bytes.toString('utf8').trim()) throw new Error('待审文件为空。');
    checkpoint.sha256 = digest(bytes);
  }
  checkRecord(project, checkpoint);
  writeProjectJson(project, path.join(project, recordName), checkpoint);
  return checkpoint;
}

export function checkpointStatus(project, checkpoint) {
  const file = checkRecord(project, checkpoint);
  const exists = fs.existsSync(file);
  const base = {goal: checkpoint.goal, file: exists ? file : undefined};
  if (checkpoint.stage === 'prepare') return {...base, stage: '文档编排中', owner: 'Agent', next: `完成 ${checkpoint.document}，核对后登记待审版本。`};
  if (!exists || digest(fs.readFileSync(file)) !== checkpoint.sha256) {
    return {...base, file: undefined, stage: '待审版本已失效', owner: 'Agent', next: `核对 ${checkpoint.document}，重新登记可审版本。`};
  }
  return {...base, stage: '等待创作者审阅', owner: '创作者', next: '审阅此版本，确认或提出修改。'};
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const [dir, stage, document, goal, ...extra] = process.argv.slice(2);
    if (!goal || extra.length) throw new Error('Usage: npm run workflow:checkpoint -- <project-dir> prepare|review <relative-document> "<goal>"');
    const checkpoint = recordCheckpoint(dir, stage, document, goal);
    console.log(`CHECKPOINT ${checkpoint.stage} ${checkpoint.document}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
