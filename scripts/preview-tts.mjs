import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {TtsConfigSchema} from '../src/schemas/tts-config.ts';
import {selectTtsProfile} from './lib/tts-profiles.mjs';
import {synthesizeSpeech, probeAudioDuration} from './lib/tts-provider.mjs';
import {resolveOutputDirectory} from './synthesize-voiceover.mjs';

export function parsePreviewArgs(args) {
  const [project, ...remaining] = args;
  if (!project || project.startsWith('--')) throw new Error('Usage: npm run preview:tts -- <project-dir> [--tts-config <file>] [--text <短句> | --text-file <file>]');
  const options = {projectPath: path.resolve(project)};
  const flags = {'--tts-config': 'configPath', '--text': 'text', '--text-file': 'textFile'};
  for (let index = 0; index < remaining.length; index += 2) {
    const key = flags[remaining[index]];
    const value = remaining[index + 1];
    if (!key || value === undefined || value.startsWith('--') || options[key] !== undefined) throw new Error('试听参数无效、重复或缺少值。');
    options[key] = value;
  }
  if (options.text !== undefined && options.textFile !== undefined) throw new Error('--text 和 --text-file 只能选一个。');
  return options;
}

export async function previewTts(options) {
  const profile = selectTtsProfile(options.projectPath, options.configPath);
  if (!profile) throw new Error('没有可用的 TTS 配置，请先运行 list:tts-profiles。');
  if (profile.provider === 'mock') throw new Error('mock 仅生成测试音调，不能用于音色试听。');
  const config = TtsConfigSchema.parse(JSON.parse(fs.readFileSync(profile.path, 'utf8')));
  const text = options.textFile ? fs.readFileSync(path.resolve(options.textFile), 'utf8').trim()
    : (options.text ?? '你好，这是 FrameLoom 的配音试听。请确认音色、语速和朗读语气。').trim();
  if (!text || text.length > 500) throw new Error('试听文本必须为 1–500 字符；整片合成请使用 synthesize:voiceover。');
  const directory = resolveOutputDirectory(options.projectPath, 'audio/previews');
  fs.mkdirSync(directory, {recursive: true});
  const outputPath = path.join(directory, `tts-${randomUUID()}.${config.format}`);
  await synthesizeSpeech({text, config, outputPath});
  const durationSec = probeAudioDuration(outputPath);
  return {provider: profile.provider, model: profile.model, voiceType: profile.voiceType, outputPath, durationSec};
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try { console.log(JSON.stringify(await previewTts(parsePreviewArgs(process.argv.slice(2))), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
