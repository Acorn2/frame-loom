import fs from 'node:fs';
import path from 'node:path';
import {fingerprintFiles} from './input-fingerprint.mjs';
import {writeRenderReceipt} from './render-receipt.mjs';
import {assertProjectOutput, outputBoundary, writeProjectJson} from './project-files.mjs';

function processIsRunning(pid) {
  if (!Number.isInteger(pid) || pid < 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

function recoverAbandonedStages(outputPath, root) {
  const directory = path.dirname(outputPath);
  if (!fs.existsSync(directory)) return;
  const prefix = `.${path.basename(outputPath)}-render-`;
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    if (!entry.isDirectory() || !entry.name.startsWith(prefix)) continue;
    const stage = path.join(directory, entry.name);
    const markerPath = path.join(stage, 'owner.json');
    if (!fs.existsSync(markerPath)) continue;
    let marker;
    try {
      marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    } catch {
      continue;
    }
    if (!['1.0', '2.0'].includes(marker.schemaVersion) || marker.outputPath !== outputPath || !Number.isInteger(marker.pid)) continue;
    if (processIsRunning(marker.pid)) throw new Error(`同一输出仍有渲染进程 ${marker.pid}，不能并发写入：${outputPath}`);

    if (marker.schemaVersion === '2.0') {
      if (marker.phase !== 'preparing') throw new Error(`渲染包有未完成的发布事务；核对 ${markerPath} 中的目标与备份后恢复，不能用 --force 绕过。`);
      fs.rmSync(stage, {recursive: true, force: true});
      continue;
    }
    for (const file of [outputPath, `${outputPath}.render.json`, path.join(stage, 'previous.mp4'), path.join(stage, 'previous.render.json')]) assertProjectOutput(root, file);
    const receiptPath = `${outputPath}.render.json`;
    const previousVideo = path.join(stage, 'previous.mp4');
    const previousReceipt = path.join(stage, 'previous.render.json');
    const finalMatchesStaged = fs.existsSync(outputPath) && marker.readyFingerprint
      && fingerprintFiles([outputPath], directory) === marker.readyFingerprint;
    if (fs.existsSync(previousVideo)) {
      if (fs.existsSync(outputPath) && !finalMatchesStaged) {
        throw new Error(`中断渲染的旧视频保留于 ${stage}；现有输出已变化，请人工核对后恢复。`);
      }
      if (finalMatchesStaged) fs.renameSync(outputPath, path.join(stage, 'interrupted-new.mp4'));
      if (fs.existsSync(previousReceipt) && fs.existsSync(receiptPath)) {
        const currentReceipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
        if (currentReceipt.videoFingerprint !== marker.readyFingerprint) {
          throw new Error(`中断渲染的旧记录保留于 ${stage}；现有渲染记录已变化，请人工核对后恢复。`);
        }
        fs.renameSync(receiptPath, path.join(stage, 'interrupted-new.render.json'));
      }
      fs.renameSync(previousVideo, outputPath);
      if (fs.existsSync(previousReceipt)) fs.renameSync(previousReceipt, receiptPath);
    } else if (finalMatchesStaged) {
      let receiptMatches = false;
      if (fs.existsSync(receiptPath)) {
        try {
          receiptMatches = JSON.parse(fs.readFileSync(receiptPath, 'utf8')).videoFingerprint === marker.readyFingerprint;
        } catch {
          // A malformed receipt is not evidence of a completed render.
        }
      }
      if (!receiptMatches) fs.renameSync(outputPath, path.join(stage, 'interrupted-new.mp4'));
    }
    fs.rmSync(stage, {recursive: true, force: true});
  }
}

export async function renderToVerifiedOutput({outputPath, outputRoot, force = false, profile, render, verify,
  artifactSuffixes = [], prepareArtifacts, createReceipt = writeRenderReceipt}) {
  const resolvedOutput = path.resolve(outputPath);
  const root = outputRoot ?? outputBoundary(resolvedOutput);
  const suffixes = ['', '.render.json', ...artifactSuffixes];
  if (new Set(suffixes).size !== suffixes.length || artifactSuffixes.some(suffix => !suffix.startsWith('.') || suffix.includes('..') || suffix.includes('\\'))) throw new Error('渲染附属产物后缀无效。');
  const targets = suffixes.map(suffix => `${resolvedOutput}${suffix}`);
  for (const file of targets) assertProjectOutput(root, file);
  recoverAbandonedStages(resolvedOutput, root);
  if (!force && targets.some(file => fs.existsSync(file))) throw new Error(`输出文件或渲染记录已存在，未覆盖：${resolvedOutput}`);
  const originalFingerprint = fingerprintFiles(targets, root);
  fs.mkdirSync(path.dirname(resolvedOutput), {recursive: true});
  const stagingDir = fs.mkdtempSync(path.join(path.dirname(resolvedOutput), `.${path.basename(resolvedOutput)}-render-`));
  const markerPath = path.join(stagingDir, 'owner.json');
  const stagedVideo = path.join(stagingDir, path.basename(resolvedOutput));
  const records = suffixes.map((suffix, index) => ({source: `${stagedVideo}${suffix}`, target: targets[index], backup: path.join(stagingDir, `previous-${index}`), saved: false, published: false}));
  let cleanupSafe = true;
  const journal = phase => writeProjectJson(root, markerPath, {schemaVersion: '2.0', pid: process.pid, outputPath: resolvedOutput, phase,
    entries: records.map(({source, target, backup}) => ({source, target, backup}))});
  try {
    journal('preparing');
    await render(stagedVideo);
    await verify(stagedVideo);
    await createReceipt(stagedVideo, profile);
    // Sidecars and cover extraction must succeed before replacing any old file.
    await prepareArtifacts?.(stagedVideo);
    for (const record of records) {
      assertProjectOutput(root, record.source); assertProjectOutput(root, record.target);
      if (!fs.existsSync(record.source) || fs.statSync(record.source).size === 0) throw new Error(`缺少暂存产物：${record.source}`);
    }
    if (originalFingerprint !== fingerprintFiles(targets, root)) throw new Error('输出文件在渲染期间变化，未覆盖。');
    journal('publishing');
    for (const record of records) {
      assertProjectOutput(root, record.target);
      fs.mkdirSync(path.dirname(record.target), {recursive: true});
      if (fs.existsSync(record.target)) {
        if (!force) throw new Error('输出文件在发布期间出现，未覆盖。');
        fs.renameSync(record.target, record.backup); record.saved = true;
      }
      fs.linkSync(record.source, record.target); record.published = true;
    }
    return {videoPath: resolvedOutput, receiptPath: `${resolvedOutput}.render.json`};
  } catch (error) {
    try {
      for (const record of [...records].reverse()) {
        if (!record.published && !record.saved) continue;
        assertProjectOutput(root, record.target);
        if (record.published) {
          const current = fs.lstatSync(record.target), staged = fs.statSync(record.source);
          if (current.dev !== staged.dev || current.ino !== staged.ino) throw new Error('产物已被其他进程替换，保留备份。');
          fs.unlinkSync(record.target);
        }
        if (record.saved) {fs.linkSync(record.backup, record.target); fs.unlinkSync(record.backup);}
      }
    } catch (rollbackError) {
      cleanupSafe = false;
      throw new AggregateError([error, rollbackError], `渲染发布失败，事务与回退文件保留于 ${stagingDir}`);
    }
    throw error;
  } finally {
    if (cleanupSafe) fs.rmSync(stagingDir, {recursive: true, force: true});
  }
}
