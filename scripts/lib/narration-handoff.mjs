import fs from 'node:fs';
import path from 'node:path';
import {fingerprintFiles} from './input-fingerprint.mjs';

function normalize(text) {
  return text.normalize('NFKC').replace(/\s+/gu, '').replace(/[|`*_>]/gu, '');
}

export function buildNarrationHandoff(projectPath, storyboard) {
  const scriptPath = path.join(projectPath, 'script.md');
  if (!fs.existsSync(scriptPath)) throw new Error('缺少 script.md，不能交付稳定讲稿。');
  const sourceText = fs.readFileSync(scriptPath, 'utf8');
  const source = normalize(sourceText);
  const scenes = storyboard.scenes.map((scene) => {
    const narration = scene.narration.trim();
    if (!narration) throw new Error(`镜头 ${scene.id} 缺少 narration，不能交付供配音的讲稿。`);
    if (!sourceText.includes(scene.id)) throw new Error(`script.md 缺少镜头编号 ${scene.id}。`);
    if (!source.includes(normalize(narration))) {
      throw new Error(`script.md 与镜头 ${scene.id} 的 narration 不一致；请先同步同一版讲稿。`);
    }
    return {id: scene.id, title: scene.title, narration};
  });
  return {
    schemaVersion: '1.0',
    storyboardFingerprint: fingerprintFiles([path.join(projectPath, 'storyboard.json')], projectPath),
    scriptFingerprint: fingerprintFiles([scriptPath], projectPath),
    scenes
  };
}

export function writeNarrationHandoff(projectPath, storyboard, directory, force = false) {
  const handoff = buildNarrationHandoff(projectPath, storyboard);
  fs.mkdirSync(directory, {recursive: true});
  const manifestPath = path.join(directory, 'narration-manifest.json');
  if (fs.existsSync(manifestPath) && !force) {
    const prior = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (prior.storyboardFingerprint !== handoff.storyboardFingerprint || prior.scriptFingerprint !== handoff.scriptFingerprint || JSON.stringify(prior.scenes) !== JSON.stringify(handoff.scenes)) {
      throw new Error(`讲稿交接版本已存在且内容不同，未覆盖：${directory}`);
    }
  }
  const markdownPath = path.join(directory, 'narration-script.md');
  const lines = [
    `# ${storyboard.project.title} · 配音讲稿`,
    '',
    `版本指纹：${handoff.storyboardFingerprint}`,
    '',
    ...handoff.scenes.flatMap((scene) => [`## ${scene.id} · ${scene.title}`, '', scene.narration, ''])
  ];
  fs.writeFileSync(markdownPath, `${lines.join('\n')}\n`);
  fs.writeFileSync(manifestPath, `${JSON.stringify(handoff, null, 2)}\n`);
  return {markdownPath, manifestPath, handoff};
}

export function assertNarrationMatchesHandoff(projectPath, storyboard, manifestPath) {
  if (!fs.existsSync(manifestPath)) return;
  const previous = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const current = buildNarrationHandoff(projectPath, storyboard);
  if (previous.scriptFingerprint !== current.scriptFingerprint || JSON.stringify(previous.scenes.map(({id, narration}) => ({id, narration}))) !== JSON.stringify(current.scenes.map(({id, narration}) => ({id, narration})))) {
    throw new Error('当前讲稿与交给外部配音的版本不同；请核对音频对应的讲稿版本后再继续。');
  }
}
