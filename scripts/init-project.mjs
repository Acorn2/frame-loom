import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {getOption, loadStyleIndex, projectRoot} from './lib/style-catalog.mjs';

const VIDEO_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PROJECT_OPTIONS = new Set(['--slug', '--style', '--canvas', '--input-mode', '--projects-dir']);

function positionalArgs(args) {
  const positional = [];
  for (let index = 0; index < args.length; index += 1) {
    if (PROJECT_OPTIONS.has(args[index])) {
      index += 1;
    } else {
      positional.push(args[index]);
    }
  }
  return positional;
}

function localDateStamp(date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
}

function availableProjectId(projectsDir, slug, date) {
  const base = `${localDateStamp(date)}-${slug}`;
  let videoId = base;
  for (let number = 2; fs.existsSync(path.join(projectsDir, videoId)); number += 1) {
    videoId = `${base}-${String(number).padStart(2, '0')}`;
  }
  return videoId;
}

function write(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), {recursive: true});
  fs.writeFileSync(filePath, value);
}

export function initProject(args = process.argv.slice(2), {now = new Date()} = {}) {
  const slug = getOption(args, '--slug');
  const positional = positionalArgs(args);
  if ((slug && positional.length > 0) || (!slug && positional.length !== 1)) {
    throw new Error('Usage: npm run init:project -- --slug <topic-slug> [--style <id>] [--canvas landscape|portrait] [--input-mode document|document-images] [--projects-dir <path>]\n也可传入一个显式 video-id 以兼容已有流程。');
  }
  const suppliedId = slug ?? positional[0];
  if (!suppliedId || !VIDEO_ID_PATTERN.test(suppliedId) || (slug && /^\d{8}-/.test(slug))) {
    throw new Error('topic-slug / video-id 只能包含小写字母、数字和连字符；--slug 不要包含日期前缀。');
  }

  const styleId = getOption(args, '--style') ?? 'retro-zine';
  const canvas = getOption(args, '--canvas') ?? 'landscape';
  const inputMode = getOption(args, '--input-mode') ?? 'document';
  if (!['landscape', 'portrait'].includes(canvas)) {
    throw new Error('--canvas 只能是 landscape 或 portrait。');
  }
  if (!['document', 'document-images'].includes(inputMode)) {
    throw new Error('--input-mode 只能是 document 或 document-images。');
  }

  const style = loadStyleIndex().styles.find((item) => item.id === styleId);
  if (!style) {
    throw new Error(`未知 Style Pack：${styleId}`);
  }
  if (!style.canvas.includes(canvas)) {
    throw new Error(`Style Pack "${styleId}" 不支持 ${canvas}。`);
  }

  const projectsDir = path.resolve(process.cwd(), getOption(args, '--projects-dir') ?? path.relative(process.cwd(), path.join(projectRoot, 'projects')));
  const videoId = slug ? availableProjectId(projectsDir, slug, now) : suppliedId;
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
  write(path.join(target, 'project-input.json'), `${JSON.stringify({schemaVersion: '1.0', inputMode}, null, 2)}\n`);
  write(path.join(target, 'production-brief.md'), `# Production Brief\n\n- Video ID: ${videoId} (internal; do not ask the creator to provide it)\n- Audience: [infer from source, or mark unspecified]\n- Platform / use: [record only when supplied or supported by source; do not block a first preview]\n- Viewer takeaway: [derive one sentence from supported source claims]\n- Canvas: ${canvas}\n- Style candidate: ${styleId}\n- Duration constraint: [optional user limit; otherwise derive from script, reading time and scene holds]\n- Output purpose: [visual-preview / visual-master / in-project-video / script handoff]\n- Audio route: [silent / selected TTS profile / external voiceover]\n- Input mode: ${inputMode}\n\n## Source boundary\n\nRecord the original document path and which claims need verification. Keep an unchanged copy under source/. ${inputMode === 'document' ? 'This mode uses document-derived text and graphics; no images are required.' : 'This mode uses the document plus local images or screenshots captured from user-provided URLs. Record every visual source before rendering.'}\n\n## Review gates\n\n- [ ] Source and key claims checked against the document\n- [ ] Document route and content gaps checked\n${inputMode === 'document-images' ? '- [ ] Image sources, capture details and intended shots checked\n' : ''}- [ ] Style Pack selected after route\n- [ ] Storyboard approved by creator (review mode only)\n- [ ] Selected output watched in full after automated QA\n`);
  if (inputMode === 'document-images') {
    write(path.join(target, 'visual-sources.md'), '# Visual Sources\n\nList images supplied by the user or webpage URLs the user asked Codex to capture. For each URL, use a browser to save a real screenshot into assets/ before rendering; record the final URL, capture time, viewport and visible state. A URL is not itself a renderable asset. Do not invent a screenshot or claim unverified publication rights.\n\n| Visual ID | Kind: local image / URL screenshot | Original path or URL | Final URL | Local assets/ path | Capture time / viewport / state | Claim and shot | Rights / review state |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n');
  }
  write(path.join(target, 'route-card.md'), '# Route Card\n\nCompare routes supported by the document and selected visual inputs before choosing a visual theme. A style preview is not a project-specific route preview.\n\n| Route ID | What the viewer sees | Document / image support | Trade-off / limit | Decision |\n| --- | --- | --- | --- | --- |\n| R1 | [step diagram, comparison, or evidence-led sequence] | [source sections and optional visual IDs] | [what this route cannot explain] | proposed |\n\n## Selected route\n\n- Route ID: [select after review]\n- Reason: [why the source supports this narrative and these visuals]\n- Representative frame: [path after actual renderer preview; say if only a generic style sample]\n');
  write(path.join(target, 'content-gaps.md'), '# Content Gaps\n\nList unsupported claims or ideas that cannot yet be expressed clearly from the document. If none, state “No unresolved content gaps for the selected route.” Do not request image or audio inputs for the document-only workflow.\n\n| Gap ID | Route / claim / shot | Missing source support or visual explanation | Safe revision | Status |\n| --- | --- | --- | --- | --- |\n| G1 | R1 / C1 / [shot-id] | [specific unsupported fact or unclear relationship] | [narrow the claim or reframe the visual] | open |\n');
  write(path.join(target, 'shot-map.md'), '# Claim → Shot Map\n\nUse stable claim and scene IDs. Record the exact source excerpt, then decide whether the shot explains a difference, order, relationship, change, measured value, or source material. The visual must make that relation visible; an icon beside a sentence is not enough. In document-images mode, name the visual and manifest asset IDs.\n\n| Claim ID | Claim | Source location / excerpt | Review state | Scene ID | Visual kind | What changes on screen | Visual / asset ID |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n| C1 | [one claim] | [source path and exact excerpt] | needs-review | [scene-id] | [compare / sequence / network / change / metric / statement / media] | [visible difference, relation, or state change] | [document-derived diagram or sourced asset] |\n');
  write(path.join(target, 'content-brief.md'), '# Content Brief\n\n## Narrative order\n\n## Claims and evidence\n\nKeep detailed source-to-shot links in shot-map.md.\n\n## Visual targets and exclusions\n');
  write(path.join(target, 'script.md'), '# Script\n\n> Give each scene its final ID and use the exact scene.narration text. Timing is provisional until narration is measured or the picture is locked.\n\n## opening\n\n[Replace with the exact opening narration.]\n');
  write(path.join(target, 'visual-handoff.json'), `${JSON.stringify({schemaVersion: '1.0', facecamRightFraction: 0, subtitleBottomFraction: 0, timelinePolicy: 'picture-locked'}, null, 2)}\n`);
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
  for (const name of ['doubao', 'openai', 'elevenlabs', 'aliyun']) {
    const sourcePath = path.join(projectRoot, 'examples', 'tts-profiles', `${name}.json`);
    const targetName = name === 'doubao' ? 'tts-config.example.json' : `tts-config.${name}.example.json`;
    write(path.join(target, 'audio', targetName), fs.readFileSync(sourcePath));
  }
  write(path.join(target, 'assets/.gitkeep'), '');
  write(path.join(target, 'output/.gitkeep'), '');
  write(path.join(target, 'storyboard.draft.json'), `${JSON.stringify({
    schemaVersion: '2.3',
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
      purpose: 'opening',
      title: 'Replace with the approved opening',
      primaryClaim: 'Replace with the sourced takeaway',
      visual: {kind: 'statement', explanation: 'Replace with the specific visual job', representation: 'diagram'},
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
  console.log(`Next: add a source document${inputMode === 'document-images' ? ' and list local images or user-provided URLs in visual-sources.md' : ''}, compare routes and gaps, map claims to shots, then use SKILL.md to complete the script and storyboard before running produce.`);
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
