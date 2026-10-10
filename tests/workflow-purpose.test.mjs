import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {loadHandoffConfig, resolveOutputPurpose} from '../scripts/lib/output-purpose.mjs';
import {listTtsProfiles, selectTtsProfile} from '../scripts/lib/tts-profiles.mjs';
import {approveStoryboard} from '../scripts/approve-storyboard.mjs';
import {assertStoryboardApproval, storyboardApprovalFingerprint} from '../scripts/lib/storyboard-approval.mjs';
import {prepareScriptHandoff} from '../scripts/prepare-script-handoff.mjs';
import {checkVisualHandoffEligibility} from '../scripts/approve-visual-handoff.mjs';
import {fingerprintFiles, fingerprintProjectInputs, fingerprintTtsConfig} from '../scripts/lib/input-fingerprint.mjs';
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
  vi.unstubAllEnvs();
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

  it('invalidates approval and delivery inputs when an external manifest asset changes', () => {
    const {project, storyboard} = projectFixture();
    const external = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-loom-asset-'));
    directories.push(external);
    const assetPath = path.join(external, 'visual.svg');
    fs.writeFileSync(assetPath, '<svg xmlns="http://www.w3.org/2000/svg"/>');
    fs.writeFileSync(path.join(project, 'asset-manifest.json'), JSON.stringify({schemaVersion: '1.0', assets: [{id: 'visual', path: assetPath, type: 'image', source: 'test fixture', license: 'MIT', intendedUse: 'review fingerprint'}]}));
    storyboard.project.status = 'reviewed';
    fs.writeFileSync(path.join(project, 'storyboard.json'), JSON.stringify(storyboard));
    const reviewPath = path.join(project, 'review.json');
    fs.writeFileSync(reviewPath, JSON.stringify({reviewer: 'creator', notes: 'Reviewed the referenced image.'}));
    approveStoryboard(project, reviewPath);
    expect(() => assertStoryboardApproval(project)).not.toThrow();
    const fingerprint = fingerprintProjectInputs(project, path.resolve('styles'), undefined, undefined, {includeAudio: false});
    fs.writeFileSync(assetPath, '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>');
    expect(() => assertStoryboardApproval(project)).toThrow(/已变化/);
    expect(fingerprintProjectInputs(project, path.resolve('styles'), undefined, undefined, {includeAudio: false})).not.toBe(fingerprint);
  });

  it('rejects a non-file manifest asset before fingerprinting it', () => {
    const {project} = projectFixture();
    const external = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-loom-invalid-asset-'));
    directories.push(external);
    fs.writeFileSync(path.join(project, 'asset-manifest.json'), JSON.stringify({schemaVersion: '1.0', assets: [{id: 'invalid', path: external, type: 'image', source: 'test fixture', license: 'MIT', intendedUse: 'invalid asset'}]}));
    expect(() => storyboardApprovalFingerprint(project)).toThrow(/指纹输入必须是普通文件/);
  });

  it('requires the same approval for a direct review render', () => {
    const {project, storyboard} = projectFixture();
    storyboard.project.status = 'reviewed';
    fs.writeFileSync(path.join(project, 'storyboard.json'), JSON.stringify(storyboard));
    const result = spawnSync(process.execPath, ['--import', 'tsx/esm', 'scripts/render-storyboard.mjs', path.join(project, 'storyboard.json'), path.join(project, 'output', 'preview.mp4'), '--mode', 'review'], {cwd: process.cwd(), encoding: 'utf8'});
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('storyboard-approval.json');
    expect(result.stdout).not.toContain('Bundling');
  });

  it('does not apply a project approval to a different storyboard file', () => {
    const {project, storyboard} = projectFixture();
    storyboard.project.status = 'reviewed';
    fs.writeFileSync(path.join(project, 'storyboard.json'), JSON.stringify(storyboard));
    const reviewPath = path.join(project, 'review.json');
    fs.writeFileSync(reviewPath, JSON.stringify({reviewer: 'creator', notes: 'Reviewed storyboard.json.'}));
    approveStoryboard(project, reviewPath);
    storyboard.project.title = 'Unreviewed alternate';
    const alternatePath = path.join(project, 'storyboard-alternate.json');
    fs.writeFileSync(alternatePath, JSON.stringify(storyboard));
    const result = spawnSync(process.execPath, ['--import', 'tsx/esm', 'scripts/render-storyboard.mjs', alternatePath, path.join(project, 'output', 'preview.mp4'), '--mode', 'review'], {cwd: process.cwd(), encoding: 'utf8'});
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('只能渲染当前项目已审核的 storyboard.json');
    expect(result.stdout).not.toContain('Bundling');
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

  it('tracks a TTS speaker supplied by an environment variable in reuse fingerprints', () => {
    const {project} = projectFixture();
    const configPath = path.join(project, 'audio', 'tts-config.json');
    fs.writeFileSync(configPath, JSON.stringify({schemaVersion: '1.0', enabled: true, provider: 'doubao', voiceTypeEnv: 'VOLC_TTS_SPEAKER', endpoint: 'https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse', apiVersion: 'v3'}));
    vi.stubEnv('VOLC_TTS_API_KEY', 'test-key');
    vi.stubEnv('VOLC_TTS_RESOURCE_ID', 'test-resource');
    vi.stubEnv('VOLC_TTS_SPEAKER', 'voice-a');
    expect(selectTtsProfile(project).voiceType).toBe('voice-a');
    const configFingerprint = fingerprintTtsConfig(configPath, project);
    const projectFingerprint = fingerprintProjectInputs(project, path.resolve('styles'), undefined, configPath);

    vi.stubEnv('VOLC_TTS_SPEAKER', 'voice-b');
    expect(selectTtsProfile(project).voiceType).toBe('voice-b');
    expect(fingerprintTtsConfig(configPath, project)).not.toBe(configFingerprint);
    expect(fingerprintProjectInputs(project, path.resolve('styles'), undefined, configPath)).not.toBe(projectFingerprint);

    vi.stubEnv('VOLC_TTS_SPEAKER', '');
    expect(() => selectTtsProfile(project)).toThrow(/VOLC_TTS_SPEAKER/);
    expect(() => selectTtsProfile(project, configPath)).toThrow(/VOLC_TTS_SPEAKER/);
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
      if (attempt > 0) expect(result.stdout).toContain('VOICE CACHE HIT');
    }
    expect(fs.existsSync(path.join(project, 'audio', 'audio-config.tts.json'))).toBe(false);
    expect(fs.readdirSync(path.join(project, 'audio', 'generated'))).toEqual([]);
  });

  it('rejects TTS output paths outside audio, including symlink escapes', () => {
    const {project, storyboard} = projectFixture();
    storyboard.scenes[0].narration = '测试旁白。';
    fs.writeFileSync(path.join(project, 'storyboard.json'), JSON.stringify(storyboard));
    const configPath = path.join(project, 'audio', 'tts-config.json');
    const command = () => spawnSync(process.execPath, ['--import', 'tsx/esm', 'scripts/synthesize-voiceover.mjs', project], {cwd: process.cwd(), encoding: 'utf8'});
    fs.writeFileSync(configPath, JSON.stringify({schemaVersion: '1.0', enabled: true, provider: 'mock', voiceType: 'test-tone', outputDirectory: '../outside'}));
    expect(command().stderr).toContain('必须位于项目的 audio/ 目录内');
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-loom-outside-'));
    directories.push(outside);
    fs.symlinkSync(outside, path.join(project, 'audio', 'generated'));
    fs.writeFileSync(configPath, JSON.stringify({schemaVersion: '1.0', enabled: true, provider: 'mock', voiceType: 'test-tone'}));
    expect(command().stderr).toContain('符号链接');
    expect(fs.readdirSync(outside)).toEqual([]);
  });

  it('rejects TTS audio filenames that collide on case-insensitive file systems', () => {
    const {project, storyboard} = projectFixture();
    const configPath = path.join(project, 'audio', 'tts-config.json');
    fs.writeFileSync(configPath, JSON.stringify({schemaVersion: '1.0', enabled: true, provider: 'mock', voiceType: 'test-tone'}));
    const command = () => spawnSync(process.execPath, ['--import', 'tsx/esm', 'scripts/synthesize-voiceover.mjs', project], {cwd: process.cwd(), encoding: 'utf8'});
    storyboard.scenes[0].id = 'Voiceover';
    fs.writeFileSync(path.join(project, 'storyboard.json'), JSON.stringify(storyboard));
    expect(command().stderr).toContain('不能是 voiceover');
    storyboard.scenes[0].id = 'Opening';
    storyboard.scenes.push({...structuredClone(storyboard.scenes[0]), id: 'opening'});
    storyboard.project.durationFrames *= 2;
    storyboard.project.durationSec *= 2;
    fs.writeFileSync(path.join(project, 'storyboard.json'), JSON.stringify(storyboard));
    expect(command().stderr).toContain('不能仅以大小写区分');
    expect(fs.existsSync(path.join(project, 'audio', 'generated'))).toBe(false);
  });

  it('reuses only a complete TTS package for the same script, config and bytes', () => {
    const {project, storyboard} = projectFixture();
    storyboard.scenes[0].narration = '测试旁白。';
    fs.writeFileSync(path.join(project, 'storyboard.json'), JSON.stringify(storyboard));
    fs.writeFileSync(path.join(project, 'script.md'), '# Script\n\n## opening\n\n测试旁白。\n');
    fs.writeFileSync(path.join(project, 'audio', 'tts-config.json'), JSON.stringify({schemaVersion: '1.0', enabled: true, provider: 'mock', voiceTypeEnv: 'TEST_TTS_SPEAKER'}));
    const command = (extra = [], speaker = 'test-tone') => spawnSync(process.execPath, ['--import', 'tsx/esm', 'scripts/synthesize-voiceover.mjs', project, ...extra], {cwd: process.cwd(), encoding: 'utf8', env: {...process.env, TEST_TTS_SPEAKER: speaker}});
    expect(command().status).toBe(0);
    expect(command(['--reuse']).stdout).toContain('VOICEOVER REUSED');
    expect(command(['--reuse'], 'different-tone').stderr).toContain('不一致');
    fs.appendFileSync(path.join(project, 'audio', 'generated', 'opening.wav'), 'changed');
    expect(command(['--reuse']).stderr).toContain('不一致');
  });

  it('rejects reused speech when a scene shrinks without moving its start time', () => {
    const {project, storyboard} = projectFixture();
    storyboard.scenes[0].narration = '测试旁白测试旁白。';
    storyboard.scenes.push({...structuredClone(sourceStoryboard.scenes[1]), narration: '', transitionIn: {type: 'overlap-fade', durationFrames: 120}});
    storyboard.project.durationFrames = 195;
    storyboard.project.durationSec = 195 / storyboard.project.fps;
    const storyboardPath = path.join(project, 'storyboard.json');
    fs.writeFileSync(storyboardPath, JSON.stringify(storyboard));
    fs.writeFileSync(path.join(project, 'audio', 'tts-config.json'), JSON.stringify({schemaVersion: '1.0', enabled: true, provider: 'mock', voiceType: 'test-tone'}));
    const command = (extra = []) => spawnSync(process.execPath, ['--import', 'tsx/esm', 'scripts/synthesize-voiceover.mjs', project, ...extra], {cwd: process.cwd(), encoding: 'utf8'});
    expect(command().status).toBe(0);
    storyboard.scenes[0].durationFrames = 45;
    storyboard.scenes[1].transitionIn.durationFrames = 30;
    fs.writeFileSync(storyboardPath, JSON.stringify(storyboard));
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
