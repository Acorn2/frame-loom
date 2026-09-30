import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {afterEach, describe, expect, it} from 'vitest';
import {approveDelivery, checkDeliveryEligibility} from '../scripts/approve-delivery.mjs';
import {fingerprintFiles, fingerprintProjectInputs} from '../scripts/lib/input-fingerprint.mjs';
import {synthesizeSpeech} from '../scripts/lib/tts-provider.mjs';
import {inspectAudio} from '../scripts/inspect-audio.mjs';
import {runQa} from '../scripts/qa-storyboard.mjs';
import {writeRenderReceipt} from '../scripts/lib/render-receipt.mjs';

const temporaryDirectories = [];
const styleRoot = path.resolve('styles');
const passingReview = {
  reviewer: 'creator',
  notes: 'Watched the full video and checked sound, captions, timing, and asset rights.',
  fullPlaybackPassed: true,
  visualHierarchyPassed: true,
  textReadabilityPassed: true,
  transitionTimingPassed: true,
  audioQualityPassed: true,
  captionReadabilityPassed: true,
  assetRightsPassed: true
};

function makeTempDir() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-loom-delivery-'));
  temporaryDirectories.push(directory);
  return directory;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), {recursive: true});
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, {recursive: true, force: true});
});

describe('delivery gate', () => {
  it('rejects a silent preview and incomplete human review', () => {
    const run = {status: 'completed', stages: {qa: 'completed'}, audioModeResolved: 'silent'};
    const qa = {automatedPassed: true, mode: 'silent-preview', checks: {output: {passed: true, audioStreams: 0}, audio: {passed: true}}};
    expect(checkDeliveryEligibility(run, qa, passingReview)).toContain('静音预览不能作为可交付视频。');
    run.audioModeResolved = 'external';
    qa.mode = 'audio-pilot';
    qa.checks.output.audioStreams = 1;
    expect(checkDeliveryEligibility(run, qa, {...passingReview, fullPlaybackPassed: false})).toContain('人工复核记录需要 fullPlaybackPassed=true。');
  });

  it('approves a current audio output and rejects stale video bytes', () => {
    const project = makeTempDir();
    const videoPath = path.join(project, 'output', 'pilot-audio.mp4');
    const qaPath = path.join(project, 'output', 'pilot-audio-review', 'qa-report.json');
    const reviewPath = path.join(project, 'output', 'manual-review.json');
    fs.mkdirSync(path.dirname(videoPath), {recursive: true});
    const rendered = spawnSync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'color=c=black:s=320x180:r=30:d=1',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1',
      '-shortest', '-c:v', 'libx264', '-c:a', 'aac', videoPath
    ], {encoding: 'utf8'});
    expect(rendered.status, rendered.stderr).toBe(0);
    writeRenderReceipt(videoPath, {purpose: 'in-project-video', showReviewMarker: false});
    const originalVideo = fs.readFileSync(videoPath);
    writeJson(path.join(project, 'storyboard.json'), {project: {width: 320, height: 180, fps: 30, durationFrames: 30}});
    const audioConfig = {schemaVersion: '1.0', voiceover: {enabled: true, path: 'voiceover.wav', volume: 1, source: 'test fixture', license: 'user-owned'}};
    writeJson(path.join(project, 'audio', 'audio-config.json'), audioConfig);
    writeJson(path.join(project, 'audio', 'audio-config.tts.json'), audioConfig);
    writeJson(reviewPath, passingReview);
    writeJson(qaPath, {
      video: videoPath,
      automatedPassed: true,
      releaseReady: false,
      mode: 'audio-pilot',
      checks: {output: {passed: true, audioStreams: 1}, audio: {passed: true}, narratedRenderProfile: {passed: true}}
    });
    writeJson(path.join(project, 'run.json'), {
      status: 'completed',
      deliveryStatus: 'manual-review-pending',
      stages: {qa: 'completed'},
      audioModeResolved: 'external',
      artifacts: {video: 'output/pilot-audio.mp4', qaReport: 'output/pilot-audio-review/qa-report.json'},
      inputFingerprint: fingerprintProjectInputs(project, styleRoot),
      outputFingerprint: fingerprintFiles([videoPath], project)
    });

    approveDelivery(project, reviewPath);
    expect(JSON.parse(fs.readFileSync(path.join(project, 'run.json'), 'utf8')).deliveryStatus).toBe('release-ready');
    expect(JSON.parse(fs.readFileSync(qaPath, 'utf8')).releaseReady).toBe(true);

    fs.appendFileSync(videoPath, 'changed');
    expect(() => approveDelivery(project, reviewPath)).toThrow(/视频已在 QA 后变化/);

    fs.writeFileSync(videoPath, originalVideo);
    writeJson(path.join(project, 'audio', 'tts-config.json'), {provider: 'mock'});
    const run = JSON.parse(fs.readFileSync(path.join(project, 'run.json'), 'utf8'));
    run.audioModeResolved = 'tts';
    run.inputFingerprint = fingerprintProjectInputs(project, styleRoot);
    writeJson(path.join(project, 'run.json'), run);
    expect(() => approveDelivery(project, reviewPath)).toThrow(/mock TTS 仅用于测试/);

    runQa({
      storyboardPath: path.join(project, 'storyboard.json'),
      videoPath,
      reviewDir: path.dirname(qaPath)
    });
    expect(JSON.parse(fs.readFileSync(path.join(project, 'run.json'), 'utf8')).deliveryStatus).toBe('pending');
    expect(JSON.parse(fs.readFileSync(qaPath, 'utf8')).releaseReady).toBe(false);
  });

  it('makes mock TTS measurable for timing and loudness QA', async () => {
    const project = makeTempDir();
    const tonePath = path.join(project, 'tone.wav');
    await synthesizeSpeech({
      text: '测试旁白',
      config: {provider: 'mock', format: 'wav', speedRatio: 1, sampleRate: 24000},
      outputPath: tonePath
    });
    expect(fs.readFileSync(tonePath).subarray(44).some((byte) => byte !== 0)).toBe(true);
    const configPath = path.join(project, 'audio-config.json');
    writeJson(configPath, {schemaVersion: '1.0', voiceover: {enabled: true, path: 'tone.wav', volume: 1, source: 'mock test tone', license: 'test-only'}});
    const report = inspectAudio(path.resolve('examples/article-video/storyboard.json'), configPath);
    expect(report.needsRetiming).toBe(false);
    expect(Number.isFinite(report.tracks[0].loudness.integratedLufs)).toBe(true);
  });
});
