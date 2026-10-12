import fs from 'node:fs';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {getSceneTimeline} from '../../src/timeline/scene-timeline.ts';
import {LAYOUT_LOG_PREFIX} from '../../src/layout/diagnostics.ts';
import {hashValue} from './production-lock.mjs';

const fileHash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function ffmpeg(args) {
  const result = spawnSync('ffmpeg', ['-v', 'error', '-nostdin', ...args], {encoding: 'utf8'});
  if (result.error || result.status !== 0) throw new Error(`分场合成失败：${result.error?.message ?? result.stderr}`);
}
function inspectClip(file, scene, project) {
  const result = spawnSync('ffprobe', ['-v', 'error', '-count_frames', '-show_streams', '-of', 'json', file], {encoding: 'utf8'});
  if (result.error || result.status !== 0) throw new Error('缓存视频不可读。');
  const streams = JSON.parse(result.stdout).streams;
  const video = streams.find(stream => stream.codec_type === 'video');
  if (streams.length !== 1 || !video || video.codec_name !== 'h264' || video.width !== project.width || video.height !== project.height || Number(video.nb_read_frames) !== scene.durationFrames || video.avg_frame_rate !== `${project.fps}/1`) throw new Error('缓存视频的帧数、画幅、编码或帧率不一致。');
}
function inspectSamples(samples, frames, sceneId) {
  if (JSON.stringify(samples.map(sample => sample.frame).sort((a, b) => a - b)) !== JSON.stringify(frames)
    || samples.some(sample => sample.checks.length !== 1 || sample.checks[0].sceneId !== sceneId || sample.checks[0].frame !== sample.frame || sample.checks[0].issues.some(issue => issue.severity === 'error'))) throw new Error(`${sceneId}: 分场布局实测缺失或失败。`);
}

export function sceneCacheKey({inputProps, composition, timing, layoutFrames}) {
  const {storyboard, styleTokens, audioRuntime, renderProfile} = inputProps;
  const {status: _status, ...project} = storyboard.project;
  const {storyboardHash: _boardHash, planHash: _planHash, hash: _hash, ...implementation} = renderProfile.productionLock;
  const captions = audioRuntime?.captions?.filter(cue => cue.endSec * project.fps > timing.startFrame && cue.startSec * project.fps < timing.endFrame);
  return hashValue({version: 1, platform: process.platform, arch: process.arch,
    scene: timing.scene, startFrame: timing.startFrame, project, schemaVersion: storyboard.schemaVersion,
    style: storyboard.style, font: storyboard.font, palette: storyboard.palette, layoutPolicy: storyboard.layoutPolicy,
    styleTokens, implementation, composition: {width: composition.width, height: composition.height, fps: composition.fps, durationInFrames: composition.durationInFrames},
    profile: {brand: renderProfile.brand, purpose: renderProfile.purpose, showReviewMarker: renderProfile.showReviewMarker, font: renderProfile.font, facecamRightFraction: renderProfile.facecamRightFraction, subtitleBottomFraction: renderProfile.subtitleBottomFraction},
    externalCaptions: Boolean(audioRuntime?.captions?.length), captions, layoutFrames});
}

