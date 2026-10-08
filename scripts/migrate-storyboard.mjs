import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {StoryboardSchema} from '../src/schemas/storyboard.ts';
import {validateStoryboard} from '../src/validation/storyboard-validator.ts';

export function migrateStoryboard(input) {
  const source = StoryboardSchema.parse(input);
  if (source.schemaVersion !== '2.3') throw new Error('显式迁移目前支持 2.3；2.1/2.2 的语义需人工重新编排，原渲染入口继续保留。');
  const board = structuredClone(source);
  const changes = [];
  board.schemaVersion = '2.4';
  board.project.status = 'generated';
  for (const scene of board.scenes) {
    scene.shot = {id: 'semantic-default', version: '1.0.0', slots: {}};
    if (scene.visual?.shotPattern === 'document-conclusion-deal') {
      const sourceId = scene.visual.anchorId;
      const items = scene.layers.filter((layer) => layer.id !== sourceId && ['node', 'card'].includes(layer.type)).map((layer) => layer.id);
      scene.shot = {id: 'document-conclusions', version: '1.2.0', slots: {source: sourceId, items}};
      delete scene.visual.shotPattern;
      const entry = scene.beats.find((beat) => beat.target === sourceId && ['enter', 'reveal'].includes(beat.action));
      if (!entry) throw new Error(`${scene.id}: 缺少来源入场，请人工补充后迁移。`);
      const fps = board.project.fps;
      const start = entry.start + entry.duration + Math.ceil(fps * 0.3);
      const dock = {id: `${scene.id}-source-dock`, target: sourceId, action: 'dock', start, duration: Math.ceil(fps * 0.6)};
      const earliestItem = Math.min(...scene.beats.filter((beat) => items.includes(beat.target) || scene.connections.some((link) => link.id === beat.target)).map((beat) => beat.start));
      const offset = Math.max(0, dock.start + dock.duration - earliestItem);
      for (const beat of scene.beats) if (items.includes(beat.target) || scene.connections.some((link) => link.id === beat.target)) beat.start += offset;
      if (scene.beats.some((beat) => beat.id === dock.id)) throw new Error('迁移新增 dock 的 beat ID 冲突。');
      scene.beats.push(dock);
      changes.push({sceneId: scene.id, from: 'document-conclusion-deal', to: scene.shot.id, addedBeat: dock, itemOffsetFrames: offset});
    } else changes.push({sceneId: scene.id, to: 'semantic-default', reason: '保留语义构图，未自动重选镜头'});
  }
  const issues = validateStoryboard(board, {executionMode: 'fast'});
  if (issues.some((item) => item.severity === 'error')) throw new Error(`迁移后的约束冲突，请调整时间/槽位：${issues.filter((item) => item.severity === 'error').map((item) => item.message).join('；')}`);
  return {storyboard: board, report: {schemaVersion: '1.0', sourceVersion: source.schemaVersion, targetVersion: '2.4', approvalInherited: false, narrationChanged: false, changes, issues}};
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const [input, output, extra] = process.argv.slice(2);
  if (!input || !output || extra) throw new Error('Usage: npm run migrate:storyboard -- <old.json> <new.json>');
  const sourcePath = path.resolve(input);
  const destination = path.resolve(output);
  const reportPath = `${destination}.migration.json`;
  if (sourcePath === destination || fs.existsSync(destination) || fs.existsSync(reportPath)) throw new Error('源文件/已存在的输出不覆盖。');
  const result = migrateStoryboard(JSON.parse(fs.readFileSync(sourcePath, 'utf8')));
  fs.mkdirSync(path.dirname(destination), {recursive: true});
  fs.writeFileSync(destination, `${JSON.stringify(result.storyboard, null, 2)}\n`, {flag: 'wx'});
  fs.writeFileSync(reportPath, `${JSON.stringify({...result.report, source: sourcePath, output: destination}, null, 2)}\n`, {flag: 'wx'});
  console.log(`MIGRATED ${destination}\nREPORT ${reportPath}; approval not inherited`);
}
