import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {afterEach, describe, expect, it} from 'vitest';
import {loadHandoffConfig, resolveOutputPurpose} from '../scripts/lib/output-purpose.mjs';
import {listTtsProfiles, selectTtsProfile} from '../scripts/lib/tts-profiles.mjs';
import {approveStoryboard} from '../scripts/approve-storyboard.mjs';
import {assertStoryboardApproval} from '../scripts/lib/storyboard-approval.mjs';
import {prepareScriptHandoff} from '../scripts/prepare-script-handoff.mjs';
import {checkVisualHandoffEligibility} from '../scripts/approve-visual-handoff.mjs';
import {fingerprintFiles, fingerprintProjectInputs} from '../scripts/lib/input-fingerprint.mjs';
import {runProduction} from '../scripts/produce.mjs';

const directories = [];
const sourceStoryboard = JSON.parse(fs.readFileSync(path.resolve('examples/creator-production-pilot/storyboard.json'), 'utf8'));

function projectFixture() {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-loom-purpose-'));
  directories.push(project);
  fs.mkdirSync(path.join(project, 'audio'));
  fs.mkdirSync(path.join(project, 'output'));
  const storyboard = structuredClone(sourceStoryboard);
  storyboard.scenes = [storyboard.scenes[0]];
  storyboard.project.durationFrames = storyboard.scenes[0].durationFrames;
  storyboard.project.durationSec = storyboard.project.durationFrames / storyboard.project.fps;
  fs.writeFileSync(path.join(project, 'storyboard.json'), JSON.stringify(storyboard));
  fs.writeFileSync(path.join(project, 'script.md'), `# Script\n\n## ${storyboard.scenes[0].id}\n\n${storyboard.scenes[0].narration}\n`);
  fs.writeFileSync(path.join(project, 'asset-manifest.json'), JSON.stringify({schemaVersion: '1.0', assets: []}));
  fs.writeFileSync(path.join(project, 'project-input.json'), JSON.stringify({schemaVersion: '1.0', inputMode: 'document'}));
  fs.writeFileSync(path.join(project, 'visual-handoff.json'), JSON.stringify({schemaVersion: '1.0', facecamRightFraction: 0.28, subtitleBottomFraction: 0.18, timelinePolicy: 'picture-locked'}));
  return {project, storyboard};
}

afterEach(() => {
  for (const directory of directories.splice(0)) fs.rmSync(directory, {recursive: true, force: true});
});

