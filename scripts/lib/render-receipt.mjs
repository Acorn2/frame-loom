import fs from 'node:fs';
import path from 'node:path';
import {fingerprintFiles} from './input-fingerprint.mjs';

// Record the profile before QA; approval must never change the reviewed bytes.
export function writeRenderReceipt(videoPath, profile) {
  const receipt = {
    schemaVersion: '1.0',
    profile,
    videoFingerprint: fingerprintFiles([videoPath], path.dirname(videoPath))
  };
  fs.writeFileSync(`${videoPath}.render.json`, `${JSON.stringify(receipt, null, 2)}\n`);
  return receipt;
}

export function inspectCleanNarratedRender(videoPath) {
  const receiptPath = `${videoPath}.render.json`;
  if (!fs.existsSync(receiptPath)) throw new Error('缺少渲染记录；请重新渲染干净有声候选文件后再 QA。');
  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  if (receipt.schemaVersion !== '1.0' || receipt.profile?.purpose !== 'in-project-video' || receipt.profile?.showReviewMarker !== false) {
    throw new Error('有声交付需要不带审片标记的渲染配置。');
  }
  if (receipt.videoFingerprint !== fingerprintFiles([videoPath], path.dirname(videoPath))) throw new Error('渲染记录与视频字节不一致。');
  return {passed: true, showReviewMarker: false, verification: 'render profile and video fingerprint; full playback remains required'};
}
