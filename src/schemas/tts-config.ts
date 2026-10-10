import {z} from 'zod';

// Bump when adapter behavior changes without a change to a user's JSON fields.
export const TTS_SYNTHESIS_REVISION = 2;

const TtsConfigBaseSchema = z.object({
  schemaVersion: z.literal('1.0'),
  enabled: z.boolean(),
  apiVersion: z.enum(['generic', 'v3']).default('generic'),
  endpoint: z.string().url().optional(),
  apiKeyEnv: z.string().min(1).optional(),
  appIdEnv: z.string().min(1).optional(),
  accessTokenEnv: z.string().min(1).optional(),
  resourceIdEnv: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  format: z.enum(['wav', 'mp3']).default('wav'),
  sampleRate: z.number().int().positive().default(24000),
  speedRatio: z.number().positive().default(1),
  volumeRatio: z.number().positive().default(1),
  pitchRatio: z.number().positive().default(1),
  outputDirectory: z.string().min(1).default('audio/generated'),
  timeoutMs: z.number().int().positive().default(30000),
  outputSampleRate: z.union([z.literal(24000), z.literal(44100), z.literal(48000)]).default(24000),
  voiceType: z.string().trim().min(1).optional(),
  voiceTypeEnv: z.string().min(1).optional(),
  instructions: z.string().trim().min(1).max(4096).optional(),
  language: z.string().min(1).optional(),
  voiceSettings: z.object({
    stability: z.number().min(0).max(1).optional(),
    similarity_boost: z.number().min(0).max(1).optional(),
    style: z.number().min(0).max(1).optional(),
    use_speaker_boost: z.boolean().optional()
  }).strict().optional(),
  pronunciationDictionaries: z.array(z.object({
    pronunciation_dictionary_id: z.string().min(1),
    version_id: z.string().min(1).optional()
  }).strict()).max(3).optional(),
  textNormalization: z.enum(['auto', 'on', 'off']).optional(),
  useSceneContext: z.boolean().optional(),
  pitchSemitones: z.never().optional(),
  emotion: z.never().optional(),
  pronunciationHints: z.never().optional(),
  bitrate: z.never().optional(),
  requestBody: z.record(z.string(), z.unknown()).optional()
}).strict();

const neutral = z.literal(1).default(1);
const fixedSampleRate = z.literal(24000).default(24000);
const unavailable = z.never().optional();
const noVoiceControls = {voiceSettings: unavailable, pronunciationDictionaries: unavailable,
  textNormalization: unavailable, useSceneContext: unavailable};
const minimaxModels = ['speech-2.8-hd', 'speech-2.8-turbo', 'speech-2.6-hd', 'speech-2.6-turbo',
  'speech-02-hd', 'speech-02-turbo', 'speech-01-hd', 'speech-01-turbo'] as const;
const minimaxLanguages = ['auto', 'Chinese', 'Chinese,Yue', 'English', 'Arabic', 'Russian', 'Spanish',
  'French', 'Portuguese', 'German', 'Turkish', 'Dutch', 'Ukrainian', 'Vietnamese', 'Indonesian',
  'Japanese', 'Italian', 'Korean', 'Thai', 'Polish', 'Romanian', 'Greek', 'Czech', 'Finnish', 'Hindi',
  'Bulgarian', 'Danish', 'Hebrew', 'Malay', 'Persian', 'Slovak', 'Swedish', 'Croatian', 'Filipino',
  'Hungarian', 'Norwegian', 'Slovenian', 'Catalan', 'Nynorsk', 'Tamil', 'Afrikaans'] as const;

