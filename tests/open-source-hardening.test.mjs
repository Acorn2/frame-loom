import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Buffer} from 'node:buffer';
import {spawnSync} from 'node:child_process';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {renderToVerifiedOutput} from '../scripts/lib/verified-render-output.mjs';
import {writeProductionLock} from '../scripts/lib/production-lock.mjs';
import {previewFingerprint, libraryPreviewFixtures} from '../scripts/lib/library-catalog.mjs';
import {fontPreviewFingerprint} from '../scripts/lib/font-previews.mjs';
import {AUDIO_LIMITS, assertAudioBudget} from '../scripts/lib/audio-limits.mjs';
import {loadAudioRuntime} from '../scripts/lib/audio-runtime.mjs';
import {inspectAudio} from '../scripts/inspect-audio.mjs';
import {outputBoundary} from '../scripts/lib/project-files.mjs';

vi.mock('node:child_process', async original => ({...await original(), spawnSync: vi.fn()}));
const directories = [];
const temp = () => {const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-loom-open-')); directories.push(dir); return dir;};
const profile = {purpose: 'visual-preview', showReviewMarker: true};
const sidecars = ['.production/production-lock.json', '.production/resolved-shot-plan.json', '.cover.png', '.cover.png.render.json'];
const put = (file, value) => {fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, value);};
const fill = async file => {for (const suffix of sidecars) put(`${file}${suffix}`, `new ${suffix}`);};
const render = async file => put(file, 'new video');
const verify = () => {};
afterEach(() => {vi.restoreAllMocks(); vi.mocked(spawnSync).mockReset(); for (const dir of directories.splice(0)) fs.rmSync(dir, {recursive: true, force: true});});

