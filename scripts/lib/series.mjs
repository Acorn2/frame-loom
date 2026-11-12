import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {BrandConfigSchema, BrandSchema} from '../../src/branding/config.ts';
import {splitCaptionCues, splitCaptionWindow} from '../../src/audio/captions.ts';
import {getSceneTimeline} from '../../src/timeline/scene-timeline.ts';
import {assertProjectOutput, writeProjectFile, writeProjectJson} from './project-files.mjs';
import {OUTPUT_PURPOSES} from './output-purpose.mjs';

const text = z.string().regex(/\S/u);
const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
const ref = z.object({id, version: text}).strict();
const relative = text.refine(value => !path.isAbsolute(value) && !value.includes('\\') &&
  value.split('/').every(part => part && part !== '.' && part !== '..'), '需要系列目录内的相对文件路径');
export const SeriesSchema = z.object({
  schemaVersion: z.literal('1.0'), id, version: text, style: ref, font: ref, brand: BrandSchema,
  drawingGuide: text, fixedEnding: text.max(10000),
  characters: z.array(z.object({
    id, path: relative, source: text, sourceFile: relative.optional(), license: text, intendedUse: text
  }).strict())
}).strict();
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const local = (root, name) => assertProjectOutput(root, path.join(root, name));
const json = value => JSON.stringify(value, null, 2) + '\n';
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const characterPath = role => 'assets/series/' + role.id + path.extname(role.path).toLowerCase();
const sourcePath = role => role.sourceFile && 'source/series/' + role.sourceFile;
const logoPath = 'assets/series-brand/logo.png';
const episodeFile = 'episode.json';
const lockFile = 'series-lock.json';

function roleAsset(role) {
  return {id: role.id, type: 'image', usage: 'scene-media', path: characterPath(role),
    source: role.source + (role.sourceFile ? ' · ' + sourcePath(role) : ''), license: role.license, intendedUse: role.intendedUse};
}
function brandConfig(series) {
  const brand = {...series.brand};
  if (brand.logo) brand.logo = {...brand.logo, path: logoPath};
  return {schemaVersion: '1.0', brand};
}

// Read bytes once. The hash and the published episode always describe the same copy.
export function loadSeries(input) {
  const file = fs.statSync(input).isDirectory() ? path.join(input, 'series.json') : input;
  const root = fs.realpathSync(path.dirname(path.resolve(file)));
  const series = SeriesSchema.parse(readJson(local(root, path.basename(file))));
  const files = new Map();
  function collect(from, to) {
    relative.parse(from);
    if (files.has(to)) return;
    const source = local(root, from);
    if (fs.statSync(source).size > 64 * 1024 * 1024) throw new Error('系列文件超过 64 MiB：' + from);
    const bytes = fs.readFileSync(source);
    if (!bytes.length) throw new Error('系列文件为空：' + from);
    files.set(to, bytes);
  }
  const ids = new Set();
  for (const role of series.characters) {
    if (ids.has(role.id)) throw new Error('系列角色 ID 重复：' + role.id);
    ids.add(role.id);
    if (!/\.(png|jpe?g|gif|webp|svg)$/iu.test(role.path)) throw new Error('不支持的角色素材格式：' + role.path);
    collect(role.path, characterPath(role));
    if (role.sourceFile) collect(role.sourceFile, sourcePath(role));
  }
  if (series.brand.logo) collect(series.brand.logo.path, logoPath);
  const lock = {schemaVersion: '1.0', series, files: [...files].map(([name, bytes]) => ({path: name, sha256: sha(bytes)}))};
  return {lock, files};
}

export function writeEpisode(root, bundle, purpose) {
  const {series} = bundle.lock;
  for (const [name, bytes] of bundle.files) writeProjectFile(root, local(root, name), bytes, {overwrite: false});
  writeProjectFile(root, local(root, lockFile), json(bundle.lock), {overwrite: false});
  writeProjectJson(root, local(root, episodeFile), {schemaVersion: '1.0', seriesFingerprint: sha(json(bundle.lock)), outputPurpose: purpose});
  writeProjectJson(root, local(root, 'config.json'), brandConfig(series));
  writeProjectJson(root, local(root, 'asset-manifest.json'), {schemaVersion: '1.0', assets: series.characters.map(roleAsset)});
}

