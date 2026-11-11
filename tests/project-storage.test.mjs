import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Buffer} from 'node:buffer';
import {spawnSync} from 'node:child_process';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {inspectProjectStorage} from '../scripts/lib/project-storage.mjs';
import {archiveRevision} from '../scripts/archive-revision.mjs';
import {extractReviewFrames} from '../scripts/extract-review-frames.mjs';

const directories = [];
const temp = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-loom-storage-'));
  directories.push(root);
  return root;
};
const write = (root, name, value) => {
  fs.mkdirSync(path.dirname(path.join(root, name)), {recursive: true});
  fs.writeFileSync(path.join(root, name), typeof value === 'object' && !Buffer.isBuffer(value) ? JSON.stringify(value) : value);
};
afterEach(() => {
  vi.restoreAllMocks();
  for (const root of directories.splice(0)) fs.rmSync(root, {recursive: true, force: true});
});
const hasFfmpeg = spawnSync('ffmpeg', ['-version'], {stdio: 'ignore'}).status === 0;

describe('project artifact lifecycle', () => {
  it('measures duplicate bytes and previews cache cleanup without mutating or following links', () => {
    const root = temp(), outside = temp();
    write(root, 'source/source.md', 'original');
    write(root, '.cache/scenes/a.mp4', 'same bytes');
    write(root, 'output/a.mp4', 'same bytes');
    write(outside, 'private.txt', 'outside content');
    fs.symlinkSync(outside, path.join(root, 'external'));
    const before = fs.readdirSync(root);
    const result = inspectProjectStorage(root, {duplicates: true});
    expect(result.redundantBytes).toBe(10);
    expect(result.fileCount).toBe(4);
    expect(result.cleanupPreview).toMatchObject({applied: false, cacheFiles: [{path: '.cache/scenes/a.mp4', bytes: 10}]});
    expect(result.duplicates[0].paths.sort()).toEqual(['.cache/scenes/a.mp4', 'output/a.mp4']);
    expect(fs.readdirSync(root)).toEqual(before);
    expect(fs.readFileSync(path.join(root, '.cache/scenes/a.mp4'), 'utf8')).toBe('same bytes');
  });

  function project() {
    const root = temp();
    write(root, 'storyboard.json', {project: {title: 'original'}});
    write(root, 'script.md', 'original script');
    write(root, 'assets/subject.png', 'original asset');
    write(root, 'source/source.md', 'original source');
    write(root, 'audio/generated/voice.mp3', 'original audio');
    write(root, '.cache/scenes/unused.mp4', Buffer.alloc(1024 * 1024));
    write(root, 'output/candidate.mp4', 'original video');
    write(root, 'output/candidate.mp4.render.json', {fingerprint: 'original receipt'});
    write(root, 'output/candidate.mp4.production/production-lock.json', {hash: 'original lock'});
    write(root, 'output/candidate-review/frame-01.png', Buffer.alloc(4 * 1024 * 1024));
    write(root, 'output/candidate-review/contact-sheet.png', 'original contact sheet');
    write(root, 'output/candidate-review/qa-report.json', {automatedPassed: true});
    write(root, 'output/candidate-review/review-frames.json', {video: path.join(root, 'output/candidate.mp4'), frames: [{label: 'scene-complete', timeSec: 1, file: 'frame-01.png'}], contactSheet: 'contact-sheet.png', contactSheets: ['contact-sheet.png']});
    write(root, 'output/manual-review.json', {watchedFullVideo: false});
    write(root, 'output/unrelated-old.mp4', Buffer.alloc(2 * 1024 * 1024));
    write(root, 'run.json', {status: 'completed', artifacts: {video: 'output/candidate.mp4', reviewDir: 'output/candidate-review', qaReport: 'output/candidate-review/qa-report.json'}});
    return root;
  }

  it('archives current inputs and evidence once while recording omitted video-derived frames', () => {
    const root = project();
    const result = archiveRevision(root, 'before-edit');
    const saved = name => path.join(result.directory, name);
    expect(fs.readFileSync(saved('assets/subject.png'), 'utf8')).toBe('original asset');
    expect(fs.readFileSync(saved('audio/generated/voice.mp3'), 'utf8')).toBe('original audio');
    expect(fs.readFileSync(saved('output/candidate.mp4'), 'utf8')).toBe('original video');
    expect(fs.existsSync(saved('output/candidate.mp4.production/production-lock.json'))).toBe(true);
    expect(fs.existsSync(saved('output/manual-review.json'))).toBe(true);
    expect(fs.existsSync(saved('output/candidate-review/contact-sheet.png'))).toBe(true);
    expect(fs.existsSync(saved('output/candidate-review/frame-01.png'))).toBe(false);
    expect(fs.existsSync(saved('output/unrelated-old.mp4'))).toBe(false);
    expect(fs.existsSync(saved('.cache'))).toBe(false);
    expect(result.manifest.omittedDerived).toMatchObject([{path: 'output/candidate-review/frame-01.png', bytes: 4 * 1024 * 1024}]);
    expect(result.manifest.totalBytes).toBeLessThan(20000);
    expect(result.manifest.resumable).toBe(false);
    expect(fs.statSync(path.join(root, 'output/candidate-review/frame-01.png')).size).toBe(4 * 1024 * 1024);
    const pixels = archiveRevision(root, 'with-pixel-evidence', {include: ['output/candidate-review/frame-01.png']});
    expect(fs.statSync(path.join(pixels.directory, 'output/candidate-review/frame-01.png')).size).toBe(4 * 1024 * 1024);
    expect(pixels.manifest.omittedDerived).toHaveLength(0);
    write(root, 'assets/subject.png', 'edited later');
    expect(fs.readFileSync(saved('assets/subject.png'), 'utf8')).toBe('original asset');
    expect(() => archiveRevision(root, 'before-edit')).toThrow(/已存在/);
    expect(() => archiveRevision(root, '../escape')).toThrow(/revision-id/);
  });

  it('rejects a linked input or active TTS task and leaves no partial archive or lock', () => {
    const root = project(), outside = temp();
    write(outside, 'file.txt', 'private');
    fs.symlinkSync(path.join(outside, 'file.txt'), path.join(root, 'assets/linked.txt'));
    expect(() => archiveRevision(root, 'linked')).toThrow(/符号链接/);
    expect(fs.existsSync(path.join(root, 'revisions/linked'))).toBe(false);
    expect(fs.existsSync(path.join(root, '.frame-loom-production.lock'))).toBe(false);
    write(root, '.frame-loom-tts.lock', '{}');
    expect(() => archiveRevision(root, 'locked')).toThrow(/TTS/);
    expect(fs.existsSync(path.join(root, 'revisions/locked'))).toBe(false);
    expect(() => archiveRevision(project(), 'escape', {include: ['../outside']})).toThrow(/项目内/);
    expect(() => archiveRevision(project(), 'recursive', {include: ['.cache']})).toThrow(/缓存/);
    const pending = project();
    write(pending, '.audio-publication.json', {backup: 'not yet recovered'});
    expect(() => archiveRevision(pending, 'pending')).toThrow(/未完成/);
    const interrupted = project();
    write(interrupted, 'revisions/.interrupted.pending/archive-state.json', {pid: 99999999});
    expect(() => archiveRevision(interrupted, 'interrupted')).toThrow(/未完成归档/);
    expect(fs.existsSync(path.join(interrupted, 'revisions/.interrupted.pending/archive-state.json'))).toBe(true);
    const reserved = project();
    write(reserved, 'archive-state.json', {original: true});
    expect(() => archiveRevision(reserved, 'reserved')).toThrow(/保留名称/);
    expect(JSON.parse(fs.readFileSync(path.join(reserved, 'archive-state.json'), 'utf8'))).toEqual({original: true});
  });

  it('does not publish an inconsistent archive when a source changes during copying', () => {
    const root = project();
    const originalCopy = fs.copyFileSync;
    vi.spyOn(fs, 'copyFileSync').mockImplementation((source, target, ...args) => {
      originalCopy(source, target, ...args);
      if (source.endsWith('script.md')) fs.writeFileSync(source, 'concurrently edited');
    });
    expect(() => archiveRevision(root, 'changing')).toThrow(/归档期间输入变化/);
    expect(fs.existsSync(path.join(root, 'revisions/changing'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'revisions/.changing.pending'))).toBe(false);
    expect(fs.existsSync(path.join(root, '.frame-loom-production.lock'))).toBe(false);
    expect(fs.readFileSync(path.join(root, 'output/candidate.mp4'), 'utf8')).toBe('original video');
  });

  it.skipIf(!hasFfmpeg)('shares images across labels, keeps full resolution, bounds bytes and preserves old evidence on failure', () => {
    const root = temp(), video = path.join(root, 'video.mp4'), board = path.join(root, 'storyboard.json'), output = path.join(root, 'review');
    const generated = spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=white:s=640x360:r=30:d=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', video], {encoding: 'utf8'});
    expect(generated.status, generated.stderr).toBe(0);
    write(root, 'storyboard.json', {schemaVersion: '2.3', project: {fps: 30, durationFrames: 60}, scenes: [{id: 'one', durationFrames: 60, beats: [], outro: {fadeFrames: 0}}]});
    const review = extractReviewFrames(video, board, output);
    const required = review.frames.find(frame => frame.label === 'one-before-handoff');
    const outro = review.frames.find(frame => frame.label === 'one-stable-outro');
    expect(required.file).toBe(outro.file);
    expect(review.storage.uniqueFrameCount).toBeLessThan(review.frames.length);
    expect(review.storage.format).toBe('jpeg');
    const dimensions = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,pix_fmt', '-of', 'json', path.join(output, required.file)], {encoding: 'utf8'});
    expect(JSON.parse(dimensions.stdout).streams[0]).toMatchObject({width: 640, height: 360, pix_fmt: 'yuvj444p'});
    const index = fs.readFileSync(path.join(output, 'review-frames.json'), 'utf8');
    expect(() => extractReviewFrames(video, board, output, {maxBytes: 1})).toThrow(/预算/);
    expect(fs.readFileSync(path.join(output, 'review-frames.json'), 'utf8')).toBe(index);
    expect(fs.existsSync(path.join(output, required.file))).toBe(true);
    expect(fs.readdirSync(output).some(name => name.startsWith('.review-frames-'))).toBe(false);
    const files = fs.readdirSync(output);
    extractReviewFrames(video, board, output);
    expect(fs.readdirSync(output).sort()).toEqual(files.sort());
    write(root, 'review/user-note.png', 'keep');
    write(root, 'review/frame-01.png', 'legacy evidence');
    write(root, 'storyboard.json', {schemaVersion: '2.3', project: {fps: 30, durationFrames: 30}, scenes: [{id: 'one', durationFrames: 30, beats: [], outro: {fadeFrames: 0}}]});
    extractReviewFrames(video, board, output);
    expect(fs.existsSync(path.join(output, required.file))).toBe(false);
    expect(fs.readFileSync(path.join(output, 'user-note.png'), 'utf8')).toBe('keep');
    expect(fs.readFileSync(path.join(output, 'frame-01.png'), 'utf8')).toBe('legacy evidence');
    const savedFiles = fs.readdirSync(output).sort();
    const savedIndex = fs.readFileSync(path.join(output, 'review-frames.json'), 'utf8');
    write(root, 'storyboard.json', {schemaVersion: '2.3', project: {fps: 30, durationFrames: 40}, scenes: [{id: 'one', durationFrames: 40, beats: [], outro: {fadeFrames: 0}}]});
    const originalRename = fs.renameSync;
    const publicationFailure = vi.spyOn(fs, 'renameSync').mockImplementation((source, target) => {
      if (path.basename(source) === 'review-frames.json') throw new Error('injected publication failure');
      return originalRename(source, target);
    });
    try {expect(() => extractReviewFrames(video, board, output)).toThrow(/publication failure/);}
    finally {publicationFailure.mockRestore();}
    expect(fs.readdirSync(output).sort()).toEqual(savedFiles);
    expect(fs.readFileSync(path.join(output, 'review-frames.json'), 'utf8')).toBe(savedIndex);
  }, 30000);
});
