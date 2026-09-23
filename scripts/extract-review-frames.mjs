import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

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
    if (!result.some((item) => Math.abs(item.timeSec - candidate.timeSec) < 0.2)) {
      result.push(candidate);
    }
  }
  return result;
}

export function selectReviewFrames(storyboard) {
  const fps = storyboard.project.fps;
  const durationSec = storyboard.project.durationFrames / fps;
  const candidates = [{label: 'opening', timeSec: Math.min(0.5, durationSec * 0.08)}];
  let sceneStartFrames = 0;

  for (const scene of storyboard.scenes) {
    const startSec = sceneStartFrames / fps;
    const sceneDurationSec = scene.durationFrames / fps;
    candidates.push({label: `${scene.id}-content`, timeSec: startSec + sceneDurationSec * 0.55});
    if (scene.transitionOut) {
      candidates.push({label: `${scene.id}-transition`, timeSec: startSec + Math.max(0, sceneDurationSec - 0.35)});
    }
    sceneStartFrames += scene.durationFrames;
  }

  candidates.push(
    {label: 'quarter', timeSec: durationSec * 0.25},
    {label: 'middle', timeSec: durationSec * 0.5},
    {label: 'three-quarter', timeSec: durationSec * 0.75},
    {label: 'ending', timeSec: Math.max(0, durationSec - 0.5)}
  );

  if (durationSec >= 20) {
    for (let index = 1; index <= 6; index += 1) {
      candidates.push({label: `coverage-${index}`, timeSec: durationSec * (index / 7)});
    }
  }
  const unique = uniqueCandidates(candidates, durationSec);
  if (unique.length <= 12) return unique;
  const sampled = [];
  for (let index = 0; index < 12; index += 1) {
    sampled.push(unique[Math.round(index * (unique.length - 1) / 11)]);
  }
  return sampled;
}

export function extractReviewFrames(videoPath, storyboardPath, outputDir) {
  const resolvedVideo = path.resolve(videoPath);
  const resolvedStoryboard = path.resolve(storyboardPath);
  if (!fs.existsSync(resolvedVideo)) throw new Error(`视频不存在：${resolvedVideo}`);
  const storyboard = JSON.parse(fs.readFileSync(resolvedStoryboard, 'utf8'));
  const frames = selectReviewFrames(storyboard);
  const resolvedOutput = path.resolve(outputDir ?? path.join(path.dirname(resolvedVideo), 'review-frames'));
  fs.mkdirSync(resolvedOutput, {recursive: true});
  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-loom-contact-'));

  const manifest = [];
  const contactSheet = path.join(resolvedOutput, 'contact-sheet.png');
  try {
    frames.forEach((frame, index) => {
      const fileName = `frame-${String(index + 1).padStart(2, '0')}.png`;
      const stagedFramePath = path.join(stagingDir, fileName);
      run('ffmpeg', ['-v', 'error', '-y', '-ss', frame.timeSec.toFixed(3), '-i', resolvedVideo, '-frames:v', '1', '-q:v', '2', stagedFramePath]);
      fs.copyFileSync(stagedFramePath, path.join(resolvedOutput, fileName));
      manifest.push({...frame, file: fileName});
    });

    const columns = Math.min(3, frames.length);
    const rows = Math.ceil(frames.length / columns);
    run('ffmpeg', [
      '-v', 'error', '-y', '-framerate', '1', '-start_number', '1',
      '-i', path.join(stagingDir, 'frame-%02d.png'),
      '-vf', `scale=480:-2,tile=${columns}x${rows}:padding=16:margin=16:color=#111111`,
      '-frames:v', '1', contactSheet
    ]);
  } finally {
    fs.rmSync(stagingDir, {recursive: true, force: true});
  }
  fs.writeFileSync(path.join(resolvedOutput, 'review-frames.json'), `${JSON.stringify({video: resolvedVideo, storyboard: resolvedStoryboard, frames: manifest, contactSheet: 'contact-sheet.png'}, null, 2)}\n`);
  console.log(`REVIEW FRAMES ${resolvedOutput} (${manifest.length} frames)`);
  console.log(`CONTACT SHEET ${contactSheet}`);
  return {outputDir: resolvedOutput, frames: manifest, contactSheet};
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