// Retain neutral legacy placeholders, but reject changed settings that a provider ignores.
export const TtsConfigSchema = z.discriminatedUnion('provider', [
  TtsConfigBaseSchema.extend({provider: z.literal('minimax'), apiVersion: z.literal('generic').default('generic'),
    model: z.enum(minimaxModels).default('speech-2.8-hd'), format: z.enum(['mp3', 'wav']).default('mp3'),
    sampleRate: z.union([8000, 16000, 22050, 24000, 32000, 44100].map((value) => z.literal(value))).default(32000),
    speedRatio: z.number().min(0.5).max(2).default(1), volumeRatio: z.number().positive().max(10).default(1),
    pitchRatio: neutral, pitchSemitones: z.number().int().min(-12).max(12).default(0),
    emotion: z.enum(['happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised', 'calm', 'fluent', 'whisper']).optional(),
    pronunciationHints: z.array(z.string().trim().regex(/^[^/\r\n]+\/[^\r\n]+$/u)).min(1).optional(),
    bitrate: z.union([32000, 64000, 128000, 256000].map((value) => z.literal(value))).optional(),
    instructions: unavailable, language: z.enum(minimaxLanguages).optional(), ...noVoiceControls,
    textNormalization: z.enum(['basic', 'quality']).optional(),
    requestBody: z.object({}).strict().optional()}),
  TtsConfigBaseSchema.extend({provider: z.literal('openai'), apiVersion: z.literal('generic').default('generic'),
    speedRatio: z.number().min(0.25).max(4).default(1), volumeRatio: neutral, pitchRatio: neutral,
    sampleRate: fixedSampleRate, language: unavailable, ...noVoiceControls}),
  TtsConfigBaseSchema.extend({provider: z.literal('elevenlabs'), apiVersion: z.literal('generic').default('generic'),
    format: z.literal('mp3').default('mp3'), speedRatio: z.number().min(0.7).max(1.2).default(1),
    volumeRatio: neutral, pitchRatio: neutral, sampleRate: fixedSampleRate, instructions: unavailable,
    language: z.string().regex(/^[a-z]{2}$/).optional()}),
  TtsConfigBaseSchema.extend({provider: z.literal('aliyun'), apiVersion: z.literal('generic').default('generic'),
    format: z.literal('wav').default('wav'), speedRatio: neutral, volumeRatio: neutral, pitchRatio: neutral,
    sampleRate: fixedSampleRate, language: z.enum(['Auto', 'Chinese', 'English', 'German', 'Italian',
      'Portuguese', 'Spanish', 'Japanese', 'Korean', 'French', 'Russian']).optional(), ...noVoiceControls}),
  TtsConfigBaseSchema.extend({provider: z.literal('doubao'), speedRatio: z.number().min(0.5).max(2).default(1),
    volumeRatio: z.number().min(0.5).max(2).default(1),
    sampleRate: z.union([8000, 16000, 22050, 24000, 32000, 44100, 48000].map((value) => z.literal(value))).default(24000),
    instructions: unavailable, language: unavailable, ...noVoiceControls}),
  TtsConfigBaseSchema.extend({provider: z.literal('mock'), format: z.literal('wav').default('wav'),
    volumeRatio: neutral, pitchRatio: neutral, instructions: unavailable, language: unavailable, ...noVoiceControls})
]).superRefine((config, ctx) => {
  const issue = (field: string, message: string) => ctx.addIssue({code: 'custom', path: [field], message});
  if (config.endpoint && config.provider !== 'mock') {
    const hosts = {openai: ['api.openai.com'], elevenlabs: ['api.elevenlabs.io'],
      aliyun: ['dashscope.aliyuncs.com', 'dashscope-intl.aliyuncs.com'], doubao: ['openspeech.bytedance.com'],
      minimax: ['api.minimax.cn', 'api.minimax.io']};
    let url;
    try { url = new URL(config.endpoint); } catch { /* URL syntax is validated above. */ }
    if (!url || url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !hosts[config.provider].includes(url.hostname)) {
      issue('endpoint', '必须使用服务商官方 HTTPS 域名，不允许自定义主机或端口。');
    }
  }
  if (!config.voiceType && !config.voiceTypeEnv) issue('voiceType', '需要 voiceType 或 voiceTypeEnv。');
  if (config.provider === 'minimax') {
    if (config.format !== 'mp3' && config.bitrate !== undefined) issue('bitrate', 'MiniMax bitrate 仅支持 mp3，wav 请移除此设置。');
    if (['fluent', 'whisper'].includes(config.emotion ?? '') && !config.model.startsWith('speech-2.6-')) {
      issue('emotion', 'MiniMax fluent / whisper 仅支持 speech-2.6 系列模型。');
    }
    if (config.textNormalization === 'quality' && !/^speech-2\.(?:6|8)-/u.test(config.model)) {
      issue('textNormalization', 'MiniMax quality 文本规范化需要 speech-2.6 / speech-2.8 系列模型。');
    }
    if (/^speech-0[12]-/u.test(config.model) && ['Persian', 'Filipino', 'Tamil'].includes(config.language ?? '')) {
      issue('language', 'MiniMax speech-01 / speech-02 不支持 Persian / Filipino / Tamil。');
    }
  }
  if (config.provider === 'doubao' && config.apiVersion === 'v3' && config.pitchRatio !== 1) {
    issue('pitchRatio', '豆包 v3 不支持 pitchRatio。');
  }
  const body = config.requestBody ?? {};
  const managed = config.provider === 'openai' ? ['model', 'input', 'voice', 'response_format', 'speed']
    : config.provider === 'elevenlabs' ? ['text', 'model_id']
      : config.provider === 'aliyun' ? ['model'] : config.provider === 'doubao' ? ['user', 'text', 'model', 'voice_type', 'audio_format', 'sample_rate', 'speed_ratio', 'volume_ratio', 'pitch_ratio'] : [];
  if (managed.some((field) => body[field] !== undefined)) issue('requestBody', '包含由 FrameLoom 管理的字段，请使用顶层配置，不能通过 requestBody 覆盖。');
  if (config.provider === 'openai' && body.stream_format !== undefined && body.stream_format !== 'audio') issue('requestBody', 'OpenAI 适配器只支持 audio 响应，不支持 SSE。');
  const input = body.input && typeof body.input === 'object' ? body.input as Record<string, unknown> : {};
  if (config.provider === 'aliyun' && body.input !== undefined && (!body.input || typeof body.input !== 'object' || Array.isArray(body.input))) issue('requestBody', 'input 必须是对象。');
  if (config.provider === 'aliyun' && ['text', 'voice'].some((field) => input[field] !== undefined)) issue('requestBody', 'input.text / input.voice 由 FrameLoom 管理。');
  if (config.provider === 'doubao' && config.apiVersion === 'v3') {
    const params = body.req_params as Record<string, unknown> | undefined;
    const audio = params?.audio_params as Record<string, unknown> | undefined;
    if (params?.text !== undefined || params?.speaker !== undefined || ['format', 'sample_rate', 'speech_rate', 'loudness_rate'].some((field) => audio?.[field] !== undefined)) {
      issue('requestBody', 'req_params 中的文本、音色及基本音频参数由 FrameLoom 管理。');
    }
  }
  const instructions = config.instructions ?? (config.provider === 'aliyun' ? input.instructions : body.instructions);
  const rawInstructions = config.provider === 'aliyun' ? input.instructions : body.instructions;
  if (config.instructions && rawInstructions !== undefined && rawInstructions !== config.instructions) issue('requestBody', '朗读指令与顶层 instructions 冲突。');
  if (instructions !== undefined) {
    if (typeof instructions !== 'string' || !instructions.trim()) issue('instructions', '朗读指令必须是非空字符串。');
    if (config.provider === 'openai' && typeof instructions === 'string' && instructions.length > 4096) issue('instructions', 'OpenAI 朗读指令不能超过 4096 字符。');
    if (config.provider === 'openai' && ['tts-1', 'tts-1-hd'].includes(config.model ?? '')) {
      issue('instructions', 'tts-1 / tts-1-hd 不支持朗读指令。');
    } else if (config.provider === 'aliyun' && !/^qwen3-tts-instruct-flash(?:-|$)/u.test(config.model ?? '')) {
      issue('instructions', '百炼朗读指令需要 qwen3-tts-instruct-flash 系列模型。');
    } else if (!['openai', 'aliyun'].includes(config.provider)) {
      issue('requestBody', '当前服务不支持 instructions 字段。');
    }
  }
  if (config.provider === 'aliyun') {
    if (input.language_type !== undefined && !['Auto', 'Chinese', 'English', 'German', 'Italian', 'Portuguese', 'Spanish', 'Japanese', 'Korean', 'French', 'Russian'].includes(String(input.language_type))) issue('requestBody', 'language_type 无效。');
    if (config.language && input.language_type !== undefined && input.language_type !== config.language) issue('requestBody', '语言设置与顶层 language 冲突。');
    if (input.optimize_instructions !== undefined && (typeof input.optimize_instructions !== 'boolean' || !instructions)) issue('requestBody', 'optimize_instructions 必须为布尔值且需要朗读指令。');
  }
  if (config.provider === 'elevenlabs') {
    if ((config.language ?? body.language_code) !== undefined && (config.model ?? 'eleven_multilingual_v2') === 'eleven_multilingual_v2') {
      issue('language', 'eleven_multilingual_v2 不支持指定语言，请移除此设置或选择支持的模型。');
    }
    if (config.useSceneContext && (body.previous_text !== undefined || body.next_text !== undefined || body.previous_request_ids !== undefined || body.next_request_ids !== undefined)) {
      issue('useSceneContext', '自动场景上下文不能与 requestBody 的手动上下文同时使用。');
    }
    const rawSettings = body.voice_settings as Record<string, unknown> | undefined;
    if (rawSettings !== undefined && !TtsConfigBaseSchema.shape.voiceSettings.unwrap().extend({speed: z.number().min(0.7).max(1.2).optional()}).safeParse(rawSettings).success) {
      issue('requestBody', 'voice_settings 字段或取值无效。');
    }
    if (rawSettings?.speed !== undefined && rawSettings.speed !== config.speedRatio) {
      issue('requestBody', 'voice_settings.speed 与 speedRatio 冲突，请仅使用 speedRatio。');
    }
    for (const key of Object.keys(config.voiceSettings ?? {})) {
      if (rawSettings?.[key] !== undefined && rawSettings[key] !== (config.voiceSettings as Record<string, unknown>)[key]) issue('requestBody', 'voice_settings 与顶层 voiceSettings 冲突。');
    }
    for (const [field, value, schema] of [
      ['language_code', config.language, z.string().regex(/^[a-z]{2}$/)],
      ['apply_text_normalization', config.textNormalization, TtsConfigBaseSchema.shape.textNormalization.unwrap()],
      ['pronunciation_dictionary_locators', config.pronunciationDictionaries, TtsConfigBaseSchema.shape.pronunciationDictionaries.unwrap()]
    ] as const) {
      if (body[field] !== undefined && !schema.safeParse(body[field]).success) issue('requestBody', `${field} 无效。`);
      if (value !== undefined && body[field] !== undefined && JSON.stringify(value) !== JSON.stringify(body[field])) issue('requestBody', `${field} 与顶层配置冲突。`);
    }
  }
});