describe('video production purposes', () => {
  it('keeps delivery purpose separate from audio mode and rejects silent fallback', () => {
    expect(resolveOutputPurpose('visual-master', 'silent')).toBe('visual-master');
    expect(resolveOutputPurpose(undefined, 'silent')).toBe('visual-preview');
    expect(() => resolveOutputPurpose('in-project-video', 'silent')).toThrow(/不会回退为静音预览/);
    expect(() => resolveOutputPurpose('visual-master', 'tts')).toThrow(/必须使用 --audio-mode silent/);
  });

  it('validates the reserved facecam and subtitle regions', () => {
    const {project} = projectFixture();
    expect(loadHandoffConfig(project).facecamRightFraction).toBe(0.28);
    fs.writeFileSync(path.join(project, 'visual-handoff.json'), JSON.stringify({schemaVersion: '1.0', facecamRightFraction: 0.5, subtitleBottomFraction: 0.18, timelinePolicy: 'picture-locked'}));
    expect(() => loadHandoffConfig(project)).toThrow(/facecamRightFraction/);
  });

  it('does not invalidate a clean picture handoff when unrelated audio changes', () => {
    const {project} = projectFixture();
    const fingerprint = fingerprintProjectInputs(project, path.resolve('styles'), undefined, undefined, {includeAudio: false});
    const audioFingerprint = fingerprintProjectInputs(project, path.resolve('styles'));
    fs.writeFileSync(path.join(project, 'audio', 'new-recording.wav'), 'test fixture');
    expect(fingerprintProjectInputs(project, path.resolve('styles'), undefined, undefined, {includeAudio: false})).toBe(fingerprint);
    expect(fingerprintProjectInputs(project, path.resolve('styles'))).not.toBe(audioFingerprint);
  });

  it('exports a stable script checkpoint without creating an MP4', () => {
    const {project} = projectFixture();
    const result = prepareScriptHandoff(project, 'fast');
    expect(fs.readFileSync(result.markdownPath, 'utf8')).toContain('## opening');
    expect(fs.existsSync(path.join(project, 'output', 'preview-silent.mp4'))).toBe(false);
    expect(JSON.parse(fs.readFileSync(path.join(project, 'run.json'), 'utf8')).deliveryStatus).toBe('script-ready');
    fs.writeFileSync(path.join(project, 'script.md'), '# revised script\n');
    expect(() => prepareScriptHandoff(project, 'fast')).toThrow(/缺少镜头编号|不一致/);
  });

  it('invalidates review approval when script or overlay regions change', () => {
    const {project, storyboard} = projectFixture();
    storyboard.project.status = 'reviewed';
    fs.writeFileSync(path.join(project, 'storyboard.json'), JSON.stringify(storyboard));
    const reviewPath = path.join(project, 'review.json');
    fs.writeFileSync(reviewPath, JSON.stringify({reviewer: 'creator', notes: 'Checked the storyboard and safe zones.'}));
    approveStoryboard(project, reviewPath);
    expect(() => assertStoryboardApproval(project)).not.toThrow();
    fs.writeFileSync(path.join(project, 'visual-handoff.json'), JSON.stringify({schemaVersion: '1.0', facecamRightFraction: 0.25, subtitleBottomFraction: 0.18, timelinePolicy: 'picture-locked'}));
    expect(() => assertStoryboardApproval(project)).toThrow(/已变化/);
  });

  it('lists safe TTS summaries and requires a choice when more than one is enabled', () => {
    const {project} = projectFixture();
    const config = {schemaVersion: '1.0', enabled: true, provider: 'mock', voiceType: 'voice-a'};
    fs.writeFileSync(path.join(project, 'audio', 'tts-config.json'), JSON.stringify(config));
    fs.writeFileSync(path.join(project, 'audio', 'tts-config.alt.json'), JSON.stringify({...config, voiceType: 'voice-b'}));
    expect(listTtsProfiles(project).map((item) => item.voiceType).sort()).toEqual(['voice-a', 'voice-b']);
    expect(() => selectTtsProfile(project)).toThrow(/多个可用 TTS 配置/);
    expect(selectTtsProfile(project, path.join(project, 'audio', 'tts-config.alt.json')).voiceType).toBe('voice-b');
  });

  it('requires clean output QA and a complete visual review before handoff', () => {
    const run = {status: 'completed', deliveryStatus: 'visual-handoff-pending', outputPurpose: 'visual-master', stages: {qa: 'completed'}};
    const qa = {automatedPassed: true, mode: 'visual-master', checks: {output: {passed: true, audioStreams: 0}, visualMasterProfile: {passed: true}}};
    const review = {reviewer: 'creator', notes: 'Watched the full picture.', fullPlaybackPassed: true, visualHierarchyPassed: true, textReadabilityPassed: true, overlaySafeAreaPassed: true, assetRightsPassed: true};
    expect(checkVisualHandoffEligibility(run, qa, review)).toEqual([]);
    expect(checkVisualHandoffEligibility(run, qa, {...review, overlaySafeAreaPassed: false}).join(' ')).toContain('overlaySafeAreaPassed');
    expect(checkVisualHandoffEligibility(run, {...qa, checks: {...qa.checks, output: {passed: true, audioStreams: 1}}}, review).join(' ')).toContain('无音轨');
  });

  it('leaves no partial TTS package when measured speech exceeds the scene', () => {
    const {project} = projectFixture();
    fs.writeFileSync(path.join(project, 'audio', 'tts-config.json'), JSON.stringify({schemaVersion: '1.0', enabled: true, provider: 'mock', voiceType: 'test-tone', speedRatio: 0.5}));
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = spawnSync(process.execPath, ['--import', 'tsx/esm', 'scripts/synthesize-voiceover.mjs', project], {cwd: process.cwd(), encoding: 'utf8'});
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('超出 scene 可用时长');
      expect(result.stderr).not.toContain('输出文件已存在');
    }
    expect(fs.existsSync(path.join(project, 'audio', 'audio-config.tts.json'))).toBe(false);
    expect(fs.readdirSync(path.join(project, 'audio', 'generated'))).toEqual([]);
  });

  it('reuses only a complete TTS package for the same script, config and bytes', () => {
    const {project, storyboard} = projectFixture();
    storyboard.scenes[0].narration = '测试旁白。';
    fs.writeFileSync(path.join(project, 'storyboard.json'), JSON.stringify(storyboard));
    fs.writeFileSync(path.join(project, 'script.md'), '# Script\n\n## opening\n\n测试旁白。\n');
    fs.writeFileSync(path.join(project, 'audio', 'tts-config.json'), JSON.stringify({schemaVersion: '1.0', enabled: true, provider: 'mock', voiceType: 'test-tone'}));
    const command = (extra = []) => spawnSync(process.execPath, ['--import', 'tsx/esm', 'scripts/synthesize-voiceover.mjs', project, ...extra], {cwd: process.cwd(), encoding: 'utf8'});
    expect(command().status).toBe(0);
    expect(command(['--reuse']).stdout).toContain('VOICEOVER REUSED');
    fs.appendFileSync(path.join(project, 'audio', 'generated', 'opening.wav'), 'changed');
    expect(command(['--reuse']).stderr).toContain('不一致');
  });

  it('keeps a picture-locked master linked across a failed audio-return attempt', () => {
    const {project, storyboard} = projectFixture();
    const storyboardPath = path.join(project, 'storyboard.json');
    const handoffPath = path.join(project, 'output', 'visual-master-v001-review', 'handoff', 'visual-handoff.json');
    fs.mkdirSync(path.dirname(handoffPath), {recursive: true});
    fs.writeFileSync(handoffPath, JSON.stringify({storyboardFingerprint: fingerprintFiles([storyboardPath], project), timelinePolicy: 'picture-locked'}));
    fs.writeFileSync(path.join(project, 'run.json'), JSON.stringify({status: 'completed', outputPurpose: 'visual-master', stages: {storyboard: 'completed'}, artifacts: {video: 'output/visual-master-v001.mp4', visualHandoff: path.relative(project, handoffPath)}}));
    storyboard.project.title = 'Retimed picture version';
    fs.writeFileSync(storyboardPath, JSON.stringify(storyboard));
    expect(() => runProduction({projectPath: project, executionMode: 'fast', audioMode: 'external', outputPurpose: 'in-project-video'})).toThrow(/--retime-from-master/);
    expect(() => runProduction({projectPath: project, executionMode: 'fast', audioMode: 'external', outputPurpose: 'in-project-video', retimeFromMaster: true})).toThrow(/audio-config.json/);
    expect(JSON.parse(fs.readFileSync(path.join(project, 'run.json'), 'utf8')).sourceVisualMaster.video).toBe('output/visual-master-v001.mp4');
  });
});
