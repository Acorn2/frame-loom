import fs from 'node:fs';
import path from 'node:path';
import {layoutCheckpoints} from '../../src/layout/checkpoints.ts';
import {LAYOUT_LOG_PREFIX} from '../../src/layout/diagnostics.ts';
import {layoutSignature} from '../../src/layout/scene-layout.ts';
import {getSceneTimeline} from '../../src/timeline/scene-timeline.ts';
import {hashValue} from './production-lock.mjs';
import {fingerprintFiles} from './input-fingerprint.mjs';

export function layoutCollector(board, {frames = layoutCheckpoints(board)} = {}) {
  const samples = new Map();
  return {
    frames,
    onBrowserLog(log) {
      if (!log.text.startsWith(LAYOUT_LOG_PREFIX)) return;
      const sample = JSON.parse(log.text.slice(LAYOUT_LOG_PREFIX.length));
      if (frames.includes(sample.frame)) samples.set(sample.frame, sample);
    },
    finish() {
      if (!board.layoutPolicy) return undefined;
      const missing = frames.filter(frame => !samples.has(frame));
      const checks = [...samples.values()].sort((a, b) => a.frame - b.frame);
      const timeline = getSceneTimeline(board);
      for (const sample of checks) {
        const expected = timeline.filter(item => sample.frame >= item.startFrame && sample.frame < item.endFrame).map(item => item.scene.id).sort();
        const observed = sample.checks.map(check => check.sceneId).sort();
        if (JSON.stringify(expected) !== JSON.stringify(observed)) throw new Error(`布局实测帧 ${sample.frame} 缺少当前场景或相邻交接证据。`);
      }
      const issues = checks.flatMap(sample => sample.checks.flatMap(check => check.issues));
      if (missing.length) throw new Error(`布局实测缺少 ${missing.length} 个必选帧：${missing.join(', ')}`);
      const errors = issues.filter(issue => issue.severity === 'error');
      if (errors.length) throw new Error(`布局实测失败：${errors.slice(0, 8).map(issue => `${issue.sceneId}@${issue.frame}: ${issue.message}`).join('; ')}`);
      const adjacentPairs = board.scenes.slice(1).map((scene, i) => ({from: board.scenes[i].id, to: scene.id, fromLayout: layoutSignature(board.scenes[i]), toLayout: layoutSignature(scene), overlapFrames: scene.transitionIn?.durationFrames ?? 0,
        sampledFrames: frames.filter(frame => frame >= timeline[i + 1].startFrame - 1 && frame <= Math.max(timeline[i].endFrame, timeline[i + 1].startFrame))}));
      return {policy: board.layoutPolicy, storyboardHash: hashValue(board), frames, checks, issues, adjacentPairs,
        verification: 'Chromium text ranges and object-fit image bounds at scene events and adjacent handoffs; source-image text and full playback require manual review'};
    }
  };
}

export function inspectLayoutReceipt(board, videoPath) {
  if (!board.layoutPolicy) return {passed: true, skipped: true, reason: '历史分镜未启用内容优先布局，保留原画面；视觉复核仍必要'};
  const receipt = JSON.parse(fs.readFileSync(`${videoPath}.render.json`, 'utf8'));
  if (receipt.videoFingerprint !== fingerprintFiles([videoPath], path.dirname(videoPath))) throw new Error('布局实测记录与视频字节不一致。');
  const report = receipt.profile?.layoutQa;
  const expected = layoutCheckpoints(board);
  if (!report || report.policy !== board.layoutPolicy || report.storyboardHash !== hashValue(board)) throw new Error('缺少当前分镜的布局实测记录，请重新渲染。');
  if (JSON.stringify(report.frames) !== JSON.stringify(expected) || expected.some(frame => !report.checks.some(sample => sample.frame === frame))) throw new Error('布局实测必选帧不完整。');
  if (report.issues.some(issue => issue.severity === 'error')) throw new Error('布局实测包含未解决的遮挡或裁切。');
  const collector = layoutCollector(board);
  for (const sample of report.checks) collector.onBrowserLog({text: `${LAYOUT_LOG_PREFIX}${JSON.stringify(sample)}`});
  collector.finish();
  return {passed: true, ...report};
}