describe('complete render publication', () => {
  it.each(['existing', 'new'])('publishes a complete render through an external directory alias with %s output directories', async kind => {
    const root = temp(), outside = temp(), project = temp(), alias = path.join(root, 'tmp');
    fs.symlinkSync(outside, alias, 'junction');
    const outputPath = path.join(alias, ...(kind === 'new' ? ['new', 'nested'] : []), 'video.mp4');
    await renderToVerifiedOutput({outputPath, outputRoot: outputBoundary(outputPath, project), profile, render, verify,
      artifactSuffixes: sidecars, prepareArtifacts: fill});
    expect(fs.readFileSync(outputPath, 'utf8')).toBe('new video');
    expect(fs.existsSync(`${outputPath}.render.json`)).toBe(true);
    for (const suffix of sidecars) expect(fs.readFileSync(`${outputPath}${suffix}`, 'utf8')).toBe(`new ${suffix}`);
  });
  it.each(['directory', 'file', 'dangling'])('rejects %s symlinks in production sidecars before writing', kind => {
    const root = temp(), outside = temp(), production = path.join(root, 'candidate.mp4.production');
    const canary = path.join(outside, 'production-lock.json');
    if (kind !== 'dangling') put(canary, 'keep');
    if (kind === 'directory') fs.symlinkSync(outside, production);
    else {fs.mkdirSync(production); fs.symlinkSync(canary, path.join(production, 'production-lock.json'));}
    expect(() => writeProductionLock({}, production, {lock: {}, plans: []})).toThrow(/符号链接/);
    expect(fs.existsSync(canary)).toBe(kind !== 'dangling');
    if (kind !== 'dangling') expect(fs.readFileSync(canary, 'utf8')).toBe('keep');
  });
  it('rejects an output directory alias within a project before rendering', async () => {
    const root = temp(), outside = temp(), draw = vi.fn(); fs.symlinkSync(outside, path.join(root, 'output'));
    const outputPath = path.join(root, 'output/video.mp4');
    await expect(renderToVerifiedOutput({outputPath, outputRoot: outputBoundary(outputPath, root), profile, render: draw, verify})).rejects.toThrow(/符号链接/);
    expect(draw).not.toHaveBeenCalled();
  });
  it.each(['live', 'dangling'])('rejects %s artifact links beneath an external directory alias', async kind => {
    const root = temp(), outside = temp(), draw = vi.fn(), alias = path.join(root, 'tmp'), victim = path.join(root, 'victim.mp4');
    fs.symlinkSync(outside, alias, 'junction');
    if (kind === 'live') put(victim, 'keep');
    const outputPath = path.join(alias, 'video.mp4'); fs.symlinkSync(victim, outputPath);
    await expect(renderToVerifiedOutput({outputPath, force: true, profile, render: draw, verify})).rejects.toThrow(/符号链接/);
    expect(draw).not.toHaveBeenCalled();
    expect(fs.existsSync(victim)).toBe(kind === 'live');
    if (kind === 'live') expect(fs.readFileSync(victim, 'utf8')).toBe('keep');
  });
  it('leaves every old artifact intact when cover preparation fails', async () => {
    const outputPath = path.join(temp(), 'video.mp4'), suffixes = ['', '.render.json', ...sidecars];
    for (const suffix of suffixes) put(`${outputPath}${suffix}`, `old ${suffix}`);
    await expect(renderToVerifiedOutput({outputPath, force: true, profile, render, verify, artifactSuffixes: sidecars,
      prepareArtifacts: async file => {await fill(file); throw new Error('cover failed');}})).rejects.toThrow('cover failed');
    for (const suffix of suffixes) expect(fs.readFileSync(`${outputPath}${suffix}`, 'utf8')).toBe(`old ${suffix}`);
  });
  it('rolls back every artifact after a late publication failure and can retry', async () => {
    const outputPath = path.join(temp(), 'video.mp4'), suffixes = ['', '.render.json', ...sidecars];
    for (const suffix of suffixes) put(`${outputPath}${suffix}`, `old ${suffix}`);
    const link = fs.linkSync;
    vi.spyOn(fs, 'linkSync').mockImplementation((source, target) => {
      if (target === `${outputPath}.cover.png.render.json` && !path.basename(source).startsWith('previous-')) throw new Error('late failure');
      return link(source, target);
    });
    const options = {outputPath, force: true, profile, render, verify, artifactSuffixes: sidecars, prepareArtifacts: fill};
    await expect(renderToVerifiedOutput(options)).rejects.toThrow('late failure');
    for (const suffix of suffixes) expect(fs.readFileSync(`${outputPath}${suffix}`, 'utf8')).toBe(`old ${suffix}`);
    vi.restoreAllMocks(); await renderToVerifiedOutput(options);
    expect(fs.readFileSync(outputPath, 'utf8')).toBe('new video');
    for (const suffix of sidecars) expect(fs.readFileSync(`${outputPath}${suffix}`, 'utf8')).toBe(`new ${suffix}`);
  });
  it('preserves a failed rollback and blocks forced retries', async () => {
    const root = temp(), outputPath = path.join(root, 'video.mp4'); put(outputPath, 'old');
    const link = fs.linkSync;
    vi.spyOn(fs, 'linkSync').mockImplementation((source, target) => {
      if (target === `${outputPath}.render.json` || path.basename(source).startsWith('previous-')) throw new Error('failure');
      return link(source, target);
    });
    await expect(renderToVerifiedOutput({outputPath, force: true, profile, render, verify})).rejects.toThrow(/回退文件保留/);
    vi.restoreAllMocks();
    const stage = path.join(root, fs.readdirSync(root).find(name => name.startsWith('.video.mp4-render-')));
    const marker = JSON.parse(fs.readFileSync(path.join(stage, 'owner.json')));
    expect(fs.readFileSync(marker.entries[0].backup, 'utf8')).toBe('old');
    // Emulate an exited owner without altering the retained recovery evidence.
    marker.pid = 99999999; put(path.join(stage, 'owner.json'), JSON.stringify(marker));
    await expect(renderToVerifiedOutput({outputPath, force: true, profile, render, verify})).rejects.toThrow(/未完成的发布事务/);
    expect(fs.existsSync(stage)).toBe(true);
  });
  it('does not overwrite output modified while rendering, even with force', async () => {
    const outputPath = path.join(temp(), 'video.mp4'); put(outputPath, 'old');
    await expect(renderToVerifiedOutput({outputPath, force: true, profile, verify,
      render: async file => {await render(file); put(outputPath, 'other process');}})).rejects.toThrow(/渲染期间变化/);
    expect(fs.readFileSync(outputPath, 'utf8')).toBe('other process');
  });
});

