import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {getSceneTimeline} from '../src/timeline/scene-timeline.ts';

function run(command, args) {
  const result = spawnSync(command, args, {encoding: 'utf8'});
  if (result.error?.code === 'ENOENT') {
    throw new Error(`找不到 ${command}。请安装 FFmpeg，并确保 ${command} 在 PATH 中。`);
  }
  if (result.status !== 0) {
    throw new Error(`${command} 执行失败：${result.stderr.trim() || '未知错误'}`);
  }
}

function uniqueCandidates(candidates, durationSec) {
  const clamped = candidates
    .map((item) => ({...item, timeSec: Math.max(0, Math.min(durationSec - 0.04, item.timeSec))}))
    .sort((a, b) => a.timeSec - b.timeSec);
  const result = [];
  for (const candidate of clamped) {
    const same = result.find((item) => Math.abs(item.timeSec - candidate.timeSec) < 0.2 && !item.required && !candidate.required);
    if (!same) result.push(candidate);
  }
  return result;
}

export function selectReviewFrames(storyboard) {
  const fps = storyboard.project.fps;
  const durationSec = storyboard.project.durationFrames / fps;
  const candidates = [
    {label: 'opening', timeSec: 0},
    {label: 'opening-title-stable', timeSec: Math.min(1.2, durationSec * 0.08)}
  ];
  const timeline = getSceneTimeline(storyboard);
  for (const {scene, startFrame, endFrame, overlapOutFrames} of timeline) {
    const startSec = startFrame / fps;
    const sceneDurationSec = scene.durationFrames / fps;
    candidates.push({label: `${scene.id}-content`, timeSec: startSec + sceneDurationSec * 0.55});
    const firstAction = scene.beats.find((beat) => beat.action !== 'set-state');
    if (firstAction) {
      candidates.push({label: `${scene.id}-first-action-mid`, timeSec: (startFrame + firstAction.start + firstAction.duration / 2) / fps});
      candidates.push({label: `${scene.id}-first-action`, timeSec: (startFrame + firstAction.start + firstAction.duration) / fps});
    }
    if (storyboard.schemaVersion === '2.3') {
      const lastActionEnd = Math.max(0, ...scene.beats.map((beat) => beat.start + beat.duration), scene.visual?.mediaFocus ? scene.visual.mediaFocus.start + scene.visual.mediaFocus.duration : 0);
      candidates.push({label: `${scene.id}-complete`, required: true, timeSec: (startFrame + Math.min(scene.durationFrames - 1, lastActionEnd + 2)) / fps});
      const fadeFrames = scene.outro?.fadeFrames ?? (overlapOutFrames === 0 && scene.transitionOut ? 12 : 0);
      candidates.push({label: `${scene.id}-before-handoff`, required: true, timeSec: (endFrame - overlapOutFrames - fadeFrames - 2) / fps});
    }
    for (const stateSwitch of scene.beats.filter((beat) => beat.action === 'set-state' && beat.state === 'current')) {
      candidates.push({label: `${scene.id}-${stateSwitch.target}-current`, timeSec: (startFrame + stateSwitch.start + 1) / fps});
    }
    const objectAction = scene.beats.find((beat) => beat.action === 'rotate');
    if (objectAction) candidates.push({label: `${scene.id}-object-complete`, timeSec: (startFrame + objectAction.start + objectAction.duration + 1) / fps});
    if (overlapOutFrames > 0) {
      candidates.push({label: `${scene.id}-handoff`, timeSec: (endFrame - overlapOutFrames / 2) / fps});
    } else if (scene.transitionOut) {
      candidates.push({label: `${scene.id}-transition`, timeSec: startSec + Math.max(0, sceneDurationSec - 0.35)});
    }
    if (scene.outro) candidates.push({label: `${scene.id}-stable-outro`, timeSec: (endFrame - scene.outro.fadeFrames - 2) / fps});
  }

  if (durationSec >= 20 && uniqueCandidates(candidates, durationSec).length < 6) {
    for (let index = 1; index <= 6; index += 1) {
      candidates.push({label: `coverage-${index}`, timeSec: durationSec * (index / 7)});
    }
  }
  candidates.push({label: 'ending', timeSec: Math.max(0, durationSec - 0.5)});
  const unique = uniqueCandidates(candidates, durationSec);
  const limit = storyboard.schemaVersion === '2.3' ? 48 : 24;
  if (unique.length <= limit) return unique;
  const sampled = unique.filter((item) => item.required);
  const optional = unique.filter((item) => !item.required);
  const count = Math.min(optional.length, Math.max(2, limit - sampled.length));
  for (let index = 0; index < count; index += 1) sampled.push(optional[Math.round(index * (optional.length - 1) / Math.max(1, count - 1))]);
  return sampled.sort((a, b) => a.timeSec - b.timeSec);
}

