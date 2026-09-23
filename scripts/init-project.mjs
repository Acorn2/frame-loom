import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {getOption, loadStyleIndex, projectRoot} from './lib/style-catalog.mjs';

const VIDEO_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function write(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), {recursive: true});
  fs.writeFileSync(filePath, value);
}

export function initProject(args = process.argv.slice(2)) {
  const videoId = args[0];
  if (!videoId || !VIDEO_ID_PATTERN.test(videoId)) {
    throw new Error('Usage: npm run init:project -- <video-id> [--style <id>] [--canvas landscape|portrait] [--projects-dir <path>]\nvideo-id 只能包含小写字母、数字和连字符。');
  }

  const styleId = getOption(args, '--style') ?? 'retro-zine';
  const canvas = getOption(args, '--canvas') ?? 'landscape';
  if (!['landscape', 'portrait'].includes(canvas)) {
    throw new Error('--canvas 只能是 landscape 或 portrait。');
  }

  const style = loadStyleIndex().styles.find((item) => item.id === styleId);
  if (!style) {
    throw new Error(`未知 Style Pack：${styleId}`);
  }
  if (!style.canvas.includes(canvas)) {
    throw new Error(`Style Pack "${styleId}" 不支持 ${canvas}。`);
  }

  const projectsDir = path.resolve(process.cwd(), getOption(args, '--projects-dir') ?? path.relative(process.cwd(), path.join(projectRoot, 'projects')));
  const target = path.join(projectsDir, videoId);
  if (fs.existsSync(target)) {
    throw new Error(`目标项目已存在，未覆盖：${target}`);
  }

  const dimensions = canvas === 'portrait' ? {width: 1080, height: 1920} : {width: 1920, height: 1080};
  fs.mkdirSync(path.join(target, 'source'), {recursive: true});
  fs.mkdirSync(path.join(target, 'assets'), {recursive: true});
  fs.mkdirSync(path.join(target, 'audio'), {recursive: true});
  fs.mkdirSync(path.join(target, 'output'), {recursive: true});
  write(path.join(target, 'source/source.md'), `# ${videoId}\n\n在这里放入原始 Markdown、事实和来源。不要把未经核实的推断写成事实。\n`);
  write(path.join(target, 'production-brief.md'), `# Production Brief\n\n- Video ID: ${videoId}\n- Canvas: ${canvas}\n- Style candidate: ${styleId}\n- Target duration: 20–60 seconds\n- Output: silent visual preview\n\n## Review gates\n\n- [ ] Source and fact boundary reviewed\n- [ ] Style Pack selected\n- [ ] Storyboard draft reviewed\n- [ ] Assets and provenance reviewed\n- [ ] Preview QA completed\n`);
  write(path.join(target, 'content-brief.md'), '# Content Brief\n\n## Audience\n\n## One-sentence outcome\n\n## Claims and evidence\n\n## Visual targets\n');
  write(path.join(target, 'script.md'), '# Script\n\n> Timing is provisional until narration or final captions are measured.\n\n## Hook\n\n## Explanation\n\n## Conclusion\n');
  write(path.join(target, 'asset-manifest.json'), `${JSON.stringify({schemaVersion: '1.0', assets: []}, null, 2)}\n`);
  write(path.join(target, 'audio/audio-config.example.json'), `${JSON.stringify({
    schemaVersion: '1.0',
    voiceover: {enabled: false, path: 'voiceover.mp3', volume: 1, source: 'user-provided', license: 'user-owned'},
    captions: {enabled: false, path: 'captions.srt', format: 'srt', source: 'user-provided'},
    music: {
      enabled: false,
      path: 'music.mp3',
      volume: 0.16,
      source: 'replace-with-source',
      license: 'replace-with-license',
      ducking: {enabled: false, volume: 0.22, attackSec: 0.08, releaseSec: 0.18}
    },
    sfx: []
  }, null, 2)}\n`);
  write(path.join(target, 'assets/.gitkeep'), '');
  write(path.join(target, 'output/.gitkeep'), '');
  write(path.join(target, 'storyboard.draft.json'), `${JSON.stringify({
    schemaVersion: '2.1',
    style: {id: style.id, version: style.version},
    project: {
      title: videoId,
      ...dimensions,
      fps: 30,
      durationSec: 20,
      durationFrames: 600,
      status: 'draft'
    },
    scenes: [{
      id: 'opening',
      template: 'statement',
      title: 'Replace with the approved opening',
      narration: '',
      durationFrames: 600,
      layers: [],
      connections: [],
      beats: [],
      captions: [],
      transitionOut: 'fade'
    }]
  }, null, 2)}\n`);

  console.log(`PROJECT INITIALIZED ${target}`);
  console.log('Next: complete source, content brief and style selection before drafting the final storyboard.');
  return target;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  try {
    initProject();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
