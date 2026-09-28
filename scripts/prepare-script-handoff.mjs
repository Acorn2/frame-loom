import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {StoryboardSchema} from '../src/schemas/storyboard.ts';
import {checkAssetInput, checkStoryboardInput, checkVisualInput} from './lib/preflight.mjs';
import {assertStoryboardApproval} from './lib/storyboard-approval.mjs';
import {writeNarrationHandoff} from './lib/narration-handoff.mjs';

export function prepareScriptHandoff(projectDirectory, executionMode = 'fast') {
  if (!['fast', 'review'].includes(executionMode)) throw new Error('--mode 只能是 fast 或 review。');
  const projectPath = path.resolve(projectDirectory);
  const storyboardPath = path.join(projectPath, 'storyboard.json');
  if (!fs.existsSync(storyboardPath) && executionMode === 'fast') {
    const draftPath = path.join(projectPath, 'storyboard.draft.json');
    const draft = StoryboardSchema.parse(JSON.parse(fs.readFileSync(draftPath, 'utf8')));
    const promoted = draft.project.status === 'draft' ? {...draft, project: {...draft.project, status: 'generated'}} : draft;
    fs.writeFileSync(storyboardPath, `${JSON.stringify(promoted, null, 2)}\n`);
  }
  const storyboard = StoryboardSchema.parse(JSON.parse(fs.readFileSync(storyboardPath, 'utf8')));
  if (executionMode === 'review') assertStoryboardApproval(projectPath);
  const styleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'styles');
  const issues = checkStoryboardInput(storyboard, {storyboardPath, styleRoot, executionMode});
  const assets = checkAssetInput(storyboardPath);
  const visual = checkVisualInput(storyboard);
  const errors = [
    ...issues.filter((issue) => issue.severity === 'error').map((issue) => `${issue.path}: ${issue.message}`),
    ...assets,
    ...visual.safeArea.issues.filter((issue) => issue.severity === 'error').map((issue) => `scene ${issue.sceneId}: ${issue.message}`),
    ...visual.textLayout.filter((issue) => issue.severity === 'error').map((issue) => `scene ${issue.sceneId}: ${issue.message}`)
  ];
  if (errors.length > 0) throw new Error(errors.join('\n'));
  const runPath = path.join(projectPath, 'run.json');
  if (fs.existsSync(runPath)) {
    const existing = JSON.parse(fs.readFileSync(runPath, 'utf8'));
    if (existing.artifacts?.video) throw new Error('已有视频生产记录；请保留现有 run.json，使用新项目或先明确后续路线。');
  }
  const outputDir = path.join(projectPath, 'output', 'script-handoff');
  const result = writeNarrationHandoff(projectPath, storyboard, outputDir);
  const run = {
    schemaVersion: '1.0', projectId: path.basename(projectPath), projectPath,
    executionMode, outputPurpose: 'script-handoff', status: 'completed', deliveryStatus: 'script-ready',
    startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    stages: {storyboard: 'completed', validation: 'completed', assets: 'completed', safeArea: 'completed', render: 'pending', qa: 'pending'},
    artifacts: {storyboard: 'storyboard.json', narrationScript: path.relative(projectPath, result.markdownPath), narrationManifest: path.relative(projectPath, result.manifestPath)},
    warnings: issues.filter((issue) => issue.severity === 'warning').map((issue) => `${issue.path}: ${issue.message}`), errors: []
  };
  fs.writeFileSync(runPath, `${JSON.stringify(run, null, 2)}\n`);
  return result;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const [projectPath, modeFlag, modeValue] = process.argv.slice(2);
  if (!projectPath || (modeFlag && modeFlag !== '--mode') || (modeFlag && !modeValue)) {
    console.error('Usage: npm run prepare:script-handoff -- <project-dir> [--mode fast|review]'); process.exit(1);
  }
  try { console.log(`SCRIPT READY ${prepareScriptHandoff(projectPath, modeValue ?? 'fast').markdownPath}`); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); }
}
