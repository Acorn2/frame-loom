import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {afterEach, beforeEach, expect, it} from 'vitest';
import {locateFrame, changeFeedback, feedbackStatus, readFeedback, versionOf} from '../scripts/lib/review-feedback.mjs';
import {fingerprintFiles, fingerprintProjectInputs} from '../scripts/lib/input-fingerprint.mjs';
import {createReviewServer} from '../scripts/review-player.mjs';

let root;
beforeEach(() => {root = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-loom-feedback-'));});
afterEach(() => {fs.rmSync(root, {force: true, recursive: true});});
const original = {version: 'old.image1', fps: 30, frames: 90, scenes: [
  {id: 'a', title: '第一场', start: 0, end: 60}, {id: 'b', title: '第二场', start: 50, end: 90}
]};
const run = {inputFingerprint: 'new', outputFingerprint: 'image2'};
const revised = {version: versionOf(run), fps: 30, frames: 120, scenes: [
  {...original.scenes[0], end: 70}, {...original.scenes[1], start: 70, end: 120}
]};
const production = {stage: '已生成', owner: '创作者', file: 'new.mp4'};
const add = () => ({version: original.version, id: randomUUID(), seconds: 1.8, type: 'add', note: '转场时标签重叠'});

it('locates both layers of an overlap, cuts and the terminal playhead', () => {
  expect(locateFrame(original, 1.8).scenes.map(s => s.id)).toEqual(['a', 'b']);
  expect(locateFrame(original, 2).scenes.map(s => s.id)).toEqual(['b']);
  expect(locateFrame(original, 3).frame).toBe(89);
  for (const seconds of [NaN, -1, 3.1, '2']) expect(() => locateFrame(original, seconds)).toThrow();
});

it('keeps immutable original positions, supports retries and hands the retimed revision to its reviewer', () => {
  const action = add();
  changeFeedback(root, original, action);
  changeFeedback(root, original, action);
  expect(readFeedback(root)).toHaveLength(1);
  expect(readFeedback(root)[0].scenes.map(s => s.localFrame)).toEqual([54, 4]);
  expect(() => changeFeedback(root, revised, action)).toThrow(/换版/);
  expect(feedbackStatus(root, run, production).owner).toBe('Agent');
  const submit = {id: action.id, type: 'revision', version: revised.version};
  expect(() => changeFeedback(root, original, {...submit, version: original.version})).toThrow(/新版/);
  changeFeedback(root, revised, submit);
  changeFeedback(root, revised, submit);
  expect(readFeedback(root)[0].revisions[0].scenes[1].start).toBe(70);
  expect(feedbackStatus(root, run, production)).toMatchObject({owner: '创作者', file: 'new.mp4'});
  changeFeedback(root, revised, {...submit, type: 'changes', note: '还需要放大'});
  expect(feedbackStatus(root, run, production).next).toContain('还需要放大');
  expect(() => changeFeedback(root, revised, submit)).toThrow();
  const next = {...revised, version: 'edit.image3', scenes: [{id: 'newScene', start: 0, end: 120}]};
  expect(() => changeFeedback(root, next, {...submit, version: next.version})).toThrow(/显式/);
  changeFeedback(root, next, {...submit, version: next.version, scene: 'newScene'});
  changeFeedback(root, next, {...submit, version: next.version, type: 'accepted'});
  expect(feedbackStatus(root, run, production)).toEqual(production);
  expect(readFeedback(root)[0].revisions).toHaveLength(2);
});

it('rejects cross-origin writes without touching a project', async () => {
  const server = createReviewServer(root);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = 'http://127.0.0.1:' + server.address().port;
    const result = await globalThis.fetch(url + '/feedback', {method: 'POST', headers: {Origin: 'https://example.com', 'Content-Type': 'application/json'}, body: '{}'});
    expect(result.status).toBe(403);
    expect((await globalThis.fetch(url + '/run.json')).status).toBe(404);
    expect(fs.readdirSync(root)).toEqual([]);
  } finally {await new Promise(resolve => server.close(resolve));}
});

it('serves only the checked video, saves a timestamp and rejects a stale tab after replacement', async () => {
  const write = (name, value) => fs.writeFileSync(path.join(root, name), JSON.stringify(value));
  const file = path.join(root, 'test.mp4');
  const storyboard = {schemaVersion: '2.3', project: {title: '隔离样片', fps: 30, durationFrames: 90},
    scenes: [{id: 'one', title: '开头', durationFrames: 60}, {id: 'two', title: '结尾', durationFrames: 30}]};
  write('storyboard.json', storyboard);
  const production = {status: 'completed', deliveryStatus: 'preview-only', outputPurpose: 'visual-preview', outputPurposeRequested: 'visual-preview',
    stages: {qa: 'completed'}, artifacts: {video: 'test.mp4', qaReport: 'qa.json'},
    inputFingerprint: fingerprintProjectInputs(root, path.resolve('styles'), null, null, {includeAudio: false})};
  const publish = bytes => {
    fs.writeFileSync(file, bytes);
    write('run.json', {...production, outputFingerprint: fingerprintFiles([file], root)});
    write('qa.json', {video: file, outputPurpose: 'visual-preview', automatedPassed: true, checks: {output: {passed: true}}});
  };
  publish('first version bytes');
  const server = createReviewServer(root);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = 'http://127.0.0.1:' + server.address().port;
    const session = await (await globalThis.fetch(url + '/session')).json();
    const response = await globalThis.fetch(url + '/video/' + session.version, {headers: {Range: 'bytes=0-4'}});
    expect(response.status).toBe(206);
    expect(await response.text()).toBe('first');
    const post = id => globalThis.fetch(url + '/feedback', {method: 'POST', headers: {Origin: url, 'Content-Type': 'application/json'},
      body: JSON.stringify({id, version: session.version, type: 'add', seconds: 2.1, note: '片尾改短'})});
    expect((await post(randomUUID())).status).toBe(200);
    expect(readFeedback(root)[0].scenes[0]).toMatchObject({id: 'two', localFrame: 3});
    publish('second version bytes');
    expect((await post(randomUUID())).status).toBe(409);
    expect(readFeedback(root)).toHaveLength(1);
  } finally {await new Promise(resolve => server.close(resolve));}
});

