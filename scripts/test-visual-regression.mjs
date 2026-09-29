import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {runQa} from './qa-storyboard.mjs';

export const VISUAL_FIXTURES = [
  {
    id: 'article-video',
    storyboardPath: 'examples/article-video/storyboard.json',
    style: 'retro-zine',
    orientation: 'landscape',
    templates: ['statement', 'graph-explainer']
  },
  {
    id: 'product-demo',
    storyboardPath: 'examples/product-demo/storyboard.json',
    style: 'retro-windows',
    orientation: 'landscape',
    templates: ['statement', 'interaction-flow']
  },
  {
    id: 'data-explainer',
    storyboardPath: 'examples/data-explainer/storyboard.json',
    style: 'scatterbrain',
    orientation: 'portrait',
    templates: ['statement', 'metric-grid']
  }
];

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const keepOutputs = process.argv.includes('--keep');
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-loom-visual-regression-'));

function run(command, args) {
  const result = spawnSync(command, args, {cwd: projectRoot, encoding: 'utf8', stdio: 'inherit'});
  if (result.error?.code === 'ENOENT') throw new Error(`找不到 ${command}。`);
  if (result.status !== 0) throw new Error(`${command} 执行失败，退出码：${result.status ?? 'unknown'}`);
}

export function assertVisualCoverage(results) {
  const styles = new Set(results.map((item) => item.style));
  const templates = new Set(results.flatMap((item) => item.templates));
  const orientations = new Set(results.map((item) => item.orientation));
  const missing = {
    styles: ['retro-zine', 'retro-windows', 'scatterbrain'].filter((item) => !styles.has(item)),
    templates: ['statement', 'graph-explainer', 'metric-grid', 'interaction-flow'].filter((item) => !templates.has(item)),
    orientations: ['landscape', 'portrait'].filter((item) => !orientations.has(item))
  };
  if (Object.values(missing).some((items) => items.length > 0)) {
    throw new Error(`视觉回归覆盖不足：${JSON.stringify(missing)}`);
  }
  return {
    styles: [...styles].sort(),
    templates: [...templates].sort(),
    orientations: [...orientations].sort()
  };
}

try {
  const results = [];
  for (const fixture of VISUAL_FIXTURES) {
    const storyboardPath = path.join(projectRoot, fixture.storyboardPath);
    const outputPath = path.join(temporaryRoot, `${fixture.id}.mp4`);
    const reviewDir = path.join(temporaryRoot, `${fixture.id}-review`);

    run(process.execPath, [
      '--import',
      'tsx/esm',
      'scripts/render-storyboard.mjs',
      storyboardPath,
      outputPath,
      '--mode',
      'fast'
    ]);

    const qa = runQa({storyboardPath, videoPath: outputPath, reviewDir});
    if (!qa.report.automatedPassed) throw new Error(`视觉回归 QA 未通过：${qa.reportPath}`);
    if (qa.report.mode !== 'silent-preview') throw new Error(`视觉回归必须是静音预览：${fixture.id}`);

    const reviewManifestPath = path.join(reviewDir, 'review-frames.json');
    const reviewManifest = JSON.parse(fs.readFileSync(reviewManifestPath, 'utf8'));
    if (reviewManifest.frames.length < 6) {
      throw new Error(`视觉回归代表帧不足：${fixture.id} (${reviewManifest.frames.length})`);
    }
    for (const frame of reviewManifest.frames) {
      const framePath = path.join(reviewDir, frame.file);
      if (!fs.existsSync(framePath) || fs.statSync(framePath).size === 0) {
        throw new Error(`视觉回归代表帧为空：${framePath}`);
      }
    }

    results.push({
      id: fixture.id,
      style: fixture.style,
      orientation: fixture.orientation,
      templates: fixture.templates,
      frames: reviewManifest.frames.length,
      contactSheet: reviewManifest.contactSheet
    });
  }

  const coverage = assertVisualCoverage(results);
  console.log(`VISUAL REGRESSION PASS ${JSON.stringify({coverage, fixtures: results}, null, 2)}`);
  if (keepOutputs) console.log(`VISUAL REGRESSION OUTPUT ${temporaryRoot}`);
} finally {
  if (!keepOutputs) fs.rmSync(temporaryRoot, {recursive: true, force: true});
}
