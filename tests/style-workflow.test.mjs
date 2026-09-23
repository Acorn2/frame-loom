import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, describe, expect, it} from 'vitest';
import {validateAssets} from '../scripts/validate-assets.mjs';
import articleStoryboard from '../examples/article-video/storyboard.json' with {type: 'json'};
import dataStoryboard from '../examples/data-explainer/storyboard.json' with {type: 'json'};
import productStoryboard from '../examples/product-demo/storyboard.json' with {type: 'json'};
import retroWindowsMotion from '../styles/retro-windows/motion.json' with {type: 'json'};
import retroWindowsStyle from '../styles/retro-windows/style.json' with {type: 'json'};
import retroZineMotion from '../styles/retro-zine/motion.json' with {type: 'json'};
import retroZineStyle from '../styles/retro-zine/style.json' with {type: 'json'};
import scatterbrainMotion from '../styles/scatterbrain/motion.json' with {type: 'json'};
import scatterbrainStyle from '../styles/scatterbrain/style.json' with {type: 'json'};
import {checkSafeArea} from '../scripts/check-safe-area.mjs';
import {selectReviewFrames} from '../scripts/extract-review-frames.mjs';
import {initProject} from '../scripts/init-project.mjs';
import {filterStyles, loadStyleIndex} from '../scripts/lib/style-catalog.mjs';
import {buildStyleGallery} from '../scripts/preview-styles.mjs';
import {CAPABILITY_MANIFEST} from '../src/renderer/capability-manifest.ts';
import {createStyleTokens} from '../src/styles/style-loader.ts';
import {AudioConfigSchema} from '../src/schemas/audio-config.ts';

const tempDirs = [];

function makeTempDir() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-loom-test-'));
  tempDirs.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    fs.rmSync(directory, {recursive: true, force: true});
  }
});

describe('Style Pack workflow', () => {
  it('loads three consistent styles and filters by content and canvas', () => {
    const index = loadStyleIndex();
    expect(index.styles).toHaveLength(3);
    expect(index.styles.map((item) => item.id).sort()).toEqual(['retro-windows', 'retro-zine', 'scatterbrain']);
    expect(CAPABILITY_MANIFEST.templates).toEqual(['statement', 'graph-explainer', 'metric-grid', 'interaction-flow']);
    expect(CAPABILITY_MANIFEST.actions).toContain('draw');
    expect(filterStyles(index.styles, {content: 'software', canvas: 'landscape'}).map((item) => item.id)).toEqual(['retro-windows']);
    expect(filterStyles(index.styles, {content: 'knowledge', canvas: 'portrait'}).map((item) => item.id)).toEqual(['retro-zine', 'scatterbrain']);
  });

  it('loads visually distinct runtime tokens and orientation-specific safe areas', () => {
    const zine = createStyleTokens(retroZineStyle, retroZineMotion, 1920, 1080);
    const windows = createStyleTokens(retroWindowsStyle, retroWindowsMotion, 1920, 1080);
    const notesPortrait = createStyleTokens(scatterbrainStyle, scatterbrainMotion, 1080, 1920);
    expect(new Set([zine.pattern, windows.pattern, notesPortrait.pattern]).size).toBe(3);
    expect(zine.background).not.toBe(windows.background);
    expect(zine.motion.enterOffset).not.toBe(windows.motion.enterOffset);
    expect(notesPortrait.motion.emphasisScale).toBeGreaterThan(windows.motion.emphasisScale);
    expect(notesPortrait.safeArea.bottom).toBe(144);
  });

  it.each([
    ['article', articleStoryboard],
    ['product', productStoryboard],
    ['data', dataStoryboard]
  ])('keeps the %s example inside declared safe-area bounds', (_name, storyboard) => {
    const report = checkSafeArea(storyboard);
    expect(report.issues.filter((item) => item.severity === 'error')).toEqual([]);
  });

  it('reports an explicit layer overflow', () => {
    const invalid = structuredClone(dataStoryboard);
    invalid.scenes[0].layers[0].x = 900;
    invalid.scenes[0].layers[0].width = 200;
    expect(checkSafeArea(invalid).issues.some((item) => item.severity === 'error')).toBe(true);
  });

  it('creates a gallery and a non-overwriting project scaffold', () => {
    const temp = makeTempDir();
    const gallery = buildStyleGallery([path.join(temp, 'gallery.html')]);
    expect(fs.readFileSync(gallery, 'utf8')).toContain('Retro Windows');
    expect(fs.readFileSync(gallery, 'utf8')).toContain('Scatterbrain');

    const project = initProject(['demo-project', '--style', 'scatterbrain', '--canvas', 'portrait', '--projects-dir', temp]);
    const draft = JSON.parse(fs.readFileSync(path.join(project, 'storyboard.draft.json'), 'utf8'));
    expect(draft.project.status).toBe('draft');
    expect(draft.project.width).toBe(1080);
    expect(draft.project.durationSec).toBe(20);
    expect(draft.project.durationFrames).toBe(600);
    expect(draft.scenes[0].durationFrames).toBe(600);
    const audioExample = JSON.parse(fs.readFileSync(path.join(project, 'audio/audio-config.example.json'), 'utf8'));
    expect(AudioConfigSchema.safeParse(audioExample).success).toBe(true);
    expect(() => initProject(['demo-project', '--projects-dir', temp])).toThrow(/已存在/);
  });

  it('checks screenshot provenance paths and manifest types', () => {
    const directory = makeTempDir();
    const project = path.join(directory, 'project');
    const assets = path.join(project, 'assets');
    fs.mkdirSync(assets, {recursive: true});
    fs.writeFileSync(path.join(assets, 'screen.svg'), '<svg />');
    fs.writeFileSync(path.join(project, 'storyboard.json'), JSON.stringify({
      ...articleStoryboard,
      scenes: [{
        ...articleStoryboard.scenes[0],
        layers: [{id: 'screen', type: 'screenshot', asset: 'assets/screen.svg'}]
      }]
    }));

    const manifestPath = path.join(project, 'asset-manifest.json');
    const writeManifest = (asset) => fs.writeFileSync(manifestPath, JSON.stringify({
      schemaVersion: '1.0',
      assets: [asset]
    }));
    const manifestAsset = {
      id: 'screen',
      path: 'assets/screen.svg',
      type: 'screenshot',
      source: 'Local fixture',
      license: 'MIT',
      intendedUse: 'Test screenshot'
    };
    writeManifest(manifestAsset);
    expect(validateAssets(path.join(project, 'storyboard.json'))).toEqual([]);

    writeManifest({...manifestAsset, type: 'image'});
    expect(validateAssets(path.join(project, 'storyboard.json')).some((item) => item.includes('登记为 image'))).toBe(true);

    writeManifest({...manifestAsset, path: '../outside.svg'});
    expect(validateAssets(path.join(project, 'storyboard.json')).some((item) => item.includes('逃出项目目录'))).toBe(true);

    writeManifest({...manifestAsset, path: path.join(assets, 'screen.svg')});
    expect(validateAssets(path.join(project, 'storyboard.json'))).toEqual([]);
  });

  it('selects at least six review frames for a 20-second video', () => {
    const frames = selectReviewFrames(articleStoryboard);
    expect(frames.length).toBeGreaterThanOrEqual(6);
    expect(frames.some((item) => item.label === 'opening')).toBe(true);
    expect(frames.some((item) => item.label === 'ending')).toBe(true);
  });
});
