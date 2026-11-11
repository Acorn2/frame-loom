import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {assertProjectOutput, outputBoundary} from './lib/project-files.mjs';
import {compileStoryboardShots} from '../src/shots/compile-shot.ts';
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
  const plans = compileStoryboardShots(storyboard);
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
    for (const checkpoint of plans.find((plan) => plan.sceneId === scene.id)?.checkpoints ?? []) candidates.push({label: `${scene.id}-shot-${checkpoint.id}`, required: true, timeSec: (startFrame + checkpoint.frame) / fps});
    if (['2.3', '2.4'].includes(storyboard.schemaVersion)) {
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
  const limit = ['2.3', '2.4'].includes(storyboard.schemaVersion) ? 48 : 24;
  if (unique.length <= limit) return unique;
  const sampled = unique.filter((item) => item.required);
  const optional = unique.filter((item) => !item.required);
  const count = Math.min(optional.length, Math.max(2, limit - sampled.length));
  for (let index = 0; index < count; index += 1) sampled.push(optional[Math.round(index * (optional.length - 1) / Math.max(1, count - 1))]);
  return sampled.sort((a, b) => a.timeSec - b.timeSec);
}

export const REVIEW_MEDIA_LIMIT_BYTES = 128 * 1024 * 1024;
const mediaHash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const managedMediaName = name => /^(frame-\d+|contact-sheet(?:-\d+)?)-[a-f0-9]{64}\.jpg$/.test(name);

