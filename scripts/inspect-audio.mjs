import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {parseCaptions} from '../src/audio/captions.ts';
import {analyzeAudioTiming} from '../src/audio/timing.ts';
import {AudioConfigSchema} from '../src/schemas/audio-config.ts';
import {StoryboardSchema} from '../src/schemas/storyboard.ts';

function readJson(schema, filePath, label) {
  const parsed = schema.safeParse(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  if (!parsed.success) {
    throw new Error(`${label} 无效：${parsed.error.issues.map((item) => `${item.path.join('.')}: ${item.message}`).join('; ')}`);
  }
  return parsed.data;
}

function probeDuration(filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile() || fs.statSync(filePath).size === 0) {
    throw new Error(`音频文件不存在或为空：${filePath}`);
  }
  const result = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', filePath], {encoding: 'utf8'});
  if (result.error?.code === 'ENOENT') throw new Error('找不到 ffprobe。请安装 FFmpeg，并确保 ffprobe 在 PATH 中。');
  if (result.status !== 0) throw new Error(`ffprobe 无法读取音频：${filePath}\n${result.stderr.trim()}`);
  const durationSec = Number(JSON.parse(result.stdout).format?.duration);
  if (!Number.isFinite(durationSec) || durationSec <= 0) throw new Error(`无法获得有效音频时长：${filePath}`);
  return durationSec;
}

function probeLoudness(filePath) {
  const result = spawnSync('ffmpeg', [
    '-hide_banner',
    '-nostats',
    '-i',
    filePath,
    '-af',
    'loudnorm=I=-16:LRA=11:TP=-1.5:print_format=json',
    '-f',
    'null',
    '-'
  ], {encoding: 'utf8'});
  if (result.error?.code === 'ENOENT') throw new Error('找不到 ffmpeg。请安装 FFmpeg，并确保 ffmpeg 在 PATH 中。');
  if (result.status !== 0) throw new Error(`ffmpeg 无法测量音频响度：${filePath}\n${result.stderr.trim()}`);
  const start = result.stderr.lastIndexOf('{');
  const end = result.stderr.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error(`无法解析音频响度报告：${filePath}`);
  const report = JSON.parse(result.stderr.slice(start, end + 1));
  const loudness = {
    integratedLufs: Number(report.input_i),
    truePeakDb: Number(report.input_tp),
    loudnessRangeDb: Number(report.input_lra)
  };
  if (Object.values(loudness).some((value) => !Number.isFinite(value))) {
    throw new Error(`音频响度报告缺少有效数值：${filePath}`);
  }
  return loudness;
}

export function inspectAudio(storyboardPath, audioConfigPath) {
  const resolvedStoryboard = path.resolve(storyboardPath);
  const resolvedConfig = path.resolve(audioConfigPath);
  const storyboard = readJson(StoryboardSchema, resolvedStoryboard, 'storyboard.json');
  const config = readJson(AudioConfigSchema, resolvedConfig, 'audio-config.json');
  const configDirectory = path.dirname(resolvedConfig);
  const tracks = [];
  const addTrack = (kind, id, item) => {
    if (!item?.enabled) return;
    const filePath = path.resolve(configDirectory, item.path);
    tracks.push({
      id,
      kind,
      startSec: item.startSec ?? 0,
      durationSec: probeDuration(filePath),
      loudness: probeLoudness(filePath),
      path: filePath
    });
  };
  addTrack('voiceover', 'voiceover', config.voiceover);
  addTrack('music', 'music', config.music);
  for (const [index, item] of (config.sfx ?? []).entries()) addTrack('sfx', `sfx-${index + 1}`, item);

  let captions = [];
  let captionPath;
  if (config.captions?.enabled) {
    captionPath = path.resolve(configDirectory, config.captions.path);
    if (!fs.existsSync(captionPath)) throw new Error(`字幕文件不存在：${captionPath}`);
    captions = parseCaptions(fs.readFileSync(captionPath, 'utf8'));
    if (captions.length === 0) throw new Error(`字幕文件没有可用 cue：${captionPath}`);
  }

  const report = analyzeAudioTiming(
    storyboard.project.durationFrames / storyboard.project.fps,
    tracks.map(({path: _path, ...track}) => track),
    captions
  );
  const result = {
    ...report,
    storyboard: resolvedStoryboard,
    audioConfig: resolvedConfig,
    tracks: report.tracks.map((track) => ({...track, path: tracks.find((item) => item.id === track.id)?.path})),
    captionPath
  };
  for (const track of result.tracks) {
    if (track.loudness.truePeakDb > -1) {
      result.issues.push({
        severity: 'warning',
        path: `tracks.${track.id}.loudness.truePeakDb`,
        message: `true peak 为 ${track.loudness.truePeakDb.toFixed(2)} dBTP，接近或超过 0 dBTP，请人工检查削波。`
      });
    }
    if (track.kind === 'voiceover' && track.loudness.integratedLufs > -9) {
      result.issues.push({
        severity: 'warning',
        path: `tracks.${track.id}.loudness.integratedLufs`,
        message: `voiceover integrated loudness 为 ${track.loudness.integratedLufs.toFixed(2)} LUFS，偏高，请人工检查听感。`
      });
    }
  }
  for (const issue of result.issues) console[issue.severity === 'error' ? 'error' : 'warn'](`${issue.severity.toUpperCase()} ${issue.path}: ${issue.message}`);
  console.log(`AUDIO TIMING ${result.needsRetiming ? 'FAILED' : 'OK'} ${JSON.stringify(result)}`);
  return result;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  const [storyboardPath, audioConfigPath] = process.argv.slice(2);
  if (!storyboardPath || !audioConfigPath) {
    console.error('Usage: npm run inspect:audio -- <storyboard.json> <audio-config.json>');
    process.exit(1);
  }
  try {
    const report = inspectAudio(storyboardPath, audioConfigPath);
    if (report.needsRetiming) process.exit(1);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
