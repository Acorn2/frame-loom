import fs from 'node:fs';
import path from 'node:path';
import {getSceneTimeline} from '../../src/timeline/scene-timeline.ts';
import {parseCaptions, splitCaptionCues, splitCaptionWindow} from '../../src/audio/captions.ts';
import {hashValue} from './production-lock.mjs';

export function reviewTimeline(project, board, route) {
  const fps = board.project.fps;
  const audio = route.audio && JSON.parse(fs.readFileSync(route.audio, 'utf8'));
  const external = audio?.captions?.enabled
    ? splitCaptionCues(parseCaptions(fs.readFileSync(path.resolve(path.dirname(route.audio), audio.captions.path), 'utf8')))
    : [];
  const manifest = route.audioMode === 'tts'
    ? JSON.parse(fs.readFileSync(path.join(project, 'audio/audio-manifest.json'), 'utf8'))
    : null;
  const scenes = getSceneTimeline(board).map(({scene, startFrame, endFrame}) => {
    const segment = manifest?.segments.find(item => item.sceneId === scene.id);
    let captions = [];
    if (route.purpose !== 'visual-master') {
      // SRT rounds to milliseconds. Match the frames actually visible in the
      // composition, so a rounded cut cannot leak the next cue into this scene.
      captions = external.length
        ? external.filter(cue => Math.max(startFrame, Math.ceil(cue.startSec * fps)) < Math.min(endFrame, Math.ceil(cue.endSec * fps)))
        : (scene.captions ?? []).flatMap(cue => splitCaptionWindow(cue.text, cue.start, cue.end))
          .map(cue => ({startSec: (startFrame + cue.start) / fps, endSec: (startFrame + cue.end) / fps, text: cue.text}));
    }
    return {id: scene.id, start: startFrame / fps, end: endFrame / fps, narration: scene.narration,
      captions, speechSeconds: segment?.durationSec ?? null};
  });
  let captionSource = '分镜字幕时码';
  if (route.purpose === 'visual-master') captionSource = '底片不显示字幕';
  else if (external.length) captionSource = manifest ? '配音字幕 · ' + (manifest.captionTimingSource ?? '未标注') : '外部字幕文件时码';
  return {scenes, seconds: board.project.durationFrames / fps, captionSource};
}

export function timingImpact(before, after) {
  const original = new Map(before.scenes.map(scene => [scene.id, scene]));
  const revised = new Map(after.scenes.map(scene => [scene.id, scene]));
  const changes = [];
  for (const id of new Set([...original.keys(), ...revised.keys()])) {
    const old = original.get(id) ?? null;
    const next = revised.get(id) ?? null;
    if (hashValue(old) !== hashValue(next)) changes.push({id, old, next});
  }
  return {beforeSeconds: before.seconds, afterSeconds: after.seconds,
    beforeSource: before.captionSource, afterSource: after.captionSource, changes};
}

export function groupQaIssues(report, scenes) {
  const groups = new Map();
  for (const [check, result] of Object.entries(report.checks ?? {})) {
    for (const item of result?.issues ?? []) {
      const message = typeof item === 'string' ? item : item.message ?? '';
      const scene = item.sceneId ?? scenes.find(s => item.path?.startsWith('scene ' + s.id + '.') || item.path?.includes('[' + s.id + ']'))?.id ?? '全片';
      const rule = item.code ?? item.rule ?? item.path ?? message;
      const key = JSON.stringify([scene, rule]);
      if (!groups.has(key)) groups.set(key, {scene, rule, entries: []});
      groups.get(key).entries.push({check, message, frame: Number.isInteger(item.frame) ? item.frame : null, evidence: item});
    }
  }
  return [...groups.values()].map(group => ({...group,
    frames: [...new Set(group.entries.map(entry => entry.frame).filter(frame => frame !== null))].sort((a, b) => a - b)}));
}