it('keeps every frame occurrence when many warnings share a scene and rule', async () => {
  const {groupQaIssues} = await import('../scripts/lib/review-impact.mjs');
  const repeated = Array.from({length:143}, (_, i) => ({sceneId:'one',code:'media-small',frame:i % 40,message:'证据 ' + i}));
  const issues = [...repeated, {...repeated[0],sceneId:'two'}, {...repeated[0],code:'text-clipped'}];
  const groups = groupQaIssues({checks:{renderedLayout:{issues}}},[]);
  expect(groups).toHaveLength(3);
  expect(groups[0].frames).toHaveLength(40);
  expect(groups[0].entries.map(entry => entry.evidence)).toEqual(repeated);
});

it('requires the latest clip, current inputs and all feedback decisions before full production', async () => {
  const {clipFile} = await import('../scripts/lib/review-ledger.mjs');
  const {previewInputs, confirmBeforeRender, closeProducedPreviews} = await import('../scripts/lib/preview-gate.mjs');
  const route = {purpose:'visual-preview',audio:null,tts:null};
  const candidate = {...original,basisHash:'test'};
  const action = add();
  changeFeedback(root,candidate,action);
  const clip = {id:randomUUID(),route,inputs:previewInputs(root,route)};
  const file = clipFile(root,clip.id);
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,'isolated clip');
  clip.bytes = fingerprintFiles([file],root);
  const issues = readFeedback(root);
  issues[0].previews = [clip];
  fs.writeFileSync(path.join(root,'review-feedback.json'),JSON.stringify({schemaVersion:'1.0',issues}));
  const decide = {type:'accept-preview',id:action.id,version:candidate.version,clipId:clip.id};
  expect(() => confirmBeforeRender(root)).toThrow(/确认/);
  expect(() => changeFeedback(root,candidate,{...decide,clipId:randomUUID()})).toThrow();
  changeFeedback(root,candidate,decide);
  expect(confirmBeforeRender(root,route)).toEqual([clip.id]);
  expect(() => confirmBeforeRender(root,{...route,purpose:'visual-master'})).toThrow(/用途/);
  fs.writeFileSync(file,'replaced');
  expect(() => confirmBeforeRender(root)).toThrow(/预览文件/);
  fs.writeFileSync(file,'isolated clip');
  fs.writeFileSync(path.join(root,'script.md'),'revised again');
  expect(() => confirmBeforeRender(root)).toThrow(/输入/);
  fs.unlinkSync(path.join(root,'script.md'));
  changeFeedback(root,candidate,add());
  expect(() => confirmBeforeRender(root)).toThrow(/确认/);
  closeProducedPreviews(root,[clip.id],'completed.version');
  expect(readFeedback(root)[0].producedVersion).toBe('completed.version');
  expect(readFeedback(root)[1].producedVersion).toBeUndefined();
});

