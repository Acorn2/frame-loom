import fs from 'node:fs';
import path from 'node:path';
import {TtsConfigSchema} from '../../src/schemas/tts-config.ts';

export function resolveTtsVoiceType(config) {
  if (!config.voiceTypeEnv) return config.voiceType;
  const voiceType = process.env[config.voiceTypeEnv]?.trim();
  if (!voiceType) throw new Error(`TTS 缺少音色：请设置环境变量 ${config.voiceTypeEnv}。`);
  return voiceType;
}

// Only non-secret environment choices affect the generated voice and reuse identity.
export function ttsEnvironmentSettings(config) {
  return {voiceType: resolveTtsVoiceType(config), ...(config.provider === 'doubao' ? {
    endpoint: config.endpoint ?? process.env.VOLC_TTS_ENDPOINT ?? process.env.DOUBAO_TTS_ENDPOINT,
    resourceId: config.resourceIdEnv ? process.env[config.resourceIdEnv] : process.env.VOLC_TTS_RESOURCE_ID ?? process.env.DOUBAO_TTS_RESOURCE_ID
  } : {})};
}

export function listTtsProfiles(projectPath) {
  return inspectTtsProfiles(projectPath).filter((profile) => profile.enabled && !['invalid', 'disabled'].includes(profile.status));
}

export function inspectTtsProfile(filePath, id = path.basename(filePath, '.json')) {
  const summary = {id, path: filePath, enabled: false, provider: null, voiceType: null, model: null, status: 'invalid', issues: []};
  let raw;
  try { raw = JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return {...summary, issues: ['无法读取配置或 JSON 语法错误。']}; }
  const result = TtsConfigSchema.safeParse(raw);
  if (!result.success) {
    return {...summary, issues: result.error.issues.map((item) => `${item.path.join('.') || 'config'}: ${item.message}`)};
  }
  const config = result.data;
  Object.assign(summary, {enabled: config.enabled, provider: config.provider,
    model: config.model ?? {openai: 'gpt-4o-mini-tts', elevenlabs: 'eleven_multilingual_v2', aliyun: 'qwen3-tts-flash'}[config.provider] ?? null});
  if (!config.enabled) return {...summary, voiceType: config.voiceType ?? null, status: 'disabled'};
  try { summary.voiceType = resolveTtsVoiceType(config); }
  catch { summary.issues.push(`缺少音色环境变量 ${config.voiceTypeEnv}。`); }
  const missing = (name) => { if (!process.env[name]?.trim()) summary.issues.push(`缺少环境变量 ${name}。`); };
  if (config.provider === 'doubao') {
    const endpoint = config.endpoint ?? process.env.VOLC_TTS_ENDPOINT ?? process.env.DOUBAO_TTS_ENDPOINT;
    if (!endpoint) summary.issues.push('缺少 endpoint 或 VOLC_TTS_ENDPOINT。');
    else if (!TtsConfigSchema.safeParse({...config, endpoint}).success) summary.issues.push('endpoint 必须使用服务商官方 HTTPS 域名。');
    if (config.apiVersion === 'v3') {
      if (config.apiKeyEnv) missing(config.apiKeyEnv);
      else if (!(process.env.VOLC_TTS_API_KEY ?? process.env.DOUBAO_TTS_API_KEY)?.trim()) summary.issues.push('缺少 VOLC_TTS_API_KEY。');
      if (config.resourceIdEnv) missing(config.resourceIdEnv);
      else if (!(process.env.VOLC_TTS_RESOURCE_ID ?? process.env.DOUBAO_TTS_RESOURCE_ID)?.trim()) summary.issues.push('缺少 VOLC_TTS_RESOURCE_ID。');
    } else {
      const hasCredential = config.apiKeyEnv ? process.env[config.apiKeyEnv] : process.env.VOLC_TTS_API_KEY ?? process.env.DOUBAO_TTS_API_KEY;
      const accessToken = config.accessTokenEnv ? process.env[config.accessTokenEnv] : process.env.DOUBAO_TTS_ACCESS_TOKEN;
      if (!hasCredential?.trim() && !accessToken?.trim()) summary.issues.push('缺少豆包 API key 或 access token。');
    }
  } else if (config.provider !== 'mock') {
    missing(config.apiKeyEnv ?? {openai: 'OPENAI_API_KEY', elevenlabs: 'ELEVENLABS_API_KEY', aliyun: 'DASHSCOPE_API_KEY'}[config.provider]);
  }
  summary.status = summary.issues.length ? 'needs-environment' : config.provider === 'mock' ? 'test-only' : 'ready';
  return summary;
}

export function inspectTtsProfiles(projectPath) {
  const audioDir = path.join(projectPath, 'audio');
  if (!fs.existsSync(audioDir)) return [];
  const paths = fs.readdirSync(audioDir).filter((name) => /^tts-config(?:\.[a-z0-9-]+)*\.json$/u.test(name)).map((name) => path.join(audioDir, name));
  const profileDir = path.join(audioDir, 'tts-profiles');
  if (fs.existsSync(profileDir)) {
    paths.push(...fs.readdirSync(profileDir).filter((name) => name.endsWith('.json')).map((name) => path.join(profileDir, name)));
  }
  return paths.sort().map((filePath) => inspectTtsProfile(filePath, path.relative(audioDir, filePath).replace(/\.json$/u, '')));
}

export function selectTtsProfile(projectPath, selectedPath) {
  if (selectedPath) {
    const filePath = path.resolve(selectedPath);
    const profile = inspectTtsProfile(filePath);
    if (profile.status === 'disabled') throw new Error(`TTS 配置未启用：${filePath}`);
    if (!['ready', 'test-only'].includes(profile.status)) throw new Error(`TTS 配置不可用：${profile.issues.join('; ')}`);
    return profile;
  }
  const inspected = inspectTtsProfiles(projectPath);
  const ready = inspected.filter((profile) => profile.status === 'ready');
  const profiles = ready.length || inspected.some((profile) => profile.enabled && profile.provider !== 'mock')
    ? ready : inspected.filter((profile) => profile.status === 'test-only');
  if (profiles.length > 1) throw new Error(`发现多个可用 TTS 配置，请通过 --tts-config 指定一个：${profiles.map((profile) => profile.id).join('、')}`);
  if (!profiles.length) {
    const errors = inspected.filter((profile) => profile.status !== 'disabled');
    if (errors.length) throw new Error(`没有可用的 TTS 配置：${errors.map((profile) => `${profile.id}: ${profile.issues.join('; ')}`).join('\n')}`);
  }
  return profiles[0];
}