// Cache only visual frames. Render the full audio timeline once to avoid AAC
// encoder padding at scene seams and preserve music ducking / cross-scene SFX.
export async function renderWithSceneCache({projectPath, inputProps, composition, serveUrl, outputPath, renderMedia, layout, hasAudio}) {
  const board = inputProps.storyboard;
  const timeline = getSceneTimeline(board);
  if (!inputProps.renderProfile.productionLock || timeline.some(item => item.overlapInFrames || item.overlapOutFrames)) return {used: false, reason: '历史分镜或重叠换场使用整片渲染'};
  const directory = path.join(projectPath, '.cache', 'scenes');
  for (const folder of [path.join(projectPath, '.cache'), directory]) {
    if (fs.existsSync(folder) && fs.lstatSync(folder).isSymbolicLink()) throw new Error('分场缓存目录不能是符号链接。');
    fs.mkdirSync(folder, {recursive: true});
  }
  const clipNames = [];
  const scenes = [];
  const assembly = fs.mkdtempSync(path.join(directory, '.assembly-'));
  try {
    for (const timing of timeline) {
      const frames = layout.frames.filter(frame => frame >= timing.startFrame && frame < timing.endFrame);
      const key = sceneCacheKey({inputProps, composition, timing, layoutFrames: frames});
      const name = `${key}.mp4`, file = path.join(directory, name), recordPath = `${file}.json`;
      let record;
      try {
        if (fs.lstatSync(file).isSymbolicLink() || fs.lstatSync(recordPath).isSymbolicLink()) throw new Error('symlink');
        record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
        const {evidenceHash, ...evidence} = record;
        if (record.key !== key || record.videoHash !== fileHash(file) || evidenceHash !== hashValue(evidence) || JSON.stringify(record.frames) !== JSON.stringify(frames) || JSON.stringify(record.samples.map(sample => sample.frame).sort((a, b) => a - b)) !== JSON.stringify(frames)) throw new Error('stale evidence');
        inspectSamples(record.samples, frames, timing.scene.id);
        inspectClip(file, timing.scene, board.project);
      } catch {record = undefined;}
      if (!record) {
        const temporary = path.join(directory, `${key}-${randomUUID()}.mp4`);
        const temporaryRecord = `${temporary}.json`;
        const samples = new Map();
        try {
          await renderMedia({composition, serveUrl, codec: 'h264', outputLocation: temporary, inputProps, frameRange: [timing.startFrame, timing.endFrame - 1], muted: true, audioCodec: null, logLevel: 'error',
            onBrowserLog: log => {
              if (!log.text.startsWith(LAYOUT_LOG_PREFIX)) return;
              const sample = JSON.parse(log.text.slice(LAYOUT_LOG_PREFIX.length));
              if (frames.includes(sample.frame)) samples.set(sample.frame, sample);
            }});
          inspectClip(temporary, timing.scene, board.project);
          // Evaluate fresh evidence before storing a reusable clip.
          inspectSamples([...samples.values()], frames, timing.scene.id);
          const evidence = {key, videoHash: fileHash(temporary), frames, samples: [...samples.values()]};
          record = {...evidence, evidenceHash: hashValue(evidence)};
          fs.writeFileSync(temporaryRecord, JSON.stringify(record), {flag: 'wx'});
          fs.renameSync(temporary, file);
          fs.renameSync(temporaryRecord, recordPath);
        } finally {
          for (const owned of [temporary, temporaryRecord]) if (fs.existsSync(owned)) fs.unlinkSync(owned);
        }
        console.log(`SCENE RENDERED ${timing.scene.id}`);
        scenes.push({sceneId: timing.scene.id, key, reused: false});
      } else {
        console.log(`SCENE CACHE HIT ${timing.scene.id}`);
        scenes.push({sceneId: timing.scene.id, key, reused: true});
      }
      const snapshot = path.join(assembly, name);
      fs.copyFileSync(file, snapshot);
      if (fileHash(snapshot) !== record.videoHash) throw new Error(`${timing.scene.id}: 缓存在读取期间变化，请重试。`);
      for (const sample of record.samples) layout.onBrowserLog({text: `${LAYOUT_LOG_PREFIX}${JSON.stringify(sample)}`});
      clipNames.push(name);
    }
    const list = path.join(assembly, 'concat.txt'), visual = path.join(assembly, 'visual.mp4'), audio = path.join(assembly, 'audio.wav');
    fs.writeFileSync(list, clipNames.map(name => `file '${name}'`).join('\n'), {flag: 'wx'});
    ffmpeg(['-f', 'concat', '-safe', '1', '-i', list, '-map', '0:v:0', '-c:v', 'copy', '-an', visual]);
    if (hasAudio) {
      await renderMedia({composition, serveUrl, codec: 'wav', audioCodec: 'pcm-16', outputLocation: audio, inputProps, enforceAudioTrack: true, logLevel: 'error'});
      ffmpeg(['-i', visual, '-i', audio, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-movflags', '+faststart', outputPath]);
    } else fs.copyFileSync(visual, outputPath);
    return {used: true, scenes};
  } finally {
    for (const name of fs.readdirSync(assembly)) fs.unlinkSync(path.join(assembly, name));
    fs.rmdirSync(assembly);
  }
}
