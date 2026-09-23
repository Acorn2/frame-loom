import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {inspectAudio} from './inspect-audio.mjs';
import {runQa} from './qa-storyboard.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const keepOutputs = process.argv.includes('--keep');
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-loom-audio-pilot-'));
const audioPath = path.join(temporaryRoot, 'voiceover.wav');
const captionsPath = path.join(temporaryRoot, 'captions.srt');
const audioConfigPath = path.join(temporaryRoot, 'audio-config.json');
const fixtures = [
  {
    id: 'article-video',
    storyboardPath: path.join(projectRoot, 'examples/article-video/storyboard.json'),
    orientation: 'landscape'
  },
  {
    id: 'data-explainer',
    storyboardPath: path.join(projectRoot, 'examples/data-explainer/storyboard.json'),
    orientation: 'portrait'
  }
];

function run(command, args) {
  const result = spawnSync(command, args, {cwd: projectRoot, encoding: 'utf8', stdio: 'inherit'});
  if (result.error?.code === 'ENOENT') {
    throw new Error(`找不到 ${command}。请安装 FFmpeg，并确保 ${command} 在 PATH 中。`);
  }
  if (result.status !== 0) {
    throw new Error(`${command} 执行失败，退出码：${result.status ?? 'unknown'}`);
  }
}

function writeFixtureFiles() {
  run('ffmpeg', [
    '-v', 'error',
    '-y',
    '-f', 'lavfi',
    '-i', 'sine=frequency=440:duration=20',
    '-ac', '1',
    '-ar', '44100',
    audioPath
  ]);
  fs.writeFileSync(captionsPath, [
    '1',
    '00:00:01,000 --> 00:00:03,000',
    '这是一条较长的外部字幕，用于验证横屏画布中的安全区、换行和字幕背景宽度。',
    '',
    '2',
    '00:00:07,000 --> 00:00:10,000',
    'External caption two with a deliberately long sentence for wrapping checks.',
    '',
    '3',
    '00:00:14,000 --> 00:00:17,000',
    'External caption three',
    ''
  ].join('\n'));
  fs.writeFileSync(audioConfigPath, `${JSON.stringify({
    schemaVersion: '1.0',
    voiceover: {
      enabled: true,
      path: 'voiceover.wav',
      volume: 0.4,
      source: 'generated test tone',
      license: 'test-only'
    },
    music: {
      enabled: true,
      path: 'voiceover.wav',
      volume: 0.3,
      source: 'generated test tone',
      license: 'test-only',
      ducking: {enabled: true, volume: 0.2, attackSec: 0.08, releaseSec: 0.18}
    },
    captions: {
      enabled: true,
      path: 'captions.srt',
      format: 'srt',
      source: 'generated test captions'
    }
  }, null, 2)}\n`);
}

try {
  writeFixtureFiles();
  for (const fixture of fixtures) {
    const outputPath = path.join(temporaryRoot, `${fixture.id}-audio-pilot.mp4`);
    const reviewDir = path.join(temporaryRoot, `${fixture.id}-review`);
    const timing = inspectAudio(fixture.storyboardPath, audioConfigPath);
    if (timing.needsRetiming || timing.captions.count !== 3) {
      throw new Error(`${fixture.id} 测试音频 timing 不符合预期：${JSON.stringify(timing)}`);
    }

    run(process.execPath, [
      '--import',
      'tsx/esm',
      'scripts/render-storyboard.mjs',
      fixture.storyboardPath,
      outputPath,
      '--audio-config',
      audioConfigPath
    ]);

    const qa = runQa({
      storyboardPath: fixture.storyboardPath,
      videoPath: outputPath,
      reviewDir,
      audioConfigPath,
      expectAudio: true
    });
    const audioStreams = qa.report.checks.output?.audioStreams ?? 0;
    const orientation = qa.report.checks.output?.orientation;
    if (
      !qa.report.automatedPassed ||
      qa.report.mode !== 'audio-pilot' ||
      audioStreams < 1 ||
      orientation !== fixture.orientation
    ) {
      throw new Error(`${fixture.id} 音频 pilot QA 未通过：${qa.reportPath}`);
    }
    console.log(`AUDIO PILOT PASS ${fixture.id} ${qa.reportPath}`);
  }
  if (keepOutputs) console.log(`AUDIO PILOT OUTPUT ${temporaryRoot}`);
} finally {
  if (!keepOutputs) fs.rmSync(temporaryRoot, {recursive: true, force: true});
}
