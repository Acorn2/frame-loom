import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {getCompositions, openBrowser, renderMedia} from '@remotion/renderer';
import {StoryboardSchema} from '../src/schemas/storyboard.ts';
import {StylePackSchema, MotionPackSchema} from '../src/schemas/style-pack.ts';
import {createStyleTokens} from '../src/styles/style-loader.ts';
import {assertProductionLock, resolveProductionLock, writeProductionLock, productionDirectory} from './lib/production-lock.mjs';
import {hydrateLibraryAssets} from './lib/library-assets.mjs';
import {checkStoryboardInput, checkAssetInput, checkVisualInput} from './lib/preflight.mjs';
import {layoutCollector} from './lib/layout-qa.mjs';
import {renderToVerifiedOutput} from './lib/verified-render-output.mjs';
import {inspectOutput} from './inspect-output.mjs';
import {renderCover} from './render-cover.mjs';

// Same controlled runtime as public recipe previews. These are public samples,
// not visual-master delivery approvals or a replacement production workflow.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (args.some(a => !['--force', '--annotated', '--narrative'].includes(a))) throw new Error('Usage: npm run preview:image-led -- [--force]');
const force = args.includes('--force'), out = path.join(root, 'examples/illustration-directions/previews');
fs.mkdirSync(out, {recursive: true});
const serveUrl = await bundle({entryPoint: path.join(root, 'src/index.ts'), outDir: path.join(root, '.tmp/image-led-directions/bundle')});
const browser = await openBrowser('chrome');
try {
  for (const slug of ['annotated', 'narrative'].filter(s => args.some(a => ['--annotated', '--narrative'].includes(a)) ? args.includes(`--${s}`) : true)) {
    const boardPath = path.join(root, 'examples/shot-recipes', slug === 'annotated' ? 'annotated-image' : 'scene-narrative', 'storyboard.json'), project = path.dirname(boardPath);
    const board = StoryboardSchema.parse(JSON.parse(fs.readFileSync(boardPath)));
    const visual = checkVisualInput(board);
    const errors = [...checkStoryboardInput(board, {storyboardPath: boardPath, styleRoot: path.join(root, 'styles'), executionMode: 'fast'}).filter(i => i.severity === 'error').map(i => i.message), ...checkAssetInput(boardPath), ...[...visual.safeArea.issues, ...visual.textLayout].filter(i => i.severity === 'error').map(i => i.message)];
    if (errors.length) throw new Error(`${slug}: ${errors.join('; ')}`);
    const video = path.join(out, `${slug}.mp4`), cover = path.join(out, `${slug}.png`);
    if (fs.existsSync(video) && !force) assertProductionLock(board, video, undefined, project);
    else {
      const style = StylePackSchema.parse(JSON.parse(fs.readFileSync(path.join(root, 'styles', board.style.id, 'style.json'))));
      const motion = MotionPackSchema.parse(JSON.parse(fs.readFileSync(path.join(root, 'styles', board.style.id, 'motion.json'))));
      const resolved = resolveProductionLock(board, root, project), layout = layoutCollector(board);
      const profile = {purpose: 'visual-preview', showReviewMarker: false, publicSample: true, layoutCheckFrames: layout.frames,
        productionLockHash: resolved.lock.hash, productionLock: resolved.lock, resolvedShotPlan: resolved.plans};
      const inputProps = {storyboard: hydrateLibraryAssets(board, boardPath), styleTokens: createStyleTokens(style, motion, board.project.width, board.project.height, board.font, board.palette), renderProfile: profile};
      const composition = (await getCompositions(serveUrl, {inputProps, puppeteerInstance: browser})).find(c => c.id === 'StoryboardV2');
      if (!composition) throw new Error('Missing controlled composition');
      let last = -1;
      await renderToVerifiedOutput({outputPath: video, outputRoot: out, force, profile,
        artifactSuffixes: ['.production/resolved-shot-plan.json', '.production/production-lock.json'],
        prepareArtifacts: async temporary => writeProductionLock(board, productionDirectory(temporary), resolved),
        render: temporary => renderMedia({serveUrl, composition, inputProps, puppeteerInstance: browser, codec: 'h264', muted: true, audioCodec: null,
          outputLocation: temporary, concurrency: 2, crf: 20, onBrowserLog: layout.onBrowserLog, logLevel: 'error', onProgress: ({progress}) => {
            const bucket = Math.floor(progress * 10); if (bucket !== last) {last = bucket; console.log(`${slug} ${bucket * 10}%`);}
          }}),
        verify: temporary => {profile.layoutQa = layout.finish(); inspectOutput(temporary, board); if (resolveProductionLock(board, root, project).lock.hash !== resolved.lock.hash) throw new Error('Public sample inputs changed during rendering');}
      });
    }
    if (!fs.existsSync(cover) || force) await renderCover(boardPath, video, cover, {force});
    const qa = spawnSync(process.execPath, ['--import', 'tsx/esm', path.join(root, 'scripts/qa-storyboard.mjs'), boardPath, video, path.join(out, `${slug}-review`), '--mode', 'fast', '--output-purpose', 'visual-preview'], {cwd: root, stdio: 'inherit'});
    if (qa.error || qa.status !== 0) throw new Error(`Public sample QA failed: ${slug}`);
  }
} finally {await browser.close({silent: true});}