export function ttsConfigJsonSchema() {
  return {...z.toJSONSchema(TtsConfigSchema), allOf: [
    {anyOf: [{required: ['voiceType']}, {required: ['voiceTypeEnv']}]},
    {if: {properties: {provider: {const: 'doubao'}, apiVersion: {const: 'v3'}}, required: ['provider', 'apiVersion']}, then: {properties: {pitchRatio: {const: 1}}}},
    {if: {properties: {provider: {const: 'openai'}, model: {enum: ['tts-1', 'tts-1-hd']}}, required: ['provider', 'model']}, then: {not: {required: ['instructions']}}},
    {if: {properties: {provider: {const: 'aliyun'}}, required: ['provider', 'instructions']}, then: {properties: {model: {pattern: '^qwen3-tts-instruct-flash(-|$)'}}, required: ['model']}},
    {if: {properties: {provider: {const: 'elevenlabs'}}, required: ['provider', 'language']}, then: {properties: {model: {not: {const: 'eleven_multilingual_v2'}}}, required: ['model']}},
    {if: {properties: {provider: {const: 'minimax'}, format: {const: 'wav'}}, required: ['provider', 'format']}, then: {not: {required: ['bitrate']}}},
    {if: {properties: {provider: {const: 'minimax'}, emotion: {enum: ['fluent', 'whisper']}}, required: ['provider', 'emotion']}, then: {properties: {model: {enum: ['speech-2.6-hd', 'speech-2.6-turbo']}}, required: ['model']}},
    {if: {properties: {provider: {const: 'minimax'}, textNormalization: {const: 'quality'}}, required: ['provider', 'textNormalization']}, then: {properties: {model: {enum: ['speech-2.8-hd', 'speech-2.8-turbo', 'speech-2.6-hd', 'speech-2.6-turbo']}}}},
    {if: {properties: {provider: {const: 'minimax'}, model: {enum: ['speech-01-hd', 'speech-01-turbo', 'speech-02-hd', 'speech-02-turbo']}}, required: ['provider', 'model']}, then: {properties: {language: {not: {enum: ['Persian', 'Filipino', 'Tamil']}}}}}
  ]};
}

export type TtsConfig = z.infer<typeof TtsConfigSchema>;