describe('public preview freshness', () => {
  it.each(['fonts/font-index.json', 'scripts/lib/layout-qa.mjs', 'public/fonts'])('invalidates both preview routes for %s changes', candidate => {
    let file = path.resolve(candidate);
    if (candidate === 'public/fonts') {
      const walk = dir => fs.readdirSync(dir, {withFileTypes:true}).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
      file = walk(file).find(name => /\.(woff2|ttf|otf)$/u.test(name));
    }
    const before = [previewFingerprint(), fontPreviewFingerprint()], read = fs.readFileSync;
    vi.spyOn(fs, 'readFileSync').mockImplementation((name, ...args) => {
      const value = read(name, ...args);
      return typeof name === 'string' && path.resolve(name) === file ? (typeof value === 'string' ? `${value}\n` : Buffer.concat([value, Buffer.from('\n')])) : value;
    });
    expect(previewFingerprint()).not.toBe(before[0]); expect(fontPreviewFingerprint()).not.toBe(before[1]);
  });
  it('includes every public recipe source in both Pages trigger filters', () => {
    const yaml = fs.readFileSync('.github/workflows/library-pages.yml', 'utf8');
    for (const section of [yaml.split('  pull_request:')[0], yaml.split('  pull_request:')[1].split('  workflow_dispatch:')[0]]) {
      const patterns = [...section.matchAll(/- '([^']+)'/gu)].map(match => match[1]);
      for (const fixture of libraryPreviewFixtures()) expect(patterns.some(pattern => path.matchesGlob(fixture.source, pattern)), fixture.source).toBe(true);
    }
  });
});

function audioProject() {
  const root = temp(), configPath = path.join(root, 'audio-config.json'); put(path.join(root, 'voice.wav'), 'fixture');
  const config = {schemaVersion: '1.0', voiceover: {enabled: true, path: 'voice.wav', volume: 1, source: 'test', license: 'test'}};
  put(configPath, JSON.stringify(config)); return {root, config, configPath};
}
describe('external audio limits', () => {
  it('rejects oversized files before probing or loading bytes', () => {
    const {root, configPath} = audioProject(); fs.truncateSync(path.join(root, 'voice.wav'), AUDIO_LIMITS.fileBytes + 1);
    expect(() => inspectAudio('examples/article-video/storyboard.json', configPath)).toThrow(/字节/);
    expect(() => loadAudioRuntime(configPath)).toThrow(/字节/); expect(spawnSync).not.toHaveBeenCalled();
  });
  it('counts repeated audio uses in the aggregate budget and caps captions/tracks', () => {
    const {root, config} = audioProject(); fs.truncateSync(path.join(root, 'voice.wav'), AUDIO_LIMITS.fileBytes);
    expect(() => assertAudioBudget({...config, sfx: [config.voiceover, config.voiceover]}, root)).toThrow(/总量/);
    expect(() => assertAudioBudget({...config, sfx: Array(64).fill(config.voiceover)}, root)).toThrow(/音轨/);
    put(path.join(root, 'captions.srt'), 'x'); fs.truncateSync(path.join(root, 'captions.srt'), AUDIO_LIMITS.captionBytes + 1);
    expect(() => assertAudioBudget({...config, captions: {enabled: true, path: 'captions.srt'}}, root)).toThrow(/字节/);
  });
  it.each(['probe', 'loudness'])('terminates a stuck %s subprocess with a bounded timeout', stage => {
    const {configPath} = audioProject();
    if (stage === 'loudness') vi.mocked(spawnSync).mockReturnValueOnce({status: 0, stdout: JSON.stringify({format: {duration: 20}})});
    vi.mocked(spawnSync).mockReturnValue({error: {code: 'ETIMEDOUT'}, status: null});
    expect(() => inspectAudio('examples/article-video/storyboard.json', configPath)).toThrow(/超时/);
    expect(spawnSync.mock.calls.at(-1)[2]).toMatchObject({timeout: stage === 'probe' ? 10000 : 120000, killSignal: 'SIGKILL'});
  });
  it('rejects excessive duration before the full loudness pass', () => {
    const {configPath} = audioProject();
    vi.mocked(spawnSync).mockReturnValue({status: 0, stdout: JSON.stringify({format: {duration: 3601}})});
    expect(() => inspectAudio('examples/article-video/storyboard.json', configPath)).toThrow(/3600 秒/);
    expect(spawnSync).toHaveBeenCalledTimes(1);
  });
});
