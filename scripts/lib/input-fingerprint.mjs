import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function collectFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(entryPath);
    return entry.isFile() ? [entryPath] : [];
  });
}

export function fingerprintFiles(files, basePath) {
  const hash = createHash('sha256');
  for (const filePath of [...new Set(files)].sort()) {
    hash.update(path.relative(basePath, filePath));
    hash.update('\0');
    hash.update(fs.existsSync(filePath) ? fs.readFileSync(filePath) : '<missing>');
    hash.update('\0');
  }
  return hash.digest('hex');
}

export function fingerprintProjectInputs(projectPath, styleRoot, audioConfigPath, ttsConfigPath, options = {}) {
  const includeAudio = options.includeAudio !== false;
  const inputNames = [
    'project-input.json', 'production-brief.md', 'route-card.md', 'content-gaps.md', 'asset-gaps.md', 'visual-sources.md', 'shot-map.md', 'content-brief.md', 'script.md',
    'storyboard.draft.json', 'storyboard.json', 'asset-manifest.json', 'visual-handoff.json'
  ];
  const files = inputNames.map((name) => path.join(projectPath, name));
  for (const directory of includeAudio ? ['source', 'assets', 'audio'] : ['source', 'assets']) {
    files.push(...collectFiles(path.join(projectPath, directory)));
  }
  const configuredAudio = audioConfigPath ? path.resolve(audioConfigPath) : path.join(projectPath, 'audio', 'audio-config.json');
  if (includeAudio && fs.existsSync(configuredAudio)) {
    files.push(configuredAudio);
    try {
      const config = JSON.parse(fs.readFileSync(configuredAudio, 'utf8'));
      for (const item of [config.voiceover, config.music, config.captions, ...(config.sfx ?? [])]) {
        if (item?.enabled && typeof item.path === 'string') {
          files.push(path.resolve(path.dirname(configuredAudio), item.path));
        }
      }
    } catch {
      // The audio config validator reports malformed JSON.
    }
  }
  const configuredTts = ttsConfigPath
    ? path.resolve(ttsConfigPath)
    : path.join(projectPath, 'audio', 'tts-config.json');
  if (includeAudio && fs.existsSync(configuredTts)) files.push(configuredTts);
  const storyboardPath = path.join(projectPath, 'storyboard.json');
  const draftPath = path.join(projectPath, 'storyboard.draft.json');
  const selectedPath = fs.existsSync(storyboardPath) ? storyboardPath : draftPath;
  if (fs.existsSync(selectedPath)) {
    try {
      const styleId = JSON.parse(fs.readFileSync(selectedPath, 'utf8')).style?.id;
      if (typeof styleId === 'string' && /^[a-z0-9-]+$/.test(styleId)) {
        files.push(path.join(styleRoot, 'style-index.json'));
        files.push(path.join(styleRoot, styleId, 'style.json'));
        files.push(path.join(styleRoot, styleId, 'motion.json'));
      }
    } catch {
      // The regular storyboard validator reports malformed JSON.
    }
  }
  return fingerprintFiles(files, projectPath);
}