export function extractReviewFrames(videoPath, storyboardPath, outputDir) {
  const resolvedVideo = path.resolve(videoPath);
  const resolvedStoryboard = path.resolve(storyboardPath);
  if (!fs.existsSync(resolvedVideo)) throw new Error(`视频不存在：${resolvedVideo}`);
  const storyboard = JSON.parse(fs.readFileSync(resolvedStoryboard, 'utf8'));
  const frames = selectReviewFrames(storyboard);
  const resolvedOutput = path.resolve(outputDir ?? path.join(path.dirname(resolvedVideo), 'review-frames'));
  fs.mkdirSync(resolvedOutput, {recursive: true});
  const stagingDir = fs.mkdtempSync(path.join(resolvedOutput, '.review-frames-'));

  const manifest = [];
  const contactSheets = [];
  const pages = [];
  const contactSheet = path.join(resolvedOutput, 'contact-sheet.png');
  try {
    frames.forEach((frame, index) => {
      const fileName = `frame-${String(index + 1).padStart(2, '0')}.png`;
      const stagedFramePath = path.join(stagingDir, fileName);
      run('ffmpeg', ['-v', 'error', '-y', '-ss', frame.timeSec.toFixed(3), '-i', resolvedVideo, '-frames:v', '1', '-q:v', '2', stagedFramePath]);
      if (!fs.existsSync(stagedFramePath)) throw new Error(`无法从视频抽取 ${frame.label}：${frame.timeSec.toFixed(3)} 秒`);
      manifest.push({...frame, file: fileName});
    });

    for (let offset = 0; offset < frames.length; offset += 48) {
      const count = Math.min(48, frames.length - offset);
      const columns = Math.min(3, count);
      const rows = Math.ceil(count / columns);
      const sheetName = offset === 0 ? 'contact-sheet.png' : `contact-sheet-${offset / 48 + 1}.png`;
      const sheet = path.join(stagingDir, sheetName);
      contactSheets.push(sheetName);
      pages.push({file: sheetName, firstFrame: offset + 1, lastFrame: offset + count, startSec: frames[offset].timeSec, endSec: frames[offset + count - 1].timeSec});
      run('ffmpeg', [
        '-v', 'error', '-y', '-framerate', '1', '-start_number', String(offset + 1),
        '-i', path.join(stagingDir, 'frame-%02d.png'),
        '-vf', `scale=480:-2,tile=${columns}x${rows}:nb_frames=${count}:padding=16:margin=16:color=#111111`,
        '-frames:v', '1', sheet
      ]);
      if (!fs.existsSync(sheet) || fs.statSync(sheet).size === 0) throw new Error(`无法生成审片分页：${sheetName}`);
    }
    const manifestName = 'review-frames.json';
    fs.writeFileSync(path.join(stagingDir, manifestName), `${JSON.stringify({video: resolvedVideo, storyboard: resolvedStoryboard, frames: manifest, contactSheet: 'contact-sheet.png', contactSheets, pages}, null, 2)}\n`);
    for (const name of [...manifest.map((item) => item.file), ...contactSheets, manifestName]) {
      fs.renameSync(path.join(stagingDir, name), path.join(resolvedOutput, name));
    }
  } finally {
    fs.rmSync(stagingDir, {recursive: true, force: true});
  }
  console.log(`REVIEW FRAMES ${resolvedOutput} (${manifest.length} frames)`);
  console.log(`CONTACT SHEET ${contactSheet}`);
  return {outputDir: resolvedOutput, frames: manifest, contactSheet, contactSheets, pages};
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  const [videoPath, storyboardPath, outputDir] = process.argv.slice(2);
  if (!videoPath || !storyboardPath) {
    console.error('Usage: npm run extract:review-frames -- <video.mp4> <storyboard.json> [output-dir]');
    process.exit(1);
  }
  try {
    extractReviewFrames(videoPath, storyboardPath, outputDir);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
