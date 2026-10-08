import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {afterEach, describe, expect, it} from 'vitest';
import {validateAssets} from '../scripts/validate-assets.mjs';
import articleStoryboard from '../examples/article-video/storyboard.json' with {type: 'json'};
import dataStoryboard from '../examples/data-explainer/storyboard.json' with {type: 'json'};
import productStoryboard from '../examples/product-demo/storyboard.json' with {type: 'json'};
import semanticStoryboard from '../examples/semantic-visuals/storyboard.json' with {type: 'json'};
import retroWindowsMotion from '../styles/retro-windows/motion.json' with {type: 'json'};
import retroWindowsStyle from '../styles/retro-windows/style.json' with {type: 'json'};
import retroZineMotion from '../styles/retro-zine/motion.json' with {type: 'json'};
import retroZineStyle from '../styles/retro-zine/style.json' with {type: 'json'};
import scatterbrainMotion from '../styles/scatterbrain/motion.json' with {type: 'json'};
import scatterbrainStyle from '../styles/scatterbrain/style.json' with {type: 'json'};
import {checkSafeArea} from '../scripts/check-safe-area.mjs';
import {selectReviewFrames} from '../scripts/extract-review-frames.mjs';
import {initProject} from '../scripts/init-project.mjs';
import {filterStyles, loadStyleIndex, loadStylePack} from '../scripts/lib/style-catalog.mjs';
import {buildStyleGallery} from '../scripts/preview-styles.mjs';
import {CAPABILITY_MANIFEST} from '../src/renderer/capability-manifest.ts';
import {createStyleTokens} from '../src/styles/style-loader.ts';
import {captionTextStyle} from '../src/audio/caption-style.ts';
import {AudioConfigSchema} from '../src/schemas/audio-config.ts';
import {TtsConfigSchema} from '../src/schemas/tts-config.ts';
import {listTtsProfiles} from '../scripts/lib/tts-profiles.mjs';
import {promoteDraftStoryboard} from '../scripts/produce.mjs';
import {runProduction} from '../scripts/produce.mjs';
import {fingerprintFiles, fingerprintProjectInputs} from '../scripts/lib/input-fingerprint.mjs';
import {checkExternalCaptionLayout, checkTextLayout} from '../scripts/lib/text-layout.mjs';
import {checkAudioInput} from '../scripts/lib/preflight.mjs';
import {storyboardApprovalFingerprint} from '../scripts/lib/storyboard-approval.mjs';

const tempDirs = [];

function makeTempDir() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-loom-test-'));
  tempDirs.push(directory);
  return directory;
}

function approveFixture(project) {
  fs.writeFileSync(path.join(project, 'storyboard-approval.json'), JSON.stringify({
    reviewer: 'test reviewer', notes: 'fixture approved', fingerprint: storyboardApprovalFingerprint(project)
  }));
}

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    fs.rmSync(directory, {recursive: true, force: true});
  }
});