it('assigns rounded external caption boundaries to visible frames and tracks downstream changes by scene ID', async () => {
  const {reviewTimeline,timingImpact} = await import('../scripts/lib/review-impact.mjs');
  const audio = path.join(root,'audio.json');
  fs.writeFileSync(audio,JSON.stringify({captions:{enabled:true,path:'sub.srt'}}));
  const board = {project:{fps:30,durationFrames:60},scenes:[{id:'one',durationFrames:10},{id:'two',durationFrames:50}]};
  const route = {audio,purpose:'in-project-video'};
  fs.writeFileSync(path.join(root,'sub.srt'),'1\n00:00:00,333 --> 00:00:01,500\n第二场字幕');
  const before = reviewTimeline(root,board,route);
  expect(before.scenes[0].captions).toEqual([]);
  board.scenes[0].durationFrames += 30;
  board.project.durationFrames += 30;
  fs.writeFileSync(path.join(root,'sub.srt'),'1\n00:00:01,333 --> 00:00:02,500\n第二场字幕');
  const diff = timingImpact(before,reviewTimeline(root,board,route)).changes[1];
  expect(diff.id).toBe('two');
  expect(diff.next.start - diff.old.start).toBeCloseTo(1);
  expect(diff.next.captions[0].startSec - diff.old.captions[0].startSec).toBeCloseTo(1);
  expect(reviewTimeline(root,board,{purpose:'visual-master'}).scenes.every(s => !s.captions.length)).toBe(true);
});

it('preserves clip confirmation through fast schema serialization and invalidates an actual narration edit', async () => {
  root = fs.realpathSync(root);
  const {previewInputs, confirmBeforeRender} = await import('../scripts/lib/preview-gate.mjs');
  const {clipFile} = await import('../scripts/lib/review-ledger.mjs');
  const board = JSON.parse(fs.readFileSync(path.resolve('examples/whiteboard-original/storyboard.json'), 'utf8'));
  const storyboard = path.join(root, 'storyboard.json');
  fs.writeFileSync(storyboard, JSON.stringify({...board, project: {...board.project, status: 'generated'}}));
  const route = {purpose: 'visual-preview', audio: null, tts: null};
  const action = add();
  changeFeedback(root, {...original, basisHash: 'isolated'}, action);
  const clip = {id: randomUUID(), route, inputs: previewInputs(root, route)};
  const file = clipFile(root, clip.id);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, 'isolated clip');
  clip.bytes = fingerprintFiles([file], root);
  const issues = readFeedback(root);
  issues[0].previews = [clip];
  fs.writeFileSync(path.join(root, 'review-feedback.json'), JSON.stringify({schemaVersion: '1.0', issues}));
  const {workflowStatus} = await import('../scripts/workflow-status.mjs');
  fs.writeFileSync(path.join(root, 'run.json'), JSON.stringify({status: 'failed', currentStage: 'safeArea', errors: ['前次生产受阻']}));
  expect(workflowStatus(root)).toMatchObject({stage: '等待创作者确认修改镜头', owner: '创作者', file});
  changeFeedback(root, original, {type: 'accept-preview', id: action.id, version: original.version, clipId: clip.id});
  expect(workflowStatus(root)).toMatchObject({stage: '镜头修改已确认', owner: 'Agent'});
  fs.writeFileSync(path.join(root, 'run.json'), JSON.stringify({status: 'blocked', currentStage: 'qa', updatedAt: new Date(Date.now() + 1000).toISOString()}));
  expect(workflowStatus(root)).toMatchObject({stage: '生产受阻 · qa', owner: 'Agent', file: path.join(root, 'run.json')});
  const {StoryboardSchema} = await import('../src/schemas/storyboard.ts');
  const parsed = StoryboardSchema.parse(JSON.parse(fs.readFileSync(storyboard, 'utf8')));
  parsed.project.status = 'validated';
  fs.writeFileSync(storyboard, JSON.stringify(parsed, null, 2));
  expect(confirmBeforeRender(root)).toEqual([clip.id]);
  parsed.scenes[0].narration += '真实改了一句。';
  fs.writeFileSync(storyboard, JSON.stringify(parsed));
  expect(() => confirmBeforeRender(root)).toThrow(/输入已变化/);
});
