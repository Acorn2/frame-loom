import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {acquireProjectLock, assertProjectOutput, assertNoPendingAudioPublication, publishAudioFiles, writeProjectJson} from '../scripts/lib/project-files.mjs';
import {main as synthesizeVoiceover} from '../scripts/synthesize-voiceover.mjs';
import {readBoundedResponse} from '../scripts/lib/bounded-response.mjs';
import {createReviewTemplate, reviewFingerprintIssues} from '../scripts/lib/manual-review.mjs';
import {checkDeliveryEligibility} from '../scripts/approve-delivery.mjs';
import {checkStoryboardInput} from '../scripts/lib/preflight.mjs';
import {initProject} from '../scripts/init-project.mjs';
const directories = [];
const temp = () => {const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-loom-hardening-')); directories.push(dir); return dir;};
afterEach(() => {vi.restoreAllMocks(); for (const dir of directories.splice(0)) fs.rmSync(dir, {recursive: true, force: true});});
const json = (file, value) => fs.writeFileSync(file, JSON.stringify(value));
function project() {
  const root = temp(); fs.mkdirSync(path.join(root, 'audio'));
  const board = JSON.parse(fs.readFileSync('examples/article-video/storyboard.json'));
  board.scenes = [board.scenes[0]]; board.scenes[0].narration = '测试'; board.scenes[0].durationFrames = 600;
  Object.assign(board.project, {durationFrames: 600, durationSec: 20});
  json(path.join(root, 'storyboard.json'), board);
  json(path.join(root, 'audio/tts-config.json'), {schemaVersion: '1.0', enabled: true, provider: 'mock', format: 'wav', voiceType: 'test'});
  return root;
}

describe('project artifact boundaries', () => {
  it('rejects live, dangling and parent links without touching outside files, including force', async () => {
    const outside = temp(), root = project(), target = path.join(root, 'audio/audio-config.tts.json');
    const victim = path.join(outside, 'victim.json'); fs.writeFileSync(victim, 'keep');
    fs.symlinkSync(victim, target);
    await expect(synthesizeVoiceover({projectPath: root, force: true})).rejects.toThrow(/符号链接/);
    expect(fs.readFileSync(victim, 'utf8')).toBe('keep'); fs.unlinkSync(target);
    const missing = path.join(outside, 'missing.json'); fs.symlinkSync(missing, target);
    await expect(synthesizeVoiceover({projectPath: root})).rejects.toThrow(/符号链接/);
    expect(fs.existsSync(missing)).toBe(false);
    fs.symlinkSync(outside, path.join(root, 'alias'), 'junction');
    expect(() => writeProjectJson(root, path.join(root, 'alias/new.json'), {})).toThrow(/符号链接/);
    expect(() => assertProjectOutput(root, victim)).toThrow(/项目内/);
  });
  it('publishes JSON exclusively and leaves prior bytes intact', () => {
    const root = temp(), file = path.join(root, 'record.json');
    writeProjectJson(root, file, {version: 1}, {overwrite: false});
    expect(() => writeProjectJson(root, file, {version: 2}, {overwrite: false})).toThrow();
    expect(JSON.parse(fs.readFileSync(file))).toEqual({version: 1});
  });
  it('holds an exclusive lock across processes and releases it normally', () => {
    const root = temp(), release = acquireProjectLock(root, 'tts');
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', "import {acquireProjectLock} from './scripts/lib/project-files.mjs'; acquireProjectLock(process.argv[1], 'tts');", root], {encoding: 'utf8'});
    expect(child.status).not.toBe(0); expect(child.stderr).toContain('已加锁');
    release(); acquireProjectLock(root, 'tts')();
  });
});

describe('TTS package publication', () => {
  it('restores every old file after a publication failure', () => {
    const root = temp();
    const entries = ['voice.wav', 'captions.srt', 'manifest.json'].map(name => {
      const source = path.join(root, `new-${name}`), target = path.join(root, name);
      fs.writeFileSync(source, `new ${name}`); fs.writeFileSync(target, `old ${name}`); return {source, target};
    });
    const original = fs.linkSync;
    vi.spyOn(fs, 'linkSync').mockImplementation((source, target) => {
      if (target === entries[1].target) throw new Error('injected publication failure');
      return original(source, target);
    });
    expect(() => publishAudioFiles(root, entries, {force: true})).toThrow(/injected/);
    for (const {target} of entries) expect(fs.readFileSync(target, 'utf8')).toBe(`old ${path.basename(target)}`);
    expect(fs.readdirSync(root).some(name => name.startsWith('.audio-'))).toBe(false);
  });
  it('does not overwrite a file that appears after preflight without force', () => {
    const root = temp(), source = path.join(root, 'source'), target = path.join(root, 'target'); fs.writeFileSync(source, 'new');
    const original = fs.linkSync;
    vi.spyOn(fs, 'linkSync').mockImplementation((from, to) => {if (to === target) fs.writeFileSync(target, 'concurrent'); return original(from, to);});
    expect(() => publishAudioFiles(root, [{source, target}])).toThrow();
    expect(fs.readFileSync(target, 'utf8')).toBe('concurrent');
  });
  it('preserves backups and blocks retries when rollback itself fails', () => {
    const root = temp(), source = path.join(root, 'new'), target = path.join(root, 'old');
    fs.writeFileSync(source, 'new bytes'); fs.writeFileSync(target, 'old bytes');
    const rename = fs.renameSync;
    vi.spyOn(fs, 'linkSync').mockImplementation((from, to) => {
      if (to === target) throw new Error('publication failure');
      // The journal uses an exclusive hard link too.
      fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL);
    });
    vi.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
      if (path.basename(path.dirname(from)).startsWith('.audio-backup-')) throw new Error('rollback failure');
      return rename(from, to);
    });
    expect(() => publishAudioFiles(root, [{source, target}], {force: true})).toThrow(/回退失败/);
    const journal = JSON.parse(fs.readFileSync(path.join(root, '.audio-publication.json')));
    expect(fs.readFileSync(journal.entries[0].backup, 'utf8')).toBe('old bytes');
    expect(() => assertNoPendingAudioPublication(root)).toThrow(/未完成/);
  });
  it('rejects a second synthesis and reuses a completely published package', async () => {
    const root = project(), pending = synthesizeVoiceover({projectPath: root});
    await expect(synthesizeVoiceover({projectPath: root})).rejects.toThrow(/已加锁/);
    const result = await pending;
    expect((await synthesizeVoiceover({projectPath: root, reuse: true})).manifest.artifactFingerprint).toBe(result.manifest.artifactFingerprint);
  });
  it('rejects input changes during synthesis and leaves the output unpublished', async () => {
    const root = project(), pending = synthesizeVoiceover({projectPath: root});
    const file = path.join(root, 'storyboard.json'), board = JSON.parse(fs.readFileSync(file));
    board.scenes[0].narration = 'changed'; json(file, board);
    await expect(pending).rejects.toThrow(/合成期间变化/);
    expect(fs.existsSync(path.join(root, 'audio/audio-manifest.json'))).toBe(false);
    expect(fs.existsSync(path.join(root, '.frame-loom-tts.lock'))).toBe(false);
  });
});

