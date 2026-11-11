import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {Buffer} from 'node:buffer';

export const PROJECT_STORAGE_WARNING_BYTES = 256 * 1024 * 1024;

export function fileSha256(file) {
  const descriptor = fs.openSync(file, 'r');
  const buffer = Buffer.alloc(1024 * 1024);
  const hash = createHash('sha256');
  try {
    let length;
    while ((length = fs.readSync(descriptor, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, length));
  } finally {fs.closeSync(descriptor);}
  return hash.digest('hex');
}

// Never follow a project symlink while measuring or choosing archive inputs.
export function listProjectFiles(root, relative = '') {
  return fs.readdirSync(path.join(root, relative), {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    const name = path.join(relative, entry.name);
    const stat = fs.lstatSync(path.join(root, name));
    if (stat.isDirectory()) return listProjectFiles(root, name);
    return [{path: name, bytes: stat.size, type: stat.isFile() ? 'file' : stat.isSymbolicLink() ? 'symlink' : 'other'}];
  });
}

export function inspectProjectStorage(projectDirectory, {duplicates = false} = {}) {
  const root = fs.realpathSync(projectDirectory);
  const files = listProjectFiles(root);
  const byDirectory = Object.create(null), byExtension = Object.create(null);
  for (const file of files) {
    const directory = file.path.includes(path.sep) ? file.path.split(path.sep)[0] : '(root)';
    byDirectory[directory] = (byDirectory[directory] ?? 0) + file.bytes;
    const extension = path.extname(file.path) || '(none)';
    byExtension[extension] = (byExtension[extension] ?? 0) + file.bytes;
  }
  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  const result = {schemaVersion: '1.0', projectPath: root, totalBytes, fileCount: files.length, byDirectory, byExtension,
    warningBytes: PROJECT_STORAGE_WARNING_BYTES,
    warnings: totalBytes >= PROJECT_STORAGE_WARNING_BYTES ? [`项目文件已达 ${(totalBytes / 1024 / 1024).toFixed(1)} MiB，超过 256 MiB 提示线；运行 inspect:storage 审阅历史产物和缓存，禁止自动删除输入或审核证据。`] : [],
    cleanupPreview: {applied: false, cacheFiles: files.filter(file => file.type === 'file' && file.path.startsWith(`.cache${path.sep}`)).map(({path, bytes}) => ({path, bytes})),
      note: '仅列出候选，不删除文件。缓存清理会增加后续渲染或合成成本；重复文件也可能被不同版本引用。'}};
  if (duplicates) {
    const sizes = new Map();
    for (const file of files.filter(file => file.type === 'file' && file.bytes > 0)) {
      if (!sizes.has(file.bytes)) sizes.set(file.bytes, []);
      sizes.get(file.bytes).push(file);
    }
    const hashes = new Map();
    for (const sameSize of sizes.values()) {
      if (sameSize.length < 2) continue;
      for (const file of sameSize) {
        const hash = fileSha256(path.join(root, file.path));
        if (!hashes.has(hash)) hashes.set(hash, []);
        hashes.get(hash).push(file);
      }
    }
    result.duplicates = [...hashes.entries()].filter(([, group]) => group.length > 1).map(([sha256, group]) => ({sha256, bytes: group[0].bytes, redundantBytes: group[0].bytes * (group.length - 1), paths: group.map(file => file.path)})).sort((a, b) => b.redundantBytes - a.redundantBytes);
    result.redundantBytes = result.duplicates.reduce((sum, group) => sum + group.redundantBytes, 0);
  }
  return result;
}
