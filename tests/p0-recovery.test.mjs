import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {URL} from 'node:url';
import {afterEach, describe, expect, it} from 'vitest';
import {renderToVerifiedOutput} from '../scripts/lib/verified-render-output.mjs';
import {inspectCleanNarratedRender} from '../scripts/lib/render-receipt.mjs';
import {extractReviewFrames} from '../scripts/extract-review-frames.mjs';
import {fingerprintFiles} from '../scripts/lib/input-fingerprint.mjs';

const directories = [];
const temp = () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-loom-p0-'));
  directories.push(directory);
  return directory;
};
const profile = {purpose: 'in-project-video', showReviewMarker: false};
const hasFfmpeg = spawnSync('ffmpeg', ['-version'], {stdio: 'ignore'}).status === 0;

afterEach(() => {
  for (const directory of directories.splice(0)) fs.rmSync(directory, {recursive: true, force: true});
});

describe('P0 render and review recovery', () => {
  it('does not publish a failed render or verification and can retry the same output', async () => {
    const outputPath = path.join(temp(), 'output', 'candidate.mp4');
    await expect(renderToVerifiedOutput({outputPath, profile, render: async (file) => {
      fs.writeFileSync(file, 'partial');
      throw new Error('interrupted render');
    }, verify: () => {}})).rejects.toThrow(/interrupted render/);
    expect(fs.existsSync(outputPath)).toBe(false);
    expect(fs.existsSync(`${outputPath}.render.json`)).toBe(false);

    await expect(renderToVerifiedOutput({outputPath, profile, render: async (file) => fs.writeFileSync(file, 'invalid'), verify: () => {
      throw new Error('media inspection failed');
    }})).rejects.toThrow(/media inspection failed/);
    expect(fs.existsSync(outputPath)).toBe(false);

    await renderToVerifiedOutput({outputPath, profile, render: async (file) => fs.writeFileSync(file, 'verified'), verify: (file) => {
      expect(fs.readFileSync(file, 'utf8')).toBe('verified');
    }});
    expect(fs.readFileSync(outputPath, 'utf8')).toBe('verified');
    expect(inspectCleanNarratedRender(outputPath).passed).toBe(true);
  });

  it('preserves the prior video and receipt when a forced rerender fails', async () => {
    const outputPath = path.join(temp(), 'candidate.mp4');
    await renderToVerifiedOutput({outputPath, profile, render: async (file) => fs.writeFileSync(file, 'original'), verify: () => {}});
    const originalReceipt = fs.readFileSync(`${outputPath}.render.json`, 'utf8');
    await expect(renderToVerifiedOutput({outputPath, force: true, profile, render: async (file) => {
      fs.writeFileSync(file, 'partial replacement');
      throw new Error('render failed');
    }, verify: () => {}})).rejects.toThrow(/render failed/);
    expect(fs.readFileSync(outputPath, 'utf8')).toBe('original');
    expect(fs.readFileSync(`${outputPath}.render.json`, 'utf8')).toBe(originalReceipt);
    expect(inspectCleanNarratedRender(outputPath).passed).toBe(true);

    await renderToVerifiedOutput({outputPath, force: true, profile, render: async (file) => fs.writeFileSync(file, 'replacement'), verify: () => {}});
    expect(fs.readFileSync(outputPath, 'utf8')).toBe('replacement');
    expect(inspectCleanNarratedRender(outputPath).passed).toBe(true);
  });

  it('removes a dead process partial and restores an interrupted publication before retrying', async () => {
    const outputPath = path.join(temp(), 'candidate.mp4');
    const parent = path.dirname(outputPath);
    const orphan = fs.mkdtempSync(path.join(parent, '.candidate.mp4-render-'));
    fs.writeFileSync(path.join(orphan, 'owner.json'), JSON.stringify({schemaVersion: '1.0', pid: 99999999, outputPath}));
    fs.writeFileSync(path.join(orphan, 'candidate.mp4'), 'partial video');
    await renderToVerifiedOutput({outputPath, profile, render: async (file) => fs.writeFileSync(file, 'original'), verify: () => {}});
    expect(fs.existsSync(orphan)).toBe(false);
    const originalReceipt = fs.readFileSync(`${outputPath}.render.json`, 'utf8');

    const interrupted = fs.mkdtempSync(path.join(parent, '.candidate.mp4-render-'));
    const stagedVideo = path.join(interrupted, 'candidate.mp4');
    fs.writeFileSync(stagedVideo, 'new video');
    const readyFingerprint = fingerprintFiles([stagedVideo], interrupted);
    fs.writeFileSync(path.join(interrupted, 'owner.json'), JSON.stringify({schemaVersion: '1.0', pid: 99999999, outputPath, readyFingerprint}));
    fs.renameSync(outputPath, path.join(interrupted, 'previous.mp4'));
    fs.renameSync(`${outputPath}.render.json`, path.join(interrupted, 'previous.render.json'));
    fs.renameSync(stagedVideo, outputPath);
    await expect(renderToVerifiedOutput({outputPath, profile, render: async () => {}, verify: () => {}})).rejects.toThrow(/未覆盖/);
    expect(fs.existsSync(interrupted)).toBe(false);
    expect(fs.readFileSync(outputPath, 'utf8')).toBe('original');
    expect(fs.readFileSync(`${outputPath}.render.json`, 'utf8')).toBe(originalReceipt);
    expect(inspectCleanNarratedRender(outputPath).passed).toBe(true);
  });

  it('retries after the renderer process is killed before publication', async () => {
    const outputPath = path.join(temp(), 'candidate.mp4');
    const helperUrl = new URL('../scripts/lib/verified-render-output.mjs', import.meta.url).href;
    const script = `import fs from 'node:fs'; import {renderToVerifiedOutput} from ${JSON.stringify(helperUrl)};
      await renderToVerifiedOutput({outputPath: ${JSON.stringify(outputPath)}, profile: ${JSON.stringify(profile)},
        render: async (file) => {fs.writeFileSync(file, 'partial'); process.stdout.write('ready\\n'); await new Promise(() => setInterval(() => {}, 1000));},
        verify: () => {}});`;
    const child = spawn(process.execPath, ['--import', 'tsx/esm', '--input-type=module', '-e', script], {cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe']});
    try {
      await Promise.race([
        once(child.stdout, 'data'),
        once(child, 'close').then(() => {throw new Error('renderer exited before producing a partial file');})
      ]);
      child.kill('SIGKILL');
      await once(child, 'close');
      expect(fs.existsSync(outputPath)).toBe(false);
      await renderToVerifiedOutput({outputPath, profile, render: async (file) => fs.writeFileSync(file, 'recovered'), verify: () => {}});
      expect(fs.readFileSync(outputPath, 'utf8')).toBe('recovered');
      expect(inspectCleanNarratedRender(outputPath).passed).toBe(true);
      expect(fs.readdirSync(path.dirname(outputPath)).some((name) => name.startsWith('.candidate.mp4-render-'))).toBe(false);
    } finally {
      if (child.exitCode === null) child.kill('SIGKILL');
    }
  }, 15000);

  it.skipIf(!hasFfmpeg)('renders multiple contact-sheet pages and leaves prior review evidence intact after extraction failure', () => {
    const directory = temp();
    const storyboardPath = path.join(directory, 'storyboard.json');
    const videoPath = path.join(directory, 'long.mp4');
    const reviewDir = path.join(directory, 'review');
    const storyboard = {
      schemaVersion: '2.3',
      project: {fps: 30, durationFrames: 35 * 12},
      scenes: Array.from({length: 35}, (_, index) => ({id: `scene-${index}`, durationFrames: 12, beats: []}))
    };
    fs.writeFileSync(storyboardPath, JSON.stringify(storyboard));
    const makeVideo = (duration, output) => {
      const result = spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', `color=c=blue:s=160x90:r=10:d=${duration}`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-y', output], {encoding: 'utf8'});
      expect(result.status, result.stderr).toBe(0);
    };
    makeVideo(15, videoPath);
    const review = extractReviewFrames(videoPath, storyboardPath, reviewDir);
    expect(review.contactSheets).toEqual(['contact-sheet.png', 'contact-sheet-2.png']);
    expect(review.frames.length).toBeGreaterThan(70);
    expect(review.pages.map(({firstFrame, lastFrame}) => [firstFrame, lastFrame])).toEqual([[1, 48], [49, review.frames.length]]);
    const savedManifest = fs.readFileSync(path.join(reviewDir, 'review-frames.json'), 'utf8');
    expect(JSON.parse(savedManifest).pages).toEqual(review.pages);
    for (const scene of storyboard.scenes) {
      expect(review.frames.some((frame) => frame.label === `${scene.id}-complete`)).toBe(true);
      expect(review.frames.some((frame) => frame.label === `${scene.id}-before-handoff`)).toBe(true);
    }
    for (const page of review.contactSheets) expect(fs.statSync(path.join(reviewDir, page)).size).toBeGreaterThan(0);

    makeVideo(1, videoPath);
    expect(() => extractReviewFrames(videoPath, storyboardPath, reviewDir)).toThrow();
    expect(fs.readFileSync(path.join(reviewDir, 'review-frames.json'), 'utf8')).toBe(savedManifest);
    expect(fs.existsSync(path.join(reviewDir, 'contact-sheet-2.png'))).toBe(true);
  }, 60000);
});
