import {basisFile, clipFile, readFeedback, versionOf} from './lib/review-ledger.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {acquireProjectLock, assertNoPendingAudioPublication, assertProjectOutput} from './lib/project-files.mjs';
import {fileSha256, listProjectFiles} from './lib/project-storage.mjs';

// An archive is historical evidence, not a second runnable project. Keep the
// original bytes and paths; record omitted, video-derived images explicitly.
export function archiveRevision(projectDirectory, revisionId, {include = []} = {}) {
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(revisionId)) throw new Error('revision-id 必须是 1–80 位小写字母、数字或连字符。');
  const root = fs.realpathSync(projectDirectory);
  const destination = path.join(root, 'revisions', revisionId);
  const pending = path.join(root, 'revisions', `.${revisionId}.pending`);
  assertProjectOutput(root, path.join(destination, 'archive-manifest.json'));
  assertProjectOutput(root, path.join(pending, 'archive-state.json'));
  if (fs.existsSync(destination)) throw new Error(`归档已存在，未覆盖：${destination}`);
  if (fs.existsSync(pending)) throw new Error(`存在未完成归档，请先核对该目录中的文件：${pending}`);
  const release = acquireProjectLock(root, 'production');
  let staging;
  try {
    const ttsLock = assertProjectOutput(root, path.join(root, '.frame-loom-tts.lock'));
    if (fs.existsSync(ttsLock)) throw new Error('TTS 任务已加锁，不能归档变化中的音频。');
    assertNoPendingAudioPublication(root);
    assertProjectOutput(root, path.join(root, 'output', '.archive-boundary'));
    if (fs.existsSync(path.join(root, 'output')) && fs.readdirSync(path.join(root, 'output')).some(name => /^\..+-render-/.test(name))) throw new Error('存在未完成的渲染事务，请先按 Security 恢复，再归档。');
    const selected = new Set();
    const omitted = new Map();
    const sourcePath = relative => {
      const file = path.resolve(root, relative);
      assertProjectOutput(root, path.join(path.dirname(file), '.archive-boundary'));
      let stat;
      try {stat = fs.lstatSync(file);} catch (error) {if (error.code !== 'ENOENT') throw error;}
      if (stat && !stat.isFile() && !stat.isDirectory()) throw new Error(`归档来源必须是普通文件或目录，不能包含符号链接：${relative}`);
      return file;
    };
    const add = (relative, {optional = false} = {}) => {
      const file = assertProjectOutput(root, path.resolve(root, relative));
      const name = path.relative(root, file);
      if (['revisions', '.cache', '.tmp'].includes(name.split(path.sep)[0])) throw new Error('归档不能递归包含历史归档、缓存或临时目录。');
      if (!fs.existsSync(file)) {
        if (optional) return;
        throw new Error(`归档输入不存在：${name}`);
      }
      selected.add(name);
    };
    const addTree = relative => {
      const directory = sourcePath(relative);
      for (const file of listProjectFiles(directory)) add(path.join(relative, file.path));
    };
    const addPath = relative => {
      const file = sourcePath(relative);
      if (fs.statSync(file).isDirectory()) addTree(relative);
      else add(relative);
    };
    const addVideo = relative => {
      add(relative);
      for (const suffix of ['.render.json', '.cover.png', '.cover.png.render.json']) add(`${relative}${suffix}`, {optional: true});
      const production = `${relative}.production`;
      if (fs.existsSync(path.resolve(root, production))) addTree(production);
    };
    const runPath = assertProjectOutput(root, path.join(root, 'run.json'));
    const run = fs.existsSync(runPath) ? JSON.parse(fs.readFileSync(runPath, 'utf8')) : {};
    for (const name of fs.readdirSync(root)) {
      if (['archive-manifest.json', 'archive-state.json'].includes(name)) throw new Error(`项目根目录含归档保留名称，请先核对，未覆盖：${name}`);
      if (/\.(json|md|srt|vtt|txt)$/.test(name)) add(name);
    }
    for (const directory of ['source', 'assets', 'audio']) if (fs.existsSync(path.join(root, directory))) addTree(directory);
    if (run.artifacts?.video) addVideo(run.artifacts.video);
    for (const relative of Object.values(run.artifacts ?? {})) {
      if (typeof relative !== 'string' || relative === run.artifacts.video) continue;
      addPath(relative);
    }
    if (run.sourceVisualMaster?.video) addVideo(run.sourceVisualMaster.video);
    if (run.sourceVisualMaster?.handoff) addPath(path.dirname(run.sourceVisualMaster.handoff));
    for (const issue of readFeedback(root)) {
      if (!issue.basisHash || (issue.version !== versionOf(run) && issue.producedVersion !== versionOf(run))) continue;
      add(path.relative(root, basisFile(root, issue.version)));
      const clip = issue.previews?.at(-1);
      if (clip) add(path.relative(root, clipFile(root, clip.id)));
    }
    // Preserve review records and timing notes kept next to the current video.
    if (fs.existsSync(path.join(root, 'output'))) {
      for (const name of fs.readdirSync(path.join(root, 'output'))) {
        if (/\.(json|md|srt|vtt|txt)$/.test(name) && !/\.mp4(?:\.cover\.png)?\.render\.json$/.test(name)) add(path.join('output', name));
      }
    }
    const explicitIncludes = include.map(relative => path.relative(root, sourcePath(relative)));
    for (const relative of include) addPath(relative);
    for (const relative of [...selected].filter(name => path.basename(name) === 'review-frames.json')) {
      const manifest = JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
      const directory = path.dirname(relative);
      // If the video's bytes are not in this archive, retain its frames.
      const video = typeof manifest.video === 'string' ? path.resolve(root, manifest.video) : undefined;
      if (!video || !fs.existsSync(video) || !selected.has(path.relative(root, fs.realpathSync(video)))) continue;
      for (const frame of manifest.frames ?? []) {
        if (typeof frame.file !== 'string' || !/^[a-z0-9._-]+\.(png|jpe?g)$/i.test(frame.file)) throw new Error(`审片索引的图片路径无效：${relative}`);
        const name = path.join(directory, frame.file);
        if (explicitIncludes.some(included => name === included || name.startsWith(`${included}${path.sep}`))) continue;
        // Contact sheets are retained even if a malformed manifest also calls
        // one a frame. The archived index describes original review coverage.
        if ((manifest.contactSheets ?? [manifest.contactSheet]).includes(frame.file)) continue;
        if (selected.delete(name)) omitted.set(name, {path: name, bytes: fs.statSync(path.join(root, name)).size, sha256: fileSha256(path.join(root, name)), reason: 'video-derived-review-frame', reviewManifest: relative});
      }
    }
    const files = [...selected].sort().map(relative => ({path: relative, bytes: fs.statSync(path.join(root, relative)).size, sha256: fileSha256(path.join(root, relative))}));
    fs.mkdirSync(path.dirname(pending), {recursive: true});
    assertProjectOutput(root, path.join(pending, 'archive-state.json'));
    fs.mkdirSync(pending);
    staging = pending;
    fs.writeFileSync(path.join(staging, 'archive-state.json'), JSON.stringify({pid: process.pid, sourceProject: root, revisionId}), {flag: 'wx'});
    for (const file of files) {
      const source = assertProjectOutput(root, path.join(root, file.path));
      const target = path.join(staging, file.path);
      fs.mkdirSync(path.dirname(target), {recursive: true});
      fs.copyFileSync(source, target);
      if (fileSha256(target) !== file.sha256) throw new Error(`归档期间输入变化：${file.path}`);
    }
    for (const file of [...files, ...omitted.values()]) {
      const source = assertProjectOutput(root, path.join(root, file.path));
      if (fileSha256(source) !== file.sha256) throw new Error(`归档期间输入变化：${file.path}`);
    }
    const manifest = {schemaVersion: '1.0', kind: 'compact-revision-archive', sourceProject: root, createdAt: new Date().toISOString(),
      resumable: false, files, omittedDerived: [...omitted.values()],
      totalBytes: files.reduce((sum, file) => sum + file.bytes, 0), omittedBytes: [...omitted.values()].reduce((sum, file) => sum + file.bytes, 0),
      note: '原路径和审核记录仅作历史证据；省略的逐帧图片可按审片索引从对应归档视频重新提取。恢复生产前须恢复相关输入并重新校验和审核，不移植旧批准。外部依赖仍需保留。'};
    fs.writeFileSync(path.join(staging, 'archive-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, {flag: 'wx'});
    fs.unlinkSync(path.join(staging, 'archive-state.json'));
    assertProjectOutput(root, path.join(destination, 'archive-manifest.json'));
    fs.mkdirSync(path.dirname(destination), {recursive: true});
    if (fs.existsSync(destination)) throw new Error('归档目标在运行期间出现，未覆盖。');
    fs.renameSync(staging, destination);
    staging = undefined;
    return {directory: destination, manifest};
  } finally {
    if (staging) fs.rmSync(staging, {recursive: true, force: true});
    release();
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const [project, id, ...flags] = process.argv.slice(2);
    const include = [];
    for (let index = 0; index < flags.length; index += 2) {
      if (flags[index] !== '--include' || !flags[index + 1]) throw new Error('仅支持 --include <项目内路径>。');
      include.push(flags[index + 1]);
    }
    if (!project || !id) throw new Error('Usage: npm run archive:revision -- <project-dir> <revision-id> [--include <project-relative-path>]');
    const result = archiveRevision(project, id, {include});
    console.log(`REVISION ARCHIVED ${result.directory}`);
    console.log(`RETAINED ${(result.manifest.totalBytes / 1024 / 1024).toFixed(2)} MiB; OMITTED DERIVED ${(result.manifest.omittedBytes / 1024 / 1024).toFixed(2)} MiB; originals unchanged`);
  } catch (error) {console.error(error.message); process.exitCode = 1;}
}
