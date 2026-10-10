import {CHAPTER_TRANSITIONS, ChapterManifestSchema} from '../../src/shots/shortlist/chapter-transitions.tsx';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {StoryboardSchema} from '../../src/schemas/storyboard.ts';
import {compileStoryboardShots} from '../../src/shots/compile-shot.ts';
import {sceneAuxiliaries, AuxiliaryManifestSchema} from '../../src/shots/auxiliary-catalog.ts';
import {assertTemplateCompatibility} from '../../src/video-templates/resolve-template.ts';
import {ShotManifestSchema} from '../../src/schemas/shot-recipe.ts';
import {VideoTemplateSchema} from '../../src/schemas/video-template.ts';
import {verifyFontAssets} from '../../src/fonts/assets.ts';
import {resolvePaletteEvidence} from './project-palette.mjs';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}
export const hashValue = (value) => createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
function files(directory) {
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? files(file) : entry.isFile() ? [file] : [];
  });
}
function fileHash(file) {return createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function manifestFile(root, directory, id, version, name) {
  const current = path.join(root, directory, id, `${name}.json`);
  return JSON.parse(fs.readFileSync(current, 'utf8')).version === version ? current : path.join(root, directory, id, 'history', `${version}.${name}.json`);
}
export function resolveProductionLock(input, root = defaultRoot, projectPath) {
  if (input?.schemaVersion !== '2.4') return undefined;
  const storyboard = StoryboardSchema.parse(input);
  assertTemplateCompatibility(storyboard);
  const plans = compileStoryboardShots(storyboard);
  const selected = [...new Map([...(storyboard.shotRecipes ?? []), ...storyboard.scenes.map((scene) => scene.shot)].map((shot) => [shot.id, shot])).values()].sort((a, b) => a.id.localeCompare(b.id));
  const shots = selected.map(({id, version}) => {
    const manifestPath = manifestFile(root, 'shots', id, version, 'manifest');
    const manifest = ShotManifestSchema.parse(JSON.parse(fs.readFileSync(manifestPath, 'utf8')));
    if (manifest.id !== id || manifest.version !== version) throw new Error('所选配方清单与精确版本不一致。');
    return {id, version, manifestHash: fileHash(manifestPath), provenanceHash: fileHash(path.join(root, 'shots', id, 'provenance.json'))};
  });
  let template = null;
  if (storyboard.videoTemplate) {
    const file = manifestFile(root, 'video-templates', storyboard.videoTemplate.id, storyboard.videoTemplate.version, 'template');
    const manifest = VideoTemplateSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')));
    if (manifest.id !== storyboard.videoTemplate.id || manifest.version !== storyboard.videoTemplate.version) throw new Error('视频模板精确版本不一致。');
    template = {...storyboard.videoTemplate, manifestHash: fileHash(file)};
  }
  const rendererScripts = ['scripts/render-storyboard.mjs', 'scripts/lib/audio-runtime.mjs', 'scripts/lib/output-purpose.mjs', 'scripts/lib/verified-render-output.mjs', 'scripts/lib/render-receipt.mjs', 'scripts/lib/layout-qa.mjs'];
  const runtime = [...files(path.join(root, 'src')), ...rendererScripts.map((name) => path.join(root, name)), path.join(root, 'package-lock.json'), path.join(root, 'tsconfig.json')].sort().map((file) => [path.relative(root, file), fileHash(file)]);
  const style = {...storyboard.style, contentHash: hashValue(['style.json', 'motion.json'].map((name) => fileHash(path.join(root, 'styles', storyboard.style.id, name))))};
  const font = storyboard.font ? verifyFontAssets(storyboard.font, root) : undefined;
  const palette = resolvePaletteEvidence(storyboard.palette, projectPath);
  const auxiliaries = [...new Map(storyboard.scenes.flatMap(sceneAuxiliaries).map((recipe) => [recipe.id, recipe])).values()].map(({id, version}) => {
    const file = manifestFile(root, 'shots', id, version, 'manifest');
    const manifest = AuxiliaryManifestSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')));
    if (manifest.id !== id || manifest.version !== version) throw new Error('宿主动作精确版本不一致。');
    return {id, version, manifestHash: fileHash(file), provenanceHash: fileHash(path.join(root, 'shots', id, 'provenance.json'))};
  });
  const transitions = CHAPTER_TRANSITIONS.filter((recipe) => storyboard.scenes.some((scene) => scene.transitionIn?.type === recipe.type)).map(({id, version}) => {
    const file = manifestFile(root, 'shots', id, version, 'manifest');
    const manifest = ChapterManifestSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')));
    if (manifest.id !== id || manifest.version !== version) throw new Error('换章配方精确版本不一致。');
    return {id, version, manifestHash: fileHash(file), provenanceHash: fileHash(path.join(root, 'shots', id, 'provenance.json'))};
  });
  const lock = {transitions, schemaVersion: '1.0', template, style, ...(font ? {font: {id: font.id, version: font.version, manifestHash: fileHash(path.join(root, 'fonts/font-index.json')), faces: font.faces.map(({file, sha256}) => ({file, sha256})), licenseSha256: font.licenseSha256}} : {}), shots, auxiliaries, rendererBuildHash: hashValue(runtime), storyboardHash: hashValue(storyboard), planHash: hashValue(plans)};
  if (palette) lock.palette = palette;
  return {lock: {...lock, hash: hashValue(lock)}, plans};
}
export const productionDirectory = (videoPath) => `${videoPath}.production`;
export function writeProductionLock(storyboard, directory, resolved = resolveProductionLock(storyboard)) {
  if (!resolved) return undefined;
  fs.mkdirSync(directory, {recursive: true});
  fs.writeFileSync(path.join(directory, 'resolved-shot-plan.json'), `${JSON.stringify(resolved.plans, null, 2)}\n`);
  fs.writeFileSync(path.join(directory, 'production-lock.json'), `${JSON.stringify(resolved.lock, null, 2)}\n`);
  return resolved.lock;
}
export function assertProductionLock(storyboard, videoPath, directory = productionDirectory(videoPath), projectPath) {
  const expected = resolveProductionLock(storyboard, defaultRoot, projectPath);
  if (!expected) return undefined;
  const lock = JSON.parse(fs.readFileSync(path.join(directory, 'production-lock.json'), 'utf8'));
  const plans = JSON.parse(fs.readFileSync(path.join(directory, 'resolved-shot-plan.json'), 'utf8'));
  const receipt = JSON.parse(fs.readFileSync(`${videoPath}.render.json`, 'utf8'));
  const videoFingerprint = createHash('sha256').update(path.basename(videoPath)).update('\0').update(fs.readFileSync(videoPath)).update('\0').digest('hex');
  if (receipt.videoFingerprint !== videoFingerprint) throw new Error('生产锁的渲染记录与视频字节不一致。');
  if (hashValue(lock) !== hashValue(expected.lock) || hashValue(plans) !== expected.lock.planHash || receipt.profile?.productionLockHash !== expected.lock.hash || hashValue(receipt.profile?.productionLock) !== hashValue(expected.lock) || hashValue(receipt.profile?.resolvedShotPlan) !== expected.lock.planHash) throw new Error('生产锁、解析计划、渲染记录与当前输入不一致，请重新渲染。');
  return expected.lock;
}
