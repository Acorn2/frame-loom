import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, describe, expect, it} from 'vitest';
import sampleStoryboard from '../examples/article-video/storyboard.json' with {type: 'json'};
import dataStoryboard from '../examples/data-explainer/storyboard.json' with {type: 'json'};
import productStoryboard from '../examples/product-demo/storyboard.json' with {type: 'json'};
import {validateStoryboard} from '../src/validation/storyboard-validator.js';
import type {Storyboard} from '../src/schemas/storyboard.js';
import {getSceneTimeline, getTimelineDuration} from '../src/timeline/scene-timeline.js';
import {getNodeState} from '../src/renderer/node-state.js';

const styleRoot = path.resolve(process.cwd(), 'styles');
const example = sampleStoryboard as unknown as Storyboard;
const temporaryStyleRoots: string[] = [];

afterEach(() => {
  for (const directory of temporaryStyleRoots.splice(0)) {
    fs.rmSync(directory, {recursive: true, force: true});
  }
});

function copyStyleRoot() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-loom-style-'));
  fs.cpSync(styleRoot, directory, {recursive: true});
  temporaryStyleRoots.push(directory);
  return directory;
}

describe('validateStoryboard', () => {
  it('accepts the reviewed article example', () => {
    expect(validateStoryboard(example, {
      storyboardPath: path.resolve('examples/article-video/storyboard.json'),
      styleRoot
    })).toEqual([]);
  });

  it.each([
    ['product demo', productStoryboard, 'examples/product-demo/storyboard.json'],
    ['data explainer', dataStoryboard, 'examples/data-explainer/storyboard.json']
  ])('accepts the reviewed %s example', (_name, storyboard, storyboardPath) => {
    expect(validateStoryboard(storyboard as unknown as Storyboard, {
      storyboardPath: path.resolve(storyboardPath),
      styleRoot
    })).toEqual([]);
  });

  it('rejects a draft storyboard for rendering', () => {
    const draft = structuredClone(example);
    draft.project.status = 'draft';
    const issues = validateStoryboard(draft);
    expect(issues.some((item) => item.path === 'project.status')).toBe(true);
  });

  it('accepts generated and validated storyboard states only in fast mode', () => {
    const generated = structuredClone(example);
    generated.project.status = 'generated';
    expect(validateStoryboard(generated).some((item) => item.path === 'project.status')).toBe(true);
    expect(validateStoryboard(generated, {executionMode: 'fast'}).some((item) => item.path === 'project.status')).toBe(false);

    const validated = structuredClone(example);
    validated.project.status = 'validated';
    expect(validateStoryboard(validated, {executionMode: 'fast'}).some((item) => item.path === 'project.status')).toBe(false);
  });

  it('returns structural issues instead of throwing for a malformed scene', () => {
    const invalid = structuredClone(example) as unknown as Record<string, unknown>;
    const scenes = invalid.scenes as Array<Record<string, unknown>>;
    delete scenes[0]?.layers;
    expect(() => validateStoryboard(invalid)).not.toThrow();
    expect(validateStoryboard(invalid).some((item) => item.path.includes('layers'))).toBe(true);
  });

  it('rejects an unknown beat target and out-of-range beat', () => {
    const invalid = structuredClone(example);
    const firstScene = invalid.scenes[0];
    if (!firstScene) throw new Error('fixture missing first scene');
    const firstBeat = firstScene.beats[0];
    if (!firstBeat) throw new Error('fixture missing first beat');
    firstBeat.target = 'missing-layer';
    firstBeat.start = 170;
    const issues = validateStoryboard(invalid);
    expect(issues.some((item) => item.message.includes('不存在'))).toBe(true);
    expect(issues.some((item) => item.message.includes('当前 scene 内'))).toBe(true);
  });

  it('rejects inconsistent project duration', () => {
    const invalid = structuredClone(example);
    invalid.project.durationFrames = 601;
    const issues = validateStoryboard(invalid);
    expect(issues.some((item) => item.path === 'project.durationFrames')).toBe(true);
    expect(issues.some((item) => item.path === 'scenes')).toBe(true);
  });

  it('rejects an empty screenshot asset', () => {
    const invalid = structuredClone(example);
    const firstScene = invalid.scenes[0];
    if (!firstScene) throw new Error('fixture missing first scene');
    firstScene.layers.push({
      id: 'empty-shot',
      type: 'screenshot',
      asset: 'missing.png'
    });
    const issues = validateStoryboard(invalid, {
      storyboardPath: path.resolve('examples/article-video/storyboard.json')
    });
    expect(issues.some((item) => item.message.includes('asset 不存在或为空'))).toBe(true);
  });

  it('rejects storyboard capabilities missing from the selected Style Pack', () => {
    const invalid = structuredClone(example);
    const firstScene = invalid.scenes[0];
    if (!firstScene) throw new Error('fixture missing first scene');
    const firstLayer = firstScene.layers[0];
    const firstBeat = firstScene.beats[0];
    if (!firstLayer || !firstBeat || !firstScene.transitionOut) throw new Error('fixture missing capability coverage');

    const temporaryStyleRoot = copyStyleRoot();
    const stylePath = path.join(temporaryStyleRoot, 'retro-zine', 'style.json');
    const style = JSON.parse(fs.readFileSync(stylePath, 'utf8'));
    style.supports.layers = style.supports.layers.filter((type: string) => type !== firstLayer.type);
    style.supports.actions = style.supports.actions.filter((action: string) => action !== firstBeat.action);
    style.supports.transitions = style.supports.transitions.filter((transition: string) => transition !== firstScene.transitionOut);
    fs.writeFileSync(stylePath, `${JSON.stringify(style, null, 2)}\n`);

    const issues = validateStoryboard(invalid, {
      storyboardPath: path.resolve('examples/article-video/storyboard.json'),
      styleRoot: temporaryStyleRoot
    });
    expect(issues.some((item) => item.message.includes('不支持 layer type'))).toBe(true);
    expect(issues.some((item) => item.message.includes('不支持 action'))).toBe(true);
    expect(issues.some((item) => item.message.includes('不支持 transition'))).toBe(true);
  });

  it('warns when long narration has no valid visual target', () => {
    const invalid = structuredClone(example);
    const firstScene = invalid.scenes[0];
    if (!firstScene) throw new Error('fixture missing first scene');
    firstScene.narration = '这是一段足够长的旁白，用来验证当 scene 没有任何有效视觉目标时，映射检查能够提醒生产者补充可见变化。'.repeat(2);
    firstScene.beats = [];
    firstScene.captions = [];

    const issues = validateStoryboard(invalid);
    expect(issues.some((item) => item.message.includes('较长 narration') && item.severity === 'warning')).toBe(true);
  });

  it('warns when a caption does not overlap any beat', () => {
    const invalid = structuredClone(example);
    const firstScene = invalid.scenes[0];
    if (!firstScene) throw new Error('fixture missing first scene');
    const caption = firstScene.captions[0];
    if (!caption) throw new Error('fixture missing caption');
    caption.start = 120;
    caption.end = 170;
    firstScene.beats = firstScene.beats.map((beat) => ({...beat, start: 0}));

    const issues = validateStoryboard(invalid);
    expect(issues.some((item) => item.message.includes(`caption "${caption.id}"`) && item.message.includes('没有与任何 beat 重叠'))).toBe(true);
  });

  it('warns when an important content layer is never touched by a beat', () => {
    const invalid = structuredClone(example);
    const firstScene = invalid.scenes[0];
    if (!firstScene) throw new Error('fixture missing first scene');
    firstScene.layers.push({
      id: 'unanimated-card',
      type: 'card',
      text: '未触达内容'
    });

    const issues = validateStoryboard(invalid);
    expect(issues.some((item) => item.message.includes('内容 layer 未被任何 beat 触达') && item.message.includes('unanimated-card'))).toBe(true);
  });

  it('keeps legacy timing and computes explicit scene overlaps', () => {
    expect(getTimelineDuration(example)).toBe(600);
    const overlapped = structuredClone(example);
    overlapped.scenes[1]!.transitionIn = {type: 'overlap-fade', durationFrames: 15};
    overlapped.scenes[2]!.transitionIn = {type: 'overlap-slide', durationFrames: 15};
    overlapped.project.durationFrames = 570;
    overlapped.project.durationSec = 19;
    expect(getSceneTimeline(overlapped).map((item) => item.startFrame)).toEqual([0, 165, 390]);
    expect(getTimelineDuration(overlapped)).toBe(570);
    expect(validateStoryboard(overlapped).filter((item) => item.severity === 'error')).toEqual([]);
    overlapped.project.durationFrames = 600;
    expect(validateStoryboard(overlapped).some((item) => item.path === 'scenes')).toBe(true);
  });

  it('rejects a final beat that leaves too little stable outro time', () => {
    const invalid = structuredClone(example);
    const finalScene = invalid.scenes.at(-1)!;
    finalScene.outro = {holdFrames: 30, fadeFrames: 18};
    finalScene.beats.at(-1)!.start = 150;
    finalScene.beats.at(-1)!.duration = 20;
    expect(validateStoryboard(invalid).some((item) => item.path.includes('outro') && item.message.includes('稳定画面'))).toBe(true);
  });

  it('rejects simultaneous current nodes and computes node state from beats', () => {
    const invalid = structuredClone(example);
    const scene = invalid.scenes[1]!;
    const nodes = scene.layers.filter((layer) => layer.type === 'node').slice(0, 2);
    expect(nodes).toHaveLength(2);
    for (const node of nodes) {
      scene.beats.push({id: `current-${node.id}`, target: node.id, action: 'set-state', state: 'current', start: 30, duration: 1});
    }
    expect(getNodeState(nodes[0]!, scene, 29)).not.toBe('current');
    expect(getNodeState(nodes[0]!, scene, 30)).toBe('current');
    expect(validateStoryboard(invalid).some((item) => item.message.includes('多个 current 节点'))).toBe(true);
  });

  it('requires an object asset and a callout target', () => {
    const invalid = structuredClone(example);
    const scene = invalid.scenes[0]!;
    scene.layers.push({id: 'subject', type: 'object'});
    scene.layers.push({id: 'detail', type: 'callout', target: 'missing'});
    const issues = validateStoryboard(invalid);
    expect(issues.some((item) => item.message.includes('object 必须声明'))).toBe(true);
    expect(issues.some((item) => item.message.includes('callout.target'))).toBe(true);
  });
});