export function extractReviewFrames(videoPath, storyboardPath, outputDir, {maxBytes = REVIEW_MEDIA_LIMIT_BYTES} = {}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || maxBytes > REVIEW_MEDIA_LIMIT_BYTES) throw new Error('审片图片预算必须为正整数字节，且不超过 128 MiB。');
  const resolvedVideo = path.resolve(videoPath);
  const resolvedStoryboard = path.resolve(storyboardPath);
  if (!fs.existsSync(resolvedVideo)) throw new Error(`视频不存在：${resolvedVideo}`);
  const storyboard = JSON.parse(fs.readFileSync(resolvedStoryboard, 'utf8'));
  const frames = selectReviewFrames(storyboard);
  const resolvedOutput = path.resolve(outputDir ?? path.join(path.dirname(resolvedVideo), 'review-frames'));
  const boundary = outputBoundary(path.join(resolvedOutput, 'review-frames.json'), path.dirname(resolvedStoryboard));
  const target = name => assertProjectOutput(boundary, path.join(resolvedOutput, name));
  const manifestPath = target('review-frames.json');
  const previous = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
  fs.mkdirSync(resolvedOutput, {recursive: true});
  const stagingDir = fs.mkdtempSync(path.join(resolvedOutput, '.review-frames-'));

  const manifest = [];
  const contactSheets = [];
  const pages = [];
  const publishedNew = [];
  let indexPublished = false;
  let contactSheet;
  const media = [];
  let totalBytes = 0;
  const registerMedia = name => {
    const file = path.join(stagingDir, name);
    const bytes = fs.statSync(file).size;
    totalBytes += bytes;
    if (totalBytes > maxBytes) throw new Error(`审片图片超过 ${Math.round(maxBytes / 1024 / 1024)} MiB 预算；未替换旧证据。请拆分项目或检查异常画面，不得丢弃必选检查点。`);
    const sha256 = mediaHash(file);
    const publishedName = `${path.parse(name).name}-${sha256}.jpg`;
    fs.renameSync(file, path.join(stagingDir, publishedName));
    media.push({file: publishedName, bytes, sha256});
    return publishedName;
  };
  try {
    const frameFiles = new Map();
    frames.forEach((frame, index) => {
      const frameNumber = Math.max(0, Math.min(storyboard.project.durationFrames - 1, Math.round(frame.timeSec * storyboard.project.fps)));
      const timeSec = frameNumber / storyboard.project.fps;
      let fileName = frameFiles.get(frameNumber);
      if (!frameFiles.has(frameNumber)) {
        fileName = `frame-${String(frameNumber).padStart(6, '0')}.jpg`;
        const stagedFramePath = path.join(stagingDir, fileName);
        run('ffmpeg', ['-v', 'error', '-y', '-ss', timeSec.toFixed(6), '-i', resolvedVideo, '-frames:v', '1', '-q:v', '2', '-pix_fmt', 'yuvj444p', stagedFramePath]);
        if (!fs.existsSync(stagedFramePath)) throw new Error(`无法从视频抽取 ${frame.label}：${timeSec.toFixed(3)} 秒`);
        fileName = registerMedia(fileName);
        frameFiles.set(frameNumber, fileName);
      }
      // Temporary hard links preserve label order in contact sheets without
      // storing the same video frame twice. Every checkpoint keeps its label.
      fs.linkSync(path.join(stagingDir, fileName), path.join(stagingDir, `tile-${String(index + 1).padStart(4, '0')}.jpg`));
      manifest.push({...frame, requestedTimeSec: frame.timeSec, timeSec, frameNumber, file: fileName});
    });

    for (let offset = 0; offset < frames.length; offset += 48) {
      const count = Math.min(48, frames.length - offset);
      const columns = Math.min(3, count);
      const rows = Math.ceil(count / columns);
      const sheetName = offset === 0 ? 'contact-sheet.jpg' : `contact-sheet-${offset / 48 + 1}.jpg`;
      const sheet = path.join(stagingDir, sheetName);
      run('ffmpeg', [
        '-v', 'error', '-y', '-framerate', '1', '-start_number', String(offset + 1),
        '-i', path.join(stagingDir, 'tile-%04d.jpg'),
        '-vf', `scale=480:-2,tile=${columns}x${rows}:nb_frames=${count}:padding=16:margin=16:color=#111111`,
        '-frames:v', '1', '-q:v', '2', '-pix_fmt', 'yuvj444p', sheet
      ]);
      if (!fs.existsSync(sheet) || fs.statSync(sheet).size === 0) throw new Error(`无法生成审片分页：${sheetName}`);
      const publishedSheet = registerMedia(sheetName);
      contactSheets.push(publishedSheet);
      pages.push({file: publishedSheet, firstFrame: offset + 1, lastFrame: offset + count, startSec: manifest[offset].timeSec, endSec: manifest[offset + count - 1].timeSec});
    }
    const manifestName = 'review-frames.json';
    const storage = {format: 'jpeg', fullResolution: true, uniqueFrameCount: frameFiles.size, totalBytes, limitBytes: maxBytes};
    contactSheet = path.join(resolvedOutput, contactSheets[0]);
    fs.writeFileSync(path.join(stagingDir, manifestName), `${JSON.stringify({schemaVersion: '1.1', video: resolvedVideo, storyboard: resolvedStoryboard, frames: manifest, contactSheet: contactSheets[0], contactSheets, pages, storage, media}, null, 2)}\n`);
    for (const item of media) {
      const file = target(item.file);
      if (fs.existsSync(file) && mediaHash(file) !== item.sha256) throw new Error(`审片媒体与名称摘要不一致，未覆盖：${file}`);
    }
    target(manifestName);
    for (const item of media) {
      const file = target(item.file);
      if (fs.existsSync(file)) continue;
      fs.renameSync(path.join(stagingDir, item.file), file);
      publishedNew.push(item);
    }
    fs.renameSync(path.join(stagingDir, manifestName), target(manifestName));
    indexPublished = true;
    // Only remove obsolete files generated by this format, after successful
    // publication and a byte check. Legacy PNGs and user files remain untouched.
    const currentNames = new Set(media.map(item => item.file));
    for (const item of previous.schemaVersion === '1.1' && Array.isArray(previous.media) ? previous.media : []) {
      if (typeof item.file !== 'string' || !managedMediaName(item.file) || currentNames.has(item.file)) continue;
      const file = target(item.file);
      if (fs.existsSync(file) && mediaHash(file) === item.sha256) fs.unlinkSync(file);
    }
  } finally {
    if (!indexPublished) {
      for (const item of publishedNew) {
        const file = target(item.file);
        if (fs.existsSync(file) && mediaHash(file) === item.sha256) fs.unlinkSync(file);
      }
    }
    fs.rmSync(stagingDir, {recursive: true, force: true});
  }
  console.log(`REVIEW FRAMES ${resolvedOutput} (${manifest.length} frames)`);
  console.log(`CONTACT SHEET ${contactSheet}`);
  return {outputDir: resolvedOutput, frames: manifest, contactSheet, contactSheets, pages, storage: {format: 'jpeg', uniqueFrameCount: media.length - pages.length, totalBytes, limitBytes: maxBytes}};
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