describe('review and resource boundaries', () => {
  it('binds a blank review to one candidate and rejects stale or missing bindings', () => {
    const run = {status: 'completed', stages: {qa: 'completed'}, audioModeResolved: 'external', outputPurpose: 'in-project-video', inputFingerprint: 'a'.repeat(64), outputFingerprint: 'b'.repeat(64)};
    const review = createReviewTemplate(run);
    expect(review.fullPlaybackPassed).toBe(false); expect(reviewFingerprintIssues(run, review)).toEqual([]);
    const qa = {automatedPassed: true, mode: 'audio-pilot', checks: {output: {passed: true, audioStreams: 1}, audio: {passed: true}, narratedRenderProfile: {passed: true}}};
    const completed = Object.fromEntries(Object.entries(review).map(([key, value]) => [key, typeof value === 'boolean' ? true : value]));
    Object.assign(completed, {reviewer: 'fixture', notes: 'Watched this candidate'});
    expect(checkDeliveryEligibility(run, qa, completed)).toEqual([]);
    expect(checkDeliveryEligibility({...run, outputFingerprint: 'c'.repeat(64)}, qa, completed).join(' ')).toContain('outputFingerprint');
    delete completed.inputFingerprint; expect(checkDeliveryEligibility(run, qa, completed).join(' ')).toContain('inputFingerprint');
  });
  it('rejects enormous canvases before rendering', () => {
    const file = path.resolve('examples/article-video/storyboard.json'), board = JSON.parse(fs.readFileSync(file));
    board.project.width = 100000; board.project.height = 100000;
    expect(checkStoryboardInput(board, {storyboardPath: file, styleRoot: path.resolve('styles'), executionMode: 'fast'}).filter(issue => issue.severity === 'error').length).toBeGreaterThan(0);
  });
  it('bounds streamed responses even without content-length and cancels excess data', async () => {
    const cancel = vi.fn();
    const body = new globalThis.ReadableStream({pull(controller) {controller.enqueue(new Uint8Array(8));}, cancel});
    await expect(readBoundedResponse(new globalThis.Response(body), 12)).rejects.toThrow(/字节上限/);
    expect(cancel).toHaveBeenCalled();
    expect((await readBoundedResponse(new globalThis.Response(new Uint8Array(8)), 12)).length).toBe(8);
  });
  it('keeps generated briefs consistent with the selected illustration policy', () => {
    const root = temp();
    for (const style of ['whiteboard', 'annotated-reasoning', 'editorial-typography', 'retro-zine']) {
      const dir = initProject(['--slug', style, '--style', style, '--projects-dir', root]);
      const input = JSON.parse(fs.readFileSync(path.join(dir, 'project-input.json'))), brief = fs.readFileSync(path.join(dir, 'production-brief.md'), 'utf8');
      if (input.illustrationPolicy) {expect(brief).toContain('generated-subjects-v1'); expect(brief).not.toContain('no images are required');}
      else expect(brief).toContain('no images are required');
    }
  });
});
