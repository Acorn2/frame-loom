import fs from 'node:fs';
import path from 'node:path';
import {fingerprintFiles} from './input-fingerprint.mjs';
import {writeRenderReceipt} from './render-receipt.mjs';

function processIsRunning(pid) {
  if (!Number.isInteger(pid) || pid < 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

function recoverAbandonedStages(outputPath) {
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
    if (marker.schemaVersion !== '1.0' || marker.outputPath !== outputPath || !Number.isInteger(marker.pid)) continue;
    if (processIsRunning(marker.pid)) throw new Error(`同一输出仍有渲染进程 ${marker.pid}，不能并发写入：${outputPath}`);

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

export async function renderToVerifiedOutput({outputPath, force = false, profile, render, verify}) {
  const resolvedOutput = path.resolve(outputPath);
  const receiptPath = `${resolvedOutput}.render.json`;
  recoverAbandonedStages(resolvedOutput);
  if (!force && (fs.existsSync(resolvedOutput) || fs.existsSync(receiptPath))) {
    throw new Error(`输出文件或渲染记录已存在，未覆盖：${resolvedOutput}\n确认目标后使用 --force 显式覆盖。`);
  }

  fs.mkdirSync(path.dirname(resolvedOutput), {recursive: true});
  const stagingDir = fs.mkdtempSync(path.join(path.dirname(resolvedOutput), `.${path.basename(resolvedOutput)}-render-`));
  const markerPath = path.join(stagingDir, 'owner.json');
  const stagedVideo = path.join(stagingDir, path.basename(resolvedOutput));
  const stagedReceipt = `${stagedVideo}.render.json`;
  const previousVideo = path.join(stagingDir, 'previous.mp4');
  const previousReceipt = path.join(stagingDir, 'previous.render.json');
  let promotedVideo = false;
  let promotedReceipt = false;
  let backedUpVideo = false;
  let backedUpReceipt = false;
  let cleanupSafe = true;

  try {
    fs.writeFileSync(markerPath, JSON.stringify({schemaVersion: '1.0', pid: process.pid, outputPath: resolvedOutput}));
    await render(stagedVideo);
    verify(stagedVideo);
    // The staged video has the final basename, so its receipt fingerprint stays
    // valid after both files are moved into the output directory.
    writeRenderReceipt(stagedVideo, profile);
    fs.writeFileSync(markerPath, JSON.stringify({schemaVersion: '1.0', pid: process.pid, outputPath: resolvedOutput, readyFingerprint: fingerprintFiles([stagedVideo], stagingDir)}));
    if (!force && (fs.existsSync(resolvedOutput) || fs.existsSync(receiptPath))) {
      throw new Error(`输出文件或渲染记录在渲染期间出现，未覆盖：${resolvedOutput}`);
    }
    if (fs.existsSync(resolvedOutput)) {
      fs.renameSync(resolvedOutput, previousVideo);
      backedUpVideo = true;
    }
    if (fs.existsSync(receiptPath)) {
      fs.renameSync(receiptPath, previousReceipt);
      backedUpReceipt = true;
    }
    fs.renameSync(stagedVideo, resolvedOutput);
    promotedVideo = true;
    fs.renameSync(stagedReceipt, receiptPath);
    promotedReceipt = true;
    return {videoPath: resolvedOutput, receiptPath};
  } catch (error) {
    try {
      if (promotedReceipt) fs.renameSync(receiptPath, stagedReceipt);
      if (promotedVideo) fs.renameSync(resolvedOutput, stagedVideo);
      if (backedUpVideo) fs.renameSync(previousVideo, resolvedOutput);
      if (backedUpReceipt) fs.renameSync(previousReceipt, receiptPath);
    } catch (rollbackError) {
      cleanupSafe = false;
      throw new AggregateError([error, rollbackError], `渲染发布失败，回退文件保留于 ${stagingDir}`);
    }
    throw error;
  } finally {
    if (cleanupSafe) fs.rmSync(stagingDir, {recursive: true, force: true});
  }
}
