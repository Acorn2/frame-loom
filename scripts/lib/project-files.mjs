import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

// Explicit CLI outputs may live outside a production project. Within a project,
// retain its boundary so an output-directory link cannot become a trusted root.
// Outside it, the nearest existing directory is the selected root, including
// directory aliases such as macOS /tmp. Descendant artifact links stay forbidden.
export function outputBoundary(file, projectRoot) {
  const resolved = path.resolve(file);
  if (projectRoot) {
    const relative = path.relative(path.resolve(projectRoot), resolved);
    if (relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) return path.resolve(projectRoot);
  }
  let root = path.dirname(resolved);
  while (true) {
    try {if (fs.statSync(root).isDirectory()) return root;} catch (error) {if (error.code !== 'ENOENT') throw error;}
    const parent = path.dirname(root);
    if (parent === root) throw new Error('找不到输出目录边界。');
    root = parent;
  }
}

// Check every component, including dangling links. Project roots themselves may
// be opened through a user-selected alias; artifacts beneath them may not.
export function assertProjectOutput(root, file) {
  const relative = path.relative(path.resolve(root), path.resolve(file));
  if (!relative || path.isAbsolute(relative) || relative === '..' || relative.startsWith(`..${path.sep}`)) throw new Error(`产物路径必须在项目内：${file}`);
  let current = fs.realpathSync(root);
  const parts = relative.split(path.sep);
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    let stat;
    try {stat = fs.lstatSync(current);} catch (error) {if (error.code === 'ENOENT') continue; throw error;}
    if (stat.isSymbolicLink()) throw new Error(`产物路径不能包含符号链接：${file}`);
    if (index < parts.length - 1 ? !stat.isDirectory() : !stat.isFile()) throw new Error(`产物路径类型无效：${file}`);
  }
  return current;
}

export function writeProjectFile(root, file, content, {overwrite = true} = {}) {
  const target = assertProjectOutput(root, file);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  assertProjectOutput(root, file);
  const temporary = path.join(path.dirname(target), `.${path.basename(target)}-${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temporary, content, {flag: 'wx', mode: 0o600});
    assertProjectOutput(root, file);
    if (overwrite) fs.renameSync(temporary, target);
    else fs.linkSync(temporary, target); // exclusive publication, unlike exists + rename
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

export function writeProjectJson(root, file, value, options) {
  writeProjectFile(root, file, `${JSON.stringify(value, null, 2)}\n`, options);
}

export function acquireProjectLock(root, operation) {
  if (!['production', 'tts'].includes(operation)) throw new Error('未知项目锁。');
  const file = assertProjectOutput(root, path.join(root, `.frame-loom-${operation}.lock`));
  let descriptor;
  try {descriptor = fs.openSync(file, 'wx', 0o600);} catch (error) {
    if (error.code !== 'EEXIST') throw error;
    throw new Error(`项目 ${operation} 已加锁：${file}；等待现有任务结束。若进程已退出，先检查未完成事务及备份，再移走遗留锁文件。`);
  }
  const owned = fs.fstatSync(descriptor);
  try {fs.writeFileSync(descriptor, JSON.stringify({pid: process.pid, operation, startedAt: new Date().toISOString()}));}
  catch (error) {fs.closeSync(descriptor); fs.unlinkSync(file); throw error;}
  fs.closeSync(descriptor);
  return () => {
    const current = fs.lstatSync(file);
    if (current.dev !== owned.dev || current.ino !== owned.ino) throw new Error('项目锁已变化，未删除其他任务的锁。');
    fs.unlinkSync(file);
  };
}

export function assertNoPendingAudioPublication(root) {
  const marker = assertProjectOutput(root, path.join(root, '.audio-publication.json'));
  if (fs.existsSync(marker)) throw new Error(`音频包有未完成的发布事务；备份位置见 ${marker}，核对恢复后再继续。`);
}

// Publish a complete package under the TTS lock. Roll back ordinary failures;
// leave the journal/backups intact after a crash or a failed rollback.
export function publishAudioFiles(root, entries, {force = false} = {}) {
  assertNoPendingAudioPublication(root);
  for (const {source, target} of entries) {
    assertProjectOutput(root, source); assertProjectOutput(root, target);
    if (!force && fs.existsSync(target)) throw new Error(`输出文件已存在，未覆盖：${target}`);
  }
  const backup = fs.mkdtempSync(path.join(fs.realpathSync(root), '.audio-backup-'));
  const marker = path.join(root, '.audio-publication.json');
  const records = entries.map((entry, index) => ({...entry, backup: path.join(backup, String(index)), saved: false, published: false}));
  let cleanup = true;
  let journalOwned = false;
  try {
    writeProjectJson(root, marker, {backup, entries: records.map(({source, target, backup: previous}) => ({source, target, backup: previous}))}, {overwrite: false});
    journalOwned = true;
    for (const record of records) {
      assertProjectOutput(root, record.target);
      if (fs.existsSync(record.target)) {
        if (!force) throw new Error(`输出文件在合成期间出现，未覆盖：${record.target}`);
        fs.renameSync(record.target, record.backup); record.saved = true;
      }
      fs.linkSync(record.source, record.target); record.published = true;
    }
  } catch (error) {
    try {
      for (const record of [...records].reverse()) {
        assertProjectOutput(root, record.target);
        if (record.published) {
          const published = fs.statSync(record.source), current = fs.lstatSync(record.target);
          if (published.ino !== current.ino || published.dev !== current.dev) throw new Error('发布文件已被其他进程替换，保留备份。');
          fs.unlinkSync(record.target);
        }
        if (record.saved) fs.renameSync(record.backup, record.target);
      }
    } catch (rollbackError) {
      cleanup = false;
      throw new AggregateError([error, rollbackError], `音频发布回退失败；保留事务和备份：${backup}`);
    }
    throw error;
  } finally {
    if (cleanup) {
      for (const record of records) if (fs.existsSync(record.backup)) fs.unlinkSync(record.backup);
      fs.rmdirSync(backup);
      if (journalOwned) fs.unlinkSync(marker);
    }
  }
}
