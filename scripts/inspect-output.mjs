import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';

function fail(message) {
  throw new Error(message);
}

function parseFrameRate(value) {
  if (typeof value !== 'string' || !value.includes('/')) {
    return Number.NaN;
  }
  const [numerator, denominator] = value.split('/').map(Number);
  return denominator ? numerator / denominator : Number.NaN;
}

function runFfprobe(outputPath) {
  const result = spawnSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-show_entries',
      'format=duration,format_name,bit_rate,size:stream=index,codec_type,codec_name,width,height,avg_frame_rate,duration,pix_fmt',
      '-of',
      'json',
      outputPath
    ],
    {encoding: 'utf8'}
  );

  if (result.error?.code === 'ENOENT') {
    fail('找不到 ffprobe。请安装 FFmpeg，并确保 ffprobe 在 PATH 中。');
  }
  if (result.status !== 0) {
    fail(`ffprobe 无法读取输出文件：${result.stderr.trim() || '未知错误'}`);
  }

  try {
    return JSON.parse(result.stdout);
  } catch {
    fail('ffprobe 返回了无法解析的 JSON。');
  }
}

export function inspectOutput(outputPath, storyboard, options = {}) {
  const expectAudio = options.expectAudio === true;
  const resolvedOutput = path.resolve(outputPath);
  if (!fs.existsSync(resolvedOutput)) {
    fail(`输出文件不存在：${resolvedOutput}`);
  }

  const stat = fs.statSync(resolvedOutput);
  if (!stat.isFile() || stat.size === 0) {
    fail(`输出文件为空或不是普通文件：${resolvedOutput}`);
  }

  const metadata = runFfprobe(resolvedOutput);
  const streams = Array.isArray(metadata.streams) ? metadata.streams : [];
  const videoStreams = streams.filter((stream) => stream.codec_type === 'video');
  const audioStreams = streams.filter((stream) => stream.codec_type === 'audio');
  if (videoStreams.length !== 1) {
    fail(`输出必须包含且只能包含一个 video stream，实际为 ${videoStreams.length}。`);
  }
  if (!expectAudio && audioStreams.length !== 0) {
    fail(`静音预览不应包含 audio stream，实际为 ${audioStreams.length}。`);
  }
  if (expectAudio && audioStreams.length === 0) fail('音频 pilot 应包含 audio stream，但实际没有。');

  const video = videoStreams[0];
  if (video.codec_name !== 'h264') {
    fail(`输出视频编码必须为 h264，实际为 ${video.codec_name || '未知'}。`);
  }

  const expectedWidth = storyboard?.project?.width;
  const expectedHeight = storyboard?.project?.height;
  const expectedFps = storyboard?.project?.fps;
  const expectedDuration = storyboard?.project?.durationFrames / expectedFps;
  if (video.width !== expectedWidth || video.height !== expectedHeight) {
    fail(`输出分辨率 ${video.width}x${video.height} 不符合 storyboard 的 ${expectedWidth}x${expectedHeight}。`);
  }

  const actualFps = parseFrameRate(video.avg_frame_rate);
  if (!Number.isFinite(actualFps) || Math.abs(actualFps - expectedFps) > 0.01) {
    fail(`输出帧率 ${video.avg_frame_rate || '未知'} 不符合 storyboard 的 ${expectedFps} fps。`);
  }

  const actualDuration = Number(metadata.format?.duration ?? video.duration);
  // AAC/MP4 muxing may add a small encoder-delay tail even when the visual
  // composition has the exact requested frame count. Keep silent previews
  // strict and allow at most roughly three frames for an audio pilot.
  const durationTolerance = expectAudio
    ? Math.max(3 / expectedFps, 0.12)
    : Math.max(1 / expectedFps, 0.05);
  if (!Number.isFinite(actualDuration) || Math.abs(actualDuration - expectedDuration) > durationTolerance) {
    fail(`输出时长 ${actualDuration.toFixed(3)}s 不符合 storyboard 的 ${expectedDuration.toFixed(3)}s。`);
  }

  const report = {
    path: resolvedOutput,
    bytes: stat.size,
    codec: video.codec_name,
    width: video.width,
    height: video.height,
    fps: actualFps,
    durationSec: actualDuration,
    expectedDurationSec: expectedDuration,
    durationDeltaSec: actualDuration - expectedDuration,
    durationToleranceSec: durationTolerance,
    audioStreams: audioStreams.length,
    pixelFormat: video.pix_fmt,
    formatName: metadata.format?.format_name,
    bitRate: Number(metadata.format?.bit_rate ?? 0),
    orientation: video.width < video.height ? 'portrait' : 'landscape'
  };
  console.log(`OUTPUT OK ${JSON.stringify(report)}`);
  return report;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  const cliArgs = process.argv.slice(2);
  const expectAudio = cliArgs.includes('--expect-audio');
  const [outputPath, storyboardPath] = cliArgs.filter((item) => item !== '--expect-audio');
  if (!outputPath || !storyboardPath) {
    console.error('Usage: npm run inspect:output -- <output.mp4> <storyboard.json>');
    process.exit(1);
  }

  try {
    const storyboard = JSON.parse(fs.readFileSync(path.resolve(storyboardPath), 'utf8'));
    inspectOutput(outputPath, storyboard, {expectAudio});
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
