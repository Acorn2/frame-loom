import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, expect, it} from 'vitest';
import {initProject} from '../scripts/init-project.mjs';
import {checkEpisodeInputs, readEpisode, checkEnding, checkEpisodeCaptions} from '../scripts/lib/series.mjs';
import {readScenePlan, scenePlanEvidence} from '../scripts/lib/scene-plan.mjs';
import {workflowStatus} from '../scripts/workflow-status.mjs';

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const example = path.resolve('examples/whiteboard-original');
let temp, source, profile;
beforeEach(() => {
  temp = fs.mkdtempSync(path.join(os.tmpdir(), 'loom-series-'));
  source = path.join(temp, 'series');
  fs.mkdirSync(source);
  fs.cpSync(path.join(example, 'assets'), path.join(source, 'assets'), {recursive: true});
  fs.copyFileSync(path.join(example, 'asset-manifest.json'), path.join(source, 'asset-manifest.json'));
  profile = readJson(path.join(example, 'series.json'));
});
afterEach(() => fs.rmSync(temp, {recursive: true, force: true}));
function create(name, purpose = 'visual-master', extra = []) {
  fs.writeFileSync(path.join(source, 'series.json'), JSON.stringify(profile));
  return initProject([name, '--series', source, '--projects-dir', temp, '--output-purpose', purpose, ...extra]);
}
function snapshotBoard(project) {
  return {...readJson(path.join(project, 'storyboard.draft.json')), scenes: readScenePlan(project).scenes};
}

it('pins two episodes independently, including source bytes, character art, logo and exact closing', () => {
  const role = profile.characters[0];
  profile.brand.logo = {path: role.path, source: '隔离验收图标', license: role.license};
  profile.fixedEnding = '先说完本期。\n\n我们下期见。';
  const first = create('first', 'in-project-video');
  const v1 = readEpisode(first);
  expect(workflowStatus(first)).toMatchObject({file: path.join(fs.realpathSync(first), 'scene-plan.json'), owner: 'Agent'});
  expect(v1.outputPurpose).toBe('in-project-video');
  expect(readJson(path.join(first, 'config.json')).brand.logo.path).toBe('assets/series-brand/logo.png');
  expect(fs.readFileSync(path.join(first, 'script.md'), 'utf8').split(profile.fixedEnding)).toHaveLength(2);
  const manifest = readJson(path.join(first, 'asset-manifest.json'));
  const pinned = path.join(first, manifest.assets[0].path);
  const proof = path.join(first, 'source/series', role.sourceFile);
  const original = fs.readFileSync(pinned);
  expect(fs.readFileSync(proof)).toEqual(fs.readFileSync(path.join(source, role.sourceFile)));
  expect(scenePlanEvidence(first)).toContain(proof);
  fs.copyFileSync(path.resolve('examples/illustrated-video/flat-explainer/assets/curious-family.png'), path.join(source, role.path));
  fs.writeFileSync(path.join(source, role.sourceFile), 'updated evidence');
  role.source = '新版公开示意'; profile.version = '2';
  const second = create('second');
  fs.renameSync(source, path.join(temp, 'offline'));
  const v2 = readEpisode(second);
  expect(v2.outputPurpose).toBe('visual-master');
  expect(v2.seriesFingerprint).not.toBe(v1.seriesFingerprint);
  expect(fs.readFileSync(pinned)).toEqual(original);
  expect(fs.readFileSync(path.join(second, manifest.assets[0].path))).not.toEqual(original);
  expect(readEpisode(first)).toEqual(v1);
  for (const episode of [first,second]) checkEpisodeInputs(episode,snapshotBoard(episode),readEpisode(episode));
  fs.writeFileSync(proof,'changed locally');
  expect(() => checkEpisodeInputs(first,snapshotBoard(first),v1)).toThrow(/系列文件字节/);
});

it('rejects missing inputs and inconsistent versions before publishing the episode', () => {
  expect(() => create('bad-purpose','auto')).toThrow(/本期用途/);
  expect(() => create('bad-font','visual-master',['--font','missing'])).toThrow(/字体/);
  profile.style.version = 'stale';
  expect(() => create('bad-style')).toThrow(/画法/);
  profile.characters[0].path = '../outside.png';
  expect(() => create('bad-path')).toThrow(/相对文件路径/);
  expect(fs.readdirSync(temp)).toEqual(['series']);
});

it('checks the adopted ending on export and in the actual caption source, allowing punctuation at cue boundaries', () => {
  profile.fixedEnding = '先试一步。\n\n我们下次见。';
  const project = create('closing','in-project-video');
  const board = {project:{fps:30,durationFrames:180},scenes:[
    {narration:'本期内容。',durationFrames:90,captions:[]},
    {narration:profile.fixedEnding,durationFrames:90,captions:[{text:profile.fixedEnding,start:0,end:90}]}
  ]};
  expect(() => checkEnding([{narration:'先试一步。'},{narration:'我们下次见。'}],profile.fixedEnding)).not.toThrow();
  expect(() => checkEpisodeCaptions(project,board,[])).not.toThrow();
  const cues = [{startSec:3,endSec:4,text:'先试一步'}, {startSec:4,endSec:6,text:'我们下次见'}];
  expect(() => checkEpisodeCaptions(project,board,cues)).not.toThrow();
  expect(() => checkEpisodeCaptions(project,board,cues.slice(0,1))).toThrow(/字幕/);
  expect(() => checkEpisodeCaptions(project,board,[{startSec:0,endSec:2,text:profile.fixedEnding}])).toThrow(/时码/);
  for (const narration of [profile.fixedEnding + '还有下集。',profile.fixedEnding + profile.fixedEnding]) {
    const plan = readJson(path.join(project,'scene-plan.json'));
    plan.scenes[0].narration = narration;
    fs.writeFileSync(path.join(project,'scene-plan.json'),JSON.stringify(plan));
    expect(() => readScenePlan(project)).toThrow(/旁白末尾/);
  }
});
