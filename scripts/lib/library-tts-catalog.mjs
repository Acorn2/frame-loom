import fs from 'node:fs';
import path from 'node:path';
import {projectRoot} from './style-catalog.mjs';
import {TtsConfigSchema} from '../../src/schemas/tts-config.ts';

// Public preset metadata only. Never inspect projects, environment values or credentials.
export function publicTtsPresets() {
  const names = {doubao: '豆包', openai: 'OpenAI', elevenlabs: 'ElevenLabs', aliyun: '阿里百炼', minimax: 'MiniMax'};
  return Object.entries(names).map(([id, name]) => {
    const config = TtsConfigSchema.parse(JSON.parse(fs.readFileSync(path.join(projectRoot, 'examples/tts-profiles', `${id}.json`), 'utf8')));
    return {id, name, provider: config.provider, model: config.model ?? null,
      voice: config.voiceType ?? null, voiceFromLocalConfig: Boolean(config.voiceTypeEnv)};
  });
}
