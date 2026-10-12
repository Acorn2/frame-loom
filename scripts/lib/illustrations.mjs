import fs from 'node:fs';
import {Buffer} from 'node:buffer';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {IllustrationPlanSchema, IllustrationGuideSchema} from '../../src/schemas/illustration.ts';
import {ProjectInputSchema} from '../../src/schemas/project-input.ts';
import {AssetManifestSchema} from '../../src/schemas/asset-manifest.ts';
import {projectRoot} from './style-catalog.mjs';

export const hash = value => createHash('sha256').update(value).digest('hex');
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
export function localFile(directory, relative) {
  if (path.isAbsolute(relative)) throw new Error('素材引用必须是项目内相对路径。');
  const target = path.resolve(directory, relative), root = fs.realpathSync(directory);
  const inside = candidate => {const r = path.relative(root, candidate); return r && r !== '..' && !r.startsWith(`..${path.sep}`) && !path.isAbsolute(r);};
  if (!inside(target) || (fs.existsSync(target) && !inside(fs.realpathSync(target)))) throw new Error('素材路径不能逃出项目目录。');
  // Existing symlinked parent directories must not redirect a future output.
  let parent = path.dirname(target);
  while (!fs.existsSync(parent)) parent = path.dirname(parent);
  if (parent !== root && !inside(fs.realpathSync(parent))) throw new Error('素材目录不能逃出项目目录。');
  return target;
}
export function illustrationContext(directory) {
  const root = fs.realpathSync(directory);
  const input = ProjectInputSchema.parse(json(path.join(root, 'project-input.json')));
  if (input.inputMode !== 'document' || input.illustrationPolicy !== 'generated-subjects-v1') throw new Error('生图只用于显式启用 generated-subjects-v1 的纯文档路线；截图路线不自动生图。');
  const plan = IllustrationPlanSchema.parse(json(path.join(root, 'illustration-plan.json')));
  const guide = IllustrationGuideSchema.parse(json(path.join(projectRoot, 'styles', plan.style.id, 'illustration.json')));
  if (guide.style.version !== plan.style.version) throw new Error('插画规范版本不匹配。');
  let fingerprint = JSON.stringify({plan, guide});
  for (const asset of plan.assets) for (const reference of asset.references ?? []) {
    const file = localFile(root, reference);
    if (!fs.statSync(file).isFile()) throw new Error('参考图必须为本地文件。');
    fingerprint += reference + hash(fs.readFileSync(file));
  }
  const planHash = hash(fingerprint);
  const prompts = plan.assets.map(asset => {
    localFile(root, asset.path);
    let assetFingerprint = JSON.stringify({style: plan.style, guide, asset});
    for (const reference of asset.references ?? []) assetFingerprint += reference + hash(fs.readFileSync(localFile(root, reference)));
    const prompt = [
      'Use case: illustration-story. Asset type: an independent transparent subject for a narrated explainer video.',
      `Subject: ${asset.subject}`, `Style: ${guide.subjectPrompt}`, `Palette: ${guide.palette.join(', ')}.`,
      'Keep the entire subject intact with generous clear margin. Use a genuinely transparent background.',
      'No text, letters, numbers, logos, watermark, captions, arrows, labels or surrounding slide. Text and relationships will be rendered separately.',
      asset.references?.length ? 'Use supplied references for drawing style and consistent subject appearance; do not copy their text or background.' : ''
    ].filter(Boolean).join('\n');
    return {...asset, prompt, promptHash: hash(prompt), planHash: hash(assetFingerprint)};
  });
  return {root, plan, guide, planHash, prompts};
}
export function prepareIllustrations(directory) {
  const context = illustrationContext(directory);
  if (!context.plan.assets.length) throw new Error('先按原文填写 illustration-plan.json，空计划不能当作生图完成。');
  const output = {schemaVersion: '1.0', tool: 'imagegen', style: context.plan.style, planHash: context.planHash, assets: context.prompts};
  const file = path.join(context.root, 'illustration-prompts.json');
  fs.writeFileSync(file, `${JSON.stringify(output, null, 2)}\n`);
  return file;
}
export function inspectIllustration(file) {
  const bytes = fs.readFileSync(file);
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('插画产物必须为 PNG。');
  const result = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height,pix_fmt', '-of', 'json', file], {encoding: 'utf8'});
  if (result.status !== 0) throw new Error('无法解码插画产物。');
  const stream = JSON.parse(result.stdout).streams?.[0];
  if (!stream || Math.min(stream.width, stream.height) < 256) throw new Error('插画尺寸不足 256px。');
  // Read the actual alpha plane; an RGBA file can still have an opaque backdrop.
  const alpha = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', 'alphaextract,scale=64:64', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'gray', 'pipe:1'], {maxBuffer: 1024 * 1024});
  if (alpha.status !== 0 || alpha.stdout.length !== 4096 || !alpha.stdout.some(value => value < 16) || !alpha.stdout.some(value => value > 200)) throw new Error('素材需要真实透明背景与可见主体，请通过生图工具调整后再登记。');
  return {width: stream.width, height: stream.height, fileHash: hash(bytes)};
}
export function registerIllustration(directory, id, sourceFile, reviewer) {
  if (!reviewer?.trim()) throw new Error('登记前需要实际查看图片，并提供 --reviewer。');
  const context = illustrationContext(directory), asset = context.prompts.find(item => item.id === id);
  if (!asset) throw new Error(`未知素材：${id}`);
  const prepared = json(path.join(context.root, 'illustration-prompts.json'));
  if (prepared.planHash !== context.planHash || prepared.assets.find(item => item.id === id)?.promptHash !== asset.promptHash) throw new Error('素材计划或规范已改变，请重新 prepare:illustrations 并生图。');
  const image = inspectIllustration(sourceFile), target = localFile(context.root, asset.path);
  const manifestFile = path.join(context.root, 'asset-manifest.json');
  const manifest = AssetManifestSchema.parse(json(manifestFile));
  if (manifest.assets.some(item => item.id === id || item.path === asset.path)) throw new Error('已登记素材不能覆盖；请使用新 ID 和新路径。');
  if (fs.existsSync(target) && path.resolve(sourceFile) !== target) throw new Error('目标素材已存在，未覆盖。');
  fs.mkdirSync(path.dirname(target), {recursive: true});
  if (path.resolve(sourceFile) !== target) fs.copyFileSync(sourceFile, target, fs.constants.COPYFILE_EXCL);
  manifest.assets.push({id, path: asset.path, type: 'image', usage: 'scene-media',
    source: `AI-generated illustration; imagegen; illustration-plan.json#${id}; source claim: ${asset.sourceClaim}`,
    license: 'AI-generated output; use subject to image provider terms; not a factual photograph or official interface', intendedUse: asset.purpose,
    generation: {tool: 'imagegen', style: context.plan.style, planId: id, planHash: asset.planHash, promptHash: asset.promptHash, fileHash: image.fileHash,
      review: {reviewer: reviewer.trim(), reviewedAt: new Date().toISOString()}}});
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  return target;
}
export function generatedAssetIssues(directory, storyboard, manifest, input) {
  const generated = manifest.assets.filter(asset => asset.generation), issues = [];
  if (!generated.length) return issues;
  let context;
  try {context = illustrationContext(directory);} catch (error) {return [`插画来源：${error.message}`];}
  if (storyboard.style.id !== context.plan.style.id || storyboard.style.version !== context.plan.style.version) issues.push('生成素材与分镜风格不匹配，请重新生成或明确改用来源素材路线。');
  for (const asset of generated) {
    const prompt = context.prompts.find(item => item.id === asset.generation.planId), generation = asset.generation;
    if (!prompt || prompt.path !== asset.path || asset.id !== prompt.id || generation.planHash !== prompt?.planHash || generation.promptHash !== prompt.promptHash
      || generation.style.id !== context.plan.style.id || generation.style.version !== context.plan.style.version) issues.push(`插画计划、提示词或风格指纹不匹配：${asset.id}`);
    try {if (hash(fs.readFileSync(localFile(directory, asset.path))) !== generation.fileHash) issues.push(`插画字节已改变：${asset.id}`);} catch (error) {issues.push(`插画来源：${error.message}`);}
    if (asset.type !== 'image' || asset.usage !== 'scene-media') issues.push(`生成插画不能作为截图或产品配色证据：${asset.id}`);
  }
  if (input?.inputMode !== 'document') issues.push('截图路线不得自动使用生成插画。');
  return issues;
}

export function illustrationFiles(directory) {
  if (!fs.existsSync(path.join(directory, 'illustration-plan.json'))) return [];
  const context = illustrationContext(directory);
  return [path.join(context.root, 'project-input.json'), path.join(context.root, 'illustration-plan.json'), path.join(context.root, 'illustration-prompts.json'),
    path.join(projectRoot, 'styles', context.plan.style.id, 'illustration.json'),
    ...context.plan.assets.flatMap(asset => (asset.references ?? []).map(reference => localFile(context.root, reference)))];
}