export function episodeFiles(root) {
  if (!fs.lstatSync(path.join(root, lockFile), {throwIfNoEntry: false})) {
    // Historical productions may have an unrelated episode.json.
    if (!fs.existsSync(path.join(root, episodeFile))) return [];
    const file = local(root, episodeFile);
    let info;
    try {info = readJson(file);} catch {return [];}
    if (!info?.seriesFingerprint) return [];
  }
  return [episodeFile, lockFile].map(name => local(root, name));
}

export function readEpisode(root) {
  const [episodePath, lockPath] = episodeFiles(root);
  if (!episodePath) return null;
  const episode = readJson(episodePath);
  const raw = fs.readFileSync(lockPath);
  if (episode.schemaVersion !== '1.0' || !OUTPUT_PURPOSES.includes(episode.outputPurpose) ||
    episode.seriesFingerprint !== sha(raw)) throw new Error('本期用途或系列快照指纹无效。');
  const lock = JSON.parse(raw);
  return {...episode, series: lock.series, files: lock.files};
}

export function endingScene(series) {
  return {id: 'series-ending', title: '系列固定结尾', kind: 'statement', narration: series.fixedEnding,
    source: 'series-lock.json · fixedEnding', visualIntent: '用系列收尾画面配合告别。', takeaway: '听清系列的固定结语。'};
}

export function checkEnding(scenes, ending) {
  const words = scenes.map(scene => scene.narration).join('\n\n');
  if (!words.endsWith(ending) || words.indexOf(ending) !== words.lastIndexOf(ending)) throw new Error('系列固定结尾须逐字保留一次，并位于旁白末尾。');
}

export function checkEpisodeInputs(root, board, adopted) {
  const {series, files} = adopted;
  for (const key of ['style', 'font']) {
    if (board[key]?.id !== series[key].id || board[key]?.version !== series[key].version) throw new Error('分镜与本期系列快照不一致：' + key);
  }
  const brand = BrandConfigSchema.parse(readJson(local(root, 'config.json')));
  if (json(brand) !== json(BrandConfigSchema.parse(brandConfig(series)))) throw new Error('本期品牌与系列快照不一致。');
  const assets = readJson(local(root, 'asset-manifest.json')).assets;
  for (const role of series.characters) {
    const entry = assets.find(asset => asset.id === role.id);
    if (!entry || Object.entries(roleAsset(role)).some(([key, value]) => entry[key] !== value)) throw new Error('本期角色登记或来源不一致：' + role.id);
  }
  for (const item of files) {
    if (sha(fs.readFileSync(local(root, item.path))) !== item.sha256) throw new Error('系列文件字节已变化：' + item.path);
  }
  checkEnding(board.scenes, series.fixedEnding);
}

// External recordings require playback review. Here we check the actual subtitle
// source used by the composition, including its time window at the end of the video.
export function checkEpisodeCaptions(root, board, cues) {
  const adopted = readEpisode(root);
  if (!adopted) return;
  const timeline = getSceneTimeline(board);
  const ending = adopted.series.fixedEnding;
  let index = timeline.length - 1;
  let tail = timeline[index].scene.narration;
  while (index > 0 && tail.length < ending.length) tail = timeline[--index].scene.narration + '\n\n' + tail;
  const fps = board.project.fps;
  const timed = cues.length ? splitCaptionCues(cues) : timeline.flatMap(({scene, startFrame}) =>
    scene.captions.flatMap(cue => splitCaptionWindow(cue.text, cue.start, cue.end))
      .map(cue => ({startSec: (startFrame + cue.start) / fps, endSec: (startFrame + cue.end) / fps, text: cue.text})));
  let nextFrame = timeline[index].startFrame;
  const shown = timed.filter(cue => {
    const start = Math.max(nextFrame, Math.ceil(cue.startSec * fps));
    const end = Math.min(board.project.durationFrames, Math.ceil(cue.endSec * fps));
    if (start >= end) return false;
    nextFrame = end;
    return true;
  });
  const spoken = value => value.replace(/[\s\p{P}]/gu, '');
  if (!spoken(shown.map(cue => cue.text).join('')).endsWith(spoken(ending))) throw new Error('有声版的片尾字幕缺少系列固定结尾，请核对实际字幕与时码。');
}