describe('Style Pack workflow', () => {
  it('uses distinct, readable caption colors without a subtitle background', () => {
    const darkStyles = new Set(['retro-windows', 'signal', 'signal-noir']);
    for (const entry of loadStyleIndex().styles) {
      const style = loadStylePack(entry.id);
      const caption = captionTextStyle(style.tokens);
      expect(caption.color).toBe(style.tokens.captionInk);
      expect(caption.color.toLowerCase()).not.toBe(style.tokens.ink.toLowerCase());
      expect(caption).not.toHaveProperty('background');
      expect(caption).not.toHaveProperty('backgroundColor');
      expect(style.tokens.captionInk.toLowerCase() === '#ffffff').toBe(darkStyles.has(entry.id));
    }
  });

  it('loads the Style Pack index and filters by content and canvas', () => {
    const index = loadStyleIndex();
    expect(index.styles).toHaveLength(7);
    expect(index.styles.map((item) => item.id).sort()).toEqual(['archive-grid', 'retro-windows', 'retro-zine', 'scatterbrain', 'signal-noir', 'signal', 'studio-frame'].sort());
    expect(CAPABILITY_MANIFEST.templates).toEqual(['statement', 'graph-explainer', 'metric-grid', 'interaction-flow']);
    expect(CAPABILITY_MANIFEST.actions).toContain('draw');
    expect(filterStyles(index.styles, {content: 'software', canvas: 'landscape'}).map((item) => item.id)).toEqual(['signal-noir', 'studio-frame']);
    expect(filterStyles(index.styles, {content: 'knowledge', canvas: 'portrait'}).map((item) => item.id)).toEqual(['retro-zine', 'signal', 'scatterbrain', 'archive-grid', 'signal-noir']);
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
    expect(fs.readFileSync(gallery, 'utf8')).toContain('Blueprint');
    expect(fs.readFileSync(gallery, 'utf8')).toContain('Sketch Notes');
    expect(fs.readFileSync(gallery, 'utf8')).toContain('&quot;Kaiti SC&quot;');

    const project = initProject(['demo-project', '--style', 'scatterbrain', '--canvas', 'portrait', '--projects-dir', temp]);
    const draft = JSON.parse(fs.readFileSync(path.join(project, 'storyboard.draft.json'), 'utf8'));
    expect(draft.schemaVersion).toBe('2.3');
    expect(draft.scenes[0].visual.kind).toBe('statement');
    expect(draft.project.status).toBe('draft');
    expect(draft.project.width).toBe(1080);
    expect(draft.project.durationSec).toBe(20);
    expect(draft.project.durationFrames).toBe(600);
    expect(draft.scenes[0].durationFrames).toBe(600);
    expect(fs.readFileSync(path.join(project, 'route-card.md'), 'utf8')).toContain('Selected route');
    expect(fs.readFileSync(path.join(project, 'content-gaps.md'), 'utf8')).toContain('Gap ID');
    expect(fs.readFileSync(path.join(project, 'shot-map.md'), 'utf8')).toContain('Scene ID');
    expect(JSON.parse(fs.readFileSync(path.join(project, 'project-input.json'), 'utf8')).inputMode).toBe('document');
    expect(fs.existsSync(path.join(project, 'visual-sources.md'))).toBe(false);
    const audioExample = JSON.parse(fs.readFileSync(path.join(project, 'audio/audio-config.example.json'), 'utf8'));
    expect(AudioConfigSchema.safeParse(audioExample).success).toBe(true);
    for (const name of ['', '.openai', '.elevenlabs', '.aliyun']) {
      const example = JSON.parse(fs.readFileSync(path.join(project, `audio/tts-config${name}.example.json`), 'utf8'));
      expect(TtsConfigSchema.safeParse(example).success).toBe(true);
      expect(example.enabled).toBe(false);
    }
    expect(listTtsProfiles(project)).toEqual([]);
    const openaiExample = JSON.parse(fs.readFileSync(path.join(project, 'audio/tts-config.openai.example.json'), 'utf8'));
    fs.writeFileSync(path.join(project, 'audio/tts-config.json'), JSON.stringify({...openaiExample, enabled: true}));
    expect(listTtsProfiles(project).map(({provider}) => provider)).toEqual(['openai']);
    expect(() => initProject(['demo-project', '--projects-dir', temp])).toThrow(/已存在/);
  });

  it('uses a local creation date and numbered suffix for new production projects', () => {
    const temp = makeTempDir();
    const options = {now: new Date(2026, 8, 28, 12)};
    const args = ['--slug', 'tongliao-zhihu-update', '--projects-dir', temp];
    const first = initProject(args, options);
    fs.writeFileSync(path.join(first, 'source/source.md'), 'Keep this source');
    const second = initProject(args, options);
    const third = initProject(args, options);

    expect(path.basename(first)).toBe('20260928-tongliao-zhihu-update');
    expect(path.basename(second)).toBe('20260928-tongliao-zhihu-update-02');
    expect(path.basename(third)).toBe('20260928-tongliao-zhihu-update-03');
    expect(fs.readFileSync(path.join(first, 'source/source.md'), 'utf8')).toBe('Keep this source');
    expect(() => initProject(['--slug', '20260928-tongliao', '--projects-dir', temp], options)).toThrow(/不要包含日期前缀/);
  });

  it('initializes the semantic route for every installed Style Pack', () => {
    const temp = makeTempDir();
    for (const style of loadStyleIndex().styles) {
      const project = initProject([`semantic-${style.id}`, '--style', style.id, '--projects-dir', temp]);
      const draft = JSON.parse(fs.readFileSync(path.join(project, 'storyboard.draft.json'), 'utf8'));
      expect(draft.schemaVersion).toBe('2.3');
      expect(draft.style.id).toBe(style.id);
      expect(draft.scenes[0].visual.kind).toBe('statement');
    }
  });

  it('lets the creator choose document plus images and requires a used image before rendering', () => {
    const temp = makeTempDir();
    const project = initProject(['image-project', '--input-mode', 'document-images', '--projects-dir', temp]);
    expect(JSON.parse(fs.readFileSync(path.join(project, 'project-input.json'), 'utf8')).inputMode).toBe('document-images');
    expect(fs.readFileSync(path.join(project, 'visual-sources.md'), 'utf8')).toContain('Original path or URL');
    expect(fs.readFileSync(path.join(project, 'visual-sources.md'), 'utf8')).toContain('Final URL');
    expect(fs.readFileSync(path.join(project, 'production-brief.md'), 'utf8')).toContain('Image sources, capture details and intended shots checked\n');
    expect(() => initProject(['invalid-project', '--input-mode', 'video', '--projects-dir', temp])).toThrow(/--input-mode/);
    const beforeSources = fingerprintProjectInputs(project, path.resolve('styles'));
    fs.appendFileSync(path.join(project, 'visual-sources.md'), '\n| V1 | URL screenshot | https://example.test | assets/screen.svg | pending | C1 / opening | review |\n');
    expect(fingerprintProjectInputs(project, path.resolve('styles'))).not.toBe(beforeSources);

    const storyboardPath = path.join(project, 'storyboard.json');
    fs.writeFileSync(storyboardPath, JSON.stringify(articleStoryboard));
    expect(validateAssets(storyboardPath).some((item) => item.includes('至少需要一个'))).toBe(true);

    const sourcePath = path.resolve('examples/template-families/assets/product-workflow.svg');
    const assetPath = path.join(project, 'assets', 'screen.svg');
    fs.copyFileSync(sourcePath, assetPath);
    const storyboard = structuredClone(articleStoryboard);
    storyboard.scenes[0].layers.push({id: 'screen', type: 'screenshot', asset: 'assets/screen.svg'});
    fs.writeFileSync(storyboardPath, JSON.stringify(storyboard));
    fs.writeFileSync(path.join(project, 'asset-manifest.json'), JSON.stringify({
      schemaVersion: '1.0',
      assets: [{id: 'screen', path: 'assets/screen.svg', type: 'screenshot', source: 'Local fixture', license: 'MIT', intendedUse: 'Opening scene'}]
    }));
    expect(validateAssets(storyboardPath)).toEqual([]);

    fs.writeFileSync(path.join(project, 'project-input.json'), JSON.stringify({schemaVersion: '1.0', inputMode: 'document'}));
    expect(validateAssets(storyboardPath).some((item) => item.includes('不能使用图片或截图'))).toBe(true);
  });

  it('promotes a draft to generated without changing its content contract', () => {
    const draft = structuredClone(articleStoryboard);
    draft.project.status = 'draft';
    const generated = promoteDraftStoryboard(draft);
    expect(generated.project.status).toBe('generated');
    expect(generated.project.title).toBe(draft.project.title);
    expect(generated.scenes).toEqual(draft.scenes);
  });

  it('records reused stages when resuming from QA', () => {
    const temp = makeTempDir();
    const project = path.join(temp, 'resume-project');
    fs.mkdirSync(path.join(project, 'output', 'review'), {recursive: true});
    fs.writeFileSync(path.join(project, 'storyboard.json'), `${JSON.stringify(articleStoryboard, null, 2)}\n`);
    fs.writeFileSync(path.join(project, 'asset-manifest.json'), JSON.stringify({schemaVersion: '1.0', assets: []}));
    approveFixture(project);
    fs.writeFileSync(path.join(project, 'output', 'preview-silent.mp4'), 'placeholder');
    const inputFingerprint = fingerprintProjectInputs(project, path.resolve('styles'));
    const outputFingerprint = fingerprintFiles([path.join(project, 'output', 'preview-silent.mp4')], project);
    fs.writeFileSync(path.join(project, 'run.json'), JSON.stringify({
      schemaVersion: '1.0',
      projectId: 'resume-project',
      projectPath: project,
      executionMode: 'review',
      status: 'completed',
      currentStage: 'done',
      inputFingerprint,
      outputFingerprint,
      audioConfigPath: null,
      stages: {
        storyboard: 'completed',
        validation: 'completed',
        assets: 'completed',
        safeArea: 'completed',
        render: 'completed',
        qa: 'completed'
      },
      artifacts: {
        storyboard: 'storyboard.json',
        video: 'output/preview-silent.mp4',
        reviewDir: 'output/review'
      },
      warnings: [],
      errors: []
    }));

    const run = runProduction({
      projectPath: project,
      executionMode: 'review',
      from: 'qa',
      force: false
    });
    expect(run.status).toBe('blocked');
    expect(run.resumedFrom).toBe('qa');
    expect(run.stages.storyboard).toBe('reused');
    expect(run.stages.validation).toBe('reused');
    expect(run.stages.assets).toBe('reused');
    expect(run.stages.safeArea).toBe('reused');
    expect(run.stages.render).toBe('reused');
    expect(run.errors.some((item) => item.includes('ffprobe'))).toBe(true);
  });

  it('rejects resuming after an input changes and keeps the previous run record', () => {
    const temp = makeTempDir();
    const project = path.join(temp, 'resume-project');
    fs.mkdirSync(project, {recursive: true});
    const storyboardPath = path.join(project, 'storyboard.json');
    fs.writeFileSync(storyboardPath, JSON.stringify(articleStoryboard));
    const runPath = path.join(project, 'run.json');
    const previousRun = {
      executionMode: 'review',
      inputFingerprint: fingerprintProjectInputs(project, path.resolve('styles')),
      stages: {storyboard: 'completed', validation: 'completed'}
    };
    fs.writeFileSync(runPath, JSON.stringify(previousRun));
    fs.writeFileSync(storyboardPath, JSON.stringify({...articleStoryboard, project: {...articleStoryboard.project, title: 'Changed'}}));

    expect(() => runProduction({projectPath: project, executionMode: 'review', from: 'assets'})).toThrow(/输入与上次运行不同/);
    expect(JSON.parse(fs.readFileSync(runPath, 'utf8'))).toEqual(previousRun);
  });

  it('invalidates a resumed render when the source-to-shot plan changes', () => {
    const temp = makeTempDir();
    const project = initProject(['plan-fingerprint', '--projects-dir', temp]);
    const before = fingerprintProjectInputs(project, path.resolve('styles'));
    fs.appendFileSync(path.join(project, 'shot-map.md'), '\n| C2 | revised claim | source.md | needs-review | scene-2 | diagram | none |\n');
    expect(fingerprintProjectInputs(project, path.resolve('styles'))).not.toBe(before);
  });

  it('rejects reusing a video whose bytes changed before QA', () => {
    const temp = makeTempDir();
    const project = path.join(temp, 'resume-project');
    const outputPath = path.join(project, 'output', 'preview-silent.mp4');
    fs.mkdirSync(path.dirname(outputPath), {recursive: true});
    fs.writeFileSync(path.join(project, 'storyboard.json'), JSON.stringify(articleStoryboard));
    fs.writeFileSync(outputPath, 'original-video');
    approveFixture(project);
    const previousRun = {
      executionMode: 'review',
      inputFingerprint: fingerprintProjectInputs(project, path.resolve('styles')),
      outputFingerprint: fingerprintFiles([outputPath], project),
      stages: {storyboard: 'completed', validation: 'completed', assets: 'completed', safeArea: 'completed', render: 'completed'},
      artifacts: {video: 'output/preview-silent.mp4', reviewDir: 'output/review'}
    };
    fs.writeFileSync(path.join(project, 'run.json'), JSON.stringify(previousRun));
    fs.writeFileSync(outputPath, 'changed-video');

    expect(() => runProduction({projectPath: project, executionMode: 'review', from: 'qa'})).toThrow(/输出视频与上次渲染结果不同/);
  });

  it('catches a node text overflow and accepts the shorter replacement', () => {
    const storyboard = structuredClone(articleStoryboard);
    const scene = storyboard.scenes[1];
    scene.layers.push({id: 'dense-node', type: 'node', label: '02 / 发现', text: '注意到翅膀纹理', state: 'current', x: 100, y: 350, width: 380, height: 165});
    expect(checkTextLayout(storyboard).some((item) => item.target === 'dense-node' && item.severity === 'error')).toBe(true);
    scene.layers.at(-1).text = '发现翅膀纹理';
    expect(checkTextLayout(storyboard).some((item) => item.target === 'dense-node')).toBe(false);
  });

  it('blocks production before rendering when card text exceeds its box', () => {
    const temp = makeTempDir();
    const project = path.join(temp, 'text-overflow-project');
    fs.mkdirSync(project, {recursive: true});
    const storyboard = structuredClone(articleStoryboard);
    storyboard.scenes[0].layers.push({id: 'dense-node', type: 'node', label: '02 / 发现', text: '注意到翅膀纹理', state: 'current', x: 100, y: 350, width: 380, height: 165});
    fs.writeFileSync(path.join(project, 'storyboard.json'), JSON.stringify(storyboard));
    fs.writeFileSync(path.join(project, 'asset-manifest.json'), JSON.stringify({schemaVersion: '1.0', assets: []}));
    approveFixture(project);

    const run = runProduction({projectPath: project, executionMode: 'review'});
    expect(run.status).toBe('blocked');
    expect(run.stages.safeArea).toBe('blocked');
    expect(run.errors.some((item) => item.includes('dense-node'))).toBe(true);
    expect(fs.existsSync(path.join(project, 'output', 'preview-silent.mp4'))).toBe(false);
  });

  it('flags an overlong external caption that would switch too quickly after splitting', () => {
    const cues = [{startSec: 0, endSec: 2, text: '这是一条过长的外部字幕，需要在安全区内排成许多行，应该先拆成多个字幕窗口。'.repeat(3)}];
    expect(checkExternalCaptionLayout(articleStoryboard, cues).some((item) => item.severity === 'error')).toBe(true);
    expect(checkExternalCaptionLayout(articleStoryboard, [{...cues[0], text: '短字幕'}])).toEqual([]);
  });

  it('rejects an overlong external SRT cue during audio preflight', () => {
    const temp = makeTempDir();
    const storyboardPath = path.join(temp, 'storyboard.json');
    const configPath = path.join(temp, 'audio-config.json');
    fs.writeFileSync(storyboardPath, JSON.stringify(articleStoryboard));
    fs.writeFileSync(configPath, JSON.stringify({schemaVersion: '1.0', captions: {enabled: true, path: 'captions.srt', format: 'srt', source: 'test'}}));
    fs.writeFileSync(path.join(temp, 'captions.srt'), `1\n00:00:01,000 --> 00:00:03,000\n${'这是一条很长的字幕，需要拆分后才能安全显示。'.repeat(5)}\n`);
    expect(() => checkAudioInput(storyboardPath, configPath)).toThrow(/外部字幕拆分后切换过快/);
  });

  it('rejects a direct render with no asset manifest before bundling', () => {
    const temp = makeTempDir();
    const storyboardPath = path.join(temp, 'storyboard.json');
    fs.writeFileSync(storyboardPath, JSON.stringify(articleStoryboard));
    const outputPath = path.join(temp, 'preview.mp4');
    const result = spawnSync(process.execPath, ['--import', 'tsx/esm', 'scripts/render-storyboard.mjs', storyboardPath, outputPath, '--mode', 'fast'], {cwd: process.cwd(), encoding: 'utf8'});
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('asset-manifest');
    expect(fs.existsSync(outputPath)).toBe(false);
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

    fs.writeFileSync(path.join(assets, 'inside.svg'), '<svg />');
    fs.unlinkSync(path.join(assets, 'screen.svg'));
    fs.symlinkSync('inside.svg', path.join(assets, 'screen.svg'));
    writeManifest(manifestAsset);
    expect(validateAssets(path.join(project, 'storyboard.json'))).toEqual([]);

    const outsidePath = path.join(directory, 'outside.svg');
    fs.writeFileSync(outsidePath, '<svg />');
    fs.unlinkSync(path.join(assets, 'screen.svg'));
    fs.symlinkSync(outsidePath, path.join(assets, 'screen.svg'));
    expect(validateAssets(path.join(project, 'storyboard.json')).some((item) => item.includes('逃出项目目录'))).toBe(true);

    writeManifest({...manifestAsset, path: outsidePath});
    const storyboard = JSON.parse(fs.readFileSync(path.join(project, 'storyboard.json'), 'utf8'));
    storyboard.scenes[0].layers[0].asset = outsidePath;
    fs.writeFileSync(path.join(project, 'storyboard.json'), JSON.stringify(storyboard));
    expect(validateAssets(path.join(project, 'storyboard.json'))).toEqual([]);
  });

  it('selects at least six review frames for a 20-second video', () => {
    const frames = selectReviewFrames(articleStoryboard);
    expect(frames.length).toBeGreaterThanOrEqual(6);
    expect(frames.some((item) => item.label === 'opening')).toBe(true);
    expect(frames.some((item) => item.label === 'ending')).toBe(true);
  });

  it('samples semantic completion and the stable frame before a fade', () => {
    const storyboard = structuredClone(semanticStoryboard);
    storyboard.scenes = [storyboard.scenes[0], storyboard.scenes.at(-1)];
    storyboard.scenes[0].transitionOut = 'fade';
    storyboard.project.durationFrames = storyboard.scenes.reduce((total, scene) => total + scene.durationFrames, 0);
    storyboard.project.durationSec = storyboard.project.durationFrames / storyboard.project.fps;
    const frames = selectReviewFrames(storyboard);
    const preFade = frames.find((item) => item.label === 's1-before-handoff');
    expect(preFade.timeSec).toBe((storyboard.scenes[0].durationFrames - 12 - 2) / storyboard.project.fps);
  });
});
