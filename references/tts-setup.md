# TTS 配置指南

FrameLoom 当前接入豆包、OpenAI、ElevenLabs、阿里百炼和 MiniMax。只需配置实际使用的一家。这里说明用户如何启用；请求协议、完整参数契约和音频交付规则见[音频接入说明](audio-integration.md)。

选择页里的“项目内置预设”只指定服务、初始模型和音色，不代表本机已配置凭据，也不会替你开通服务或调用 TTS。使用“沿用本地已配置的 TTS”时，Agent 仍需核对实际配置与本地状态。

## 开始前

在已安装依赖的 FrameLoom 仓库根目录执行命令，需要 Node.js 24+ 和 FFmpeg/ffprobe。下文的 `projects/my-video` 是占位路径，替换成你的**已有视频项目目录**；没有项目时，先按[使用指南](usage-guide.md)初始化。试听不要求完成分镜，整片制作需要有效的 `storyboard.json`，不能使用 `storyboard.draft.json`。

新项目的 `audio/` 已包含五份默认关闭的 `.example.json`。旧项目可直接使用仓库的[公开配置样例](../examples/tts-profiles/)。选一家，复制到项目的 `audio/tts-config.json`，把 `enabled` 改为 `true`，再设置所需环境变量。

| 服务 | 仓库样例 | 新项目中的样例 | 要设置的环境变量 |
| --- | --- | --- | --- |
| [豆包](#豆包) | `examples/tts-profiles/doubao.json` | `audio/tts-config.example.json` | `VOLC_TTS_API_KEY`、`VOLC_TTS_RESOURCE_ID`、`VOLC_TTS_SPEAKER` |
| [OpenAI](#openai) | `examples/tts-profiles/openai.json` | `audio/tts-config.openai.example.json` | `OPENAI_API_KEY` |
| [ElevenLabs](#elevenlabs) | `examples/tts-profiles/elevenlabs.json` | `audio/tts-config.elevenlabs.example.json` | `ELEVENLABS_API_KEY` |
| [阿里百炼](#阿里百炼) | `examples/tts-profiles/aliyun.json` | `audio/tts-config.aliyun.example.json` | `DASHSCOPE_API_KEY` |
| [MiniMax](#minimax) | `examples/tts-profiles/minimax.json` | `audio/tts-config.minimax.example.json` | `MINIMAX_API_KEY` |

`apiKeyEnv`、`resourceIdEnv`、`voiceTypeEnv` 填的是**环境变量名**，不是密钥或资源值。真实凭据只在运行命令的进程环境中设置，不写进 JSON、浏览器或 Git。下面 `export` 的尖括号值都是占位符，需替换；不需要执行其他服务的命令。

macOS/Linux 使用下面各服务的 `export` 示例；Windows PowerShell 对应写法为 `$env:MINIMAX_API_KEY = '<你的 MiniMax API Key>'`，其他变量同理。复制文件可用 `Copy-Item`，仅在目标配置不存在时执行。FrameLoom **不会自动读取 `.env`**；在终端设置变量后，由 IDE 或 Agent 启动的另一个进程不一定能继承，必须让实际运行 FrameLoom 的进程也能读到。

下面的 `cp -n` 用于首次配置，保留已有目标文件。若 `audio/tts-config.json` 已存在，先核对已有配置，再决定编辑它还是[保留多个配置](#多个配置与切换服务)，不要以为复制命令已经换掉旧服务。

## 豆包

在[火山引擎语音 API Key 控制台](https://console.volcengine.com/speech/new/setting/apikeys?projectName=default)取得 API Key，并在控制台及[音色列表](https://www.volcengine.com/docs/6561/1257544)核对音色 ID 和对应 Resource ID。当前预设使用 [HTTP v3 单向流式接口](https://www.volcengine.com/docs/6561/1598757)。三个值必须属于实际开通的服务组合；不要把其他服务的资源 ID 或音色名称混用。

```bash
cp -n examples/tts-profiles/doubao.json projects/my-video/audio/tts-config.json
export VOLC_TTS_API_KEY='<你的豆包语音 API Key>'
export VOLC_TTS_RESOURCE_ID='<该音色对应的 Resource ID>'
export VOLC_TTS_SPEAKER='<已开通的音色 ID>'
```

把目标文件的 `enabled` 改为 `true`。启用后的完整配置可以是：

```json
{
  "schemaVersion": "1.0",
  "enabled": true,
  "provider": "doubao",
  "apiVersion": "v3",
  "endpoint": "https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse",
  "apiKeyEnv": "VOLC_TTS_API_KEY",
  "resourceIdEnv": "VOLC_TTS_RESOURCE_ID",
  "userId": "frame-loom",
  "voiceTypeEnv": "VOLC_TTS_SPEAKER",
  "format": "mp3",
  "sampleRate": 24000,
  "speedRatio": 1,
  "volumeRatio": 1,
  "outputDirectory": "audio/generated",
  "timeoutMs": 30000
}
```

换音色时修改 `VOLC_TTS_SPEAKER`，同时核对 `VOLC_TTS_RESOURCE_ID`。也可移除 `voiceTypeEnv`，改用静态 `voiceType`。如果两者同时存在，以环境变量为准；变量缺失时报错，不回退到静态音色。

当前 v3 适配器支持 `speedRatio` 和 `volumeRatio` 的 0.5–2 范围；`sampleRate` 支持 8000、16000、22050、24000、32000、44100、48000。`format` 可选 MP3/WAV；`pitchRatio` 只能是 1，不支持 `instructions` 或 `pitchSemitones`。该预设使用 API Key，不需要另填 App ID 和 Access Token；鉴权差异见[官方 API Key 说明](https://docs.volcengine.com/docs/DoubaoVoice/APIKeyUsage?lang=zh)。

## OpenAI

在 [OpenAI API Keys 页面](https://platform.openai.com/api-keys)取得用于 API 调用的 Key，设置 `OPENAI_API_KEY`。预设使用 `gpt-4o-mini-tts` 和 `alloy`；模型、音色与朗读指令的官方说明见[语音合成 API](https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create)。

```bash
cp -n examples/tts-profiles/openai.json projects/my-video/audio/tts-config.json
export OPENAI_API_KEY='<你的 OpenAI API Key>'
```

目标配置改为：

```json
{
  "schemaVersion": "1.0",
  "enabled": true,
  "provider": "openai",
  "endpoint": "https://api.openai.com/v1/audio/speech",
  "apiKeyEnv": "OPENAI_API_KEY",
  "model": "gpt-4o-mini-tts",
  "voiceType": "alloy",
  "format": "mp3"
}
```

换音色修改 `voiceType`；调语速可添加 `"speedRatio": 1.1`，支持 0.25–4。使用支持指令的模型时，可添加 `"instructions": "语气沉稳，吐字清楚。"`；`tts-1` / `tts-1-hd` 不支持此字段。每场旁白最多 4096 字符。

FrameLoom 当前接入 MP3/WAV，不支持独立音量、音调或指定语言参数。不要添加非默认 `volumeRatio`、`pitchRatio` 或更改源音频 `sampleRate`；最终文件的采样率使用下文的 `outputSampleRate`。

## ElevenLabs

在 [ElevenLabs Developers / API Keys](https://elevenlabs.io/app/developers/api-keys)取得 Key。若设置了权限或额度限制，需允许 Text to Speech 请求，并确认有可用额度；见[官方鉴权说明](https://elevenlabs.io/docs/api-reference/authentication)。从账号的声音库取得可用的 **Voice ID**，填入 `voiceType`，不要填显示名称。

```bash
cp -n examples/tts-profiles/elevenlabs.json projects/my-video/audio/tts-config.json
export ELEVENLABS_API_KEY='<你的 ElevenLabs API Key>'
```

目标配置改为：

```json
{
  "schemaVersion": "1.0",
  "enabled": true,
  "provider": "elevenlabs",
  "endpoint": "https://api.elevenlabs.io/v1/text-to-speech",
  "apiKeyEnv": "ELEVENLABS_API_KEY",
  "model": "eleven_multilingual_v2",
  "voiceType": "JBFqnCBsd6RMkjVDRZzb",
  "format": "mp3"
}
```

示例 Voice ID 是初始值，实际可用性须以账号权限和试听为准。`endpoint` 保持基础路径，适配器会自动追加 Voice ID。当前输出固定为 `mp3_44100_128`，不能改成 WAV。

可将以下字段合并到上面的配置中；它们不是独立配置文件：

```json
{
  "speedRatio": 1.1,
  "voiceSettings": {
    "stability": 0.6,
    "similarity_boost": 0.75,
    "style": 0.2,
    "use_speaker_boost": true
  },
  "textNormalization": "auto",
  "useSceneContext": true
}
```

`speedRatio` 支持 0.7–1.2；前三个数值声音设置支持 0–1。`useSceneContext` 在整片合成时传入前后场旁白，单句试听没有相邻场景。默认 `eleven_multilingual_v2` 不能配置 `language`；只有明确选择支持该设置的模型，才使用 ISO 639-1 语言代码。

发音词典需先在服务商处创建，再用 `pronunciationDictionaries` 引用 ID，例如 `[{"pronunciation_dictionary_id":"你的词典ID","version_id":"版本ID"}]`，最多三份；不是直接填写词语列表。账号、模型与词典能力仍需核对[转换接口文档](https://elevenlabs.io/docs/api-reference/text-to-speech/convert)。

## 阿里百炼

按[获取 API Key 指南](https://help.aliyun.com/zh/model-studio/get-api-key/)在[北京地域 API Key 控制台](https://bailian.console.aliyun.com/cn-beijing/model/settings/api-key)取得 Key。默认预设使用北京端点、`qwen3-tts-flash` 和 `Cherry` 音色，输出 WAV；Key 与端点地域应匹配。

```bash
cp -n examples/tts-profiles/aliyun.json projects/my-video/audio/tts-config.json
export DASHSCOPE_API_KEY='<北京地域的百炼 API Key>'
```

目标配置改为：

```json
{
  "schemaVersion": "1.0",
  "enabled": true,
  "provider": "aliyun",
  "endpoint": "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
  "apiKeyEnv": "DASHSCOPE_API_KEY",
  "model": "qwen3-tts-flash",
  "voiceType": "Cherry",
  "format": "wav"
}
```

使用新加坡地域时，把 `endpoint` 的主机改为 `dashscope-intl.aliyuncs.com`，并设置该地域的 Key。`voiceType` 是模型支持的音色名称；按[Qwen TTS 文档](https://help.aliyun.com/zh/model-studio/qwen-tts-api)核对，不能直接套用其他服务的 Voice ID。

指定中文可添加 `"language": "Chinese"`，自动识别用 `"language": "Auto"`。若要使用 `instructions`，必须**显式选择** `qwen3-tts-instruct-flash` 系列模型，并确认该模型与音色可用；默认模型不能直接添加指令。当前适配器只接入 WAV，不支持独立调语速、音量、音调或源音频采样率。

## MiniMax

在 MiniMax 开放平台账号管理的 API Keys 中取得 Key，并确认语音服务额度与音色权限；鉴权入口见[同步语音合成文档](https://platform.minimaxi.com/docs/api-reference/speech-t2a-http)。

```bash
cp -n examples/tts-profiles/minimax.json projects/my-video/audio/tts-config.json
export MINIMAX_API_KEY='<你的 MiniMax API Key>'
```

目标配置改为：

```json
{
  "schemaVersion": "1.0",
  "enabled": true,
  "provider": "minimax",
  "endpoint": "https://api.minimax.cn/v1/t2a_v2",
  "apiKeyEnv": "MINIMAX_API_KEY",
  "model": "speech-2.8-hd",
  "voiceType": "male-qn-qingse",
  "format": "mp3",
  "sampleRate": 32000,
  "speedRatio": 1,
  "volumeRatio": 1,
  "pitchSemitones": 0,
  "timeoutMs": 120000
}
```

中国站使用上面的 `api.minimax.cn`；国际站显式改为 `https://api.minimax.io/v1/t2a_v2`，同时使用国际站的 Key。FrameLoom 不会自动换站点或模型。

换音色修改 `voiceType`，填已有系统音色或账号可用音色的 ID。调语速使用 0.5–2 的 `speedRatio`；音量使用大于 0、至多 10 的 `volumeRatio`；音调使用 −12 至 12 的整数 `pitchSemitones`，0 表示原音调。不要用 `pitchRatio` 调音调。

可将下面的字段合并到配置中：

```json
{
  "language": "Chinese",
  "emotion": "calm",
  "pronunciationHints": ["处理/(chu3)(li3)", "FrameLoom/Frame Loom"],
  "textNormalization": "quality",
  "outputSampleRate": 48000
}
```

不填 `emotion` 时由模型自动匹配情绪；`fluent` / `whisper` 在当前配置契约中要求 `speech-2.6-*`。`pronunciationHints` 使用 `原文/替换内容` 格式。`textNormalization` 可选 `basic` / `quality`，后者要求 `speech-2.6-*` 或 `speech-2.8-*`。完整模型、语言和采样率选项见[MiniMax 参数表](audio-integration.md#minimax-setup)。

当前接入非流式 MP3/WAV，每场少于 10000 Unicode 字符。MP3 的 `bitrate` 可选 32000、64000、128000、256000，默认 128000；改成 WAV 时移除显式 `bitrate`。不支持任意 `requestBody` 字段、URL 输出或流式开关；服务商返回的 hex 音频由适配器处理，用户不需要自己解码。

## 检查与制作

五家服务完成配置后，都使用同一组命令。

**先做本地检查，不请求服务商：**

```bash
npm run list:tts-profiles -- projects/my-video
```

| 状态 | 含义与下一步 |
| --- | --- |
| `ready` | 本地参数与环境变量已齐全；尚未验证 Key、余额、模型或音色的在线权限 |
| `needs-environment` | 在运行命令的同一进程环境补齐列出的变量 |
| `disabled` | 核对所选实际配置，把 `enabled` 改为 `true` |
| `invalid` | 根据字段诊断修复 JSON、取值或模型兼容性 |
| `test-only` | `mock` 测试音调，不能用于真实旁白交付 |

**需要确认音色时，显式试听：**

```bash
npm run preview:tts -- projects/my-video --tts-config projects/my-video/audio/tts-config.json --text "你好，请确认音色、语速和专有名词的读音。"
```

试听会调用真实服务并可能收费，输出到 `audio/previews/`，不生成整片字幕或生产音频包。试听文本限制为 1–500 字符；结果会打印文件路径，可用本机播放器检查。应在分镜批准前试听，试听文件也会影响项目输入指纹。

**分镜就绪后，制作有声视频：**

```bash
npm run produce -- projects/my-video --mode fast --audio-mode tts --output-purpose in-project-video --tts-config projects/my-video/audio/tts-config.json
```

`produce` 合成每场 `scene.narration`，测量音频并生成旁白、SRT、音频清单，再渲染和运行 QA。旁白与镜头时长不匹配时，按[质量生产说明](quality-production.md)让 Agent 生成并采用时间提案，重新校验后制作；不能删改朗读文本来掩盖时间问题。`review` 模式须先按[使用指南](usage-guide.md#6-接入音频制作项目内有声视频)批准当前讲稿与分镜。

若只想先生成整片旁白、暂不渲染 MP4，使用 `npm run synthesize:voiceover -- projects/my-video --tts-config projects/my-video/audio/tts-config.json`。默认输出为 `audio/generated/` 下逐场片段、合并旁白、`captions.srt`，以及 `audio/audio-manifest.json` 和 `audio/audio-config.tts.json`。字幕使用实测片段时长估计短句时间，仍需听音核对。

## 多个配置与切换服务

一个项目可以保存 `audio/tts-config.openai.json`、`audio/tts-config.minimax.json` 等文件，或 `audio/tts-profiles/<name>.json`。每份配置独立启用、独立检查。只有一个真实 `ready` 配置时，可自动选用；多个可用配置时，必须用 `--tts-config` 指定。显式传入路径时，命令读取该文件，不会因为文件名自动修改 `provider`。

选择页的公开预设还约束初始模型和音色。如果你已修改这些参数，可以选择“沿用本地已配置的 TTS”，并让 Agent 使用实际配置路径；不要继续声称使用了参数完全相同的公开预设。

模型、音色、语速、情绪、发音提示等变化会影响缓存和音频包复用。已有音频包与新配置不一致时，命令会停止；核对改动和费用后，可在原制作命令追加 `--force` 重新生成。审片模式还需重新批准当前版本。

若要重新向服务商合成相同参数的源语音，先运行下列音频命令，再继续制作。`--refresh-voice` 属于 `synthesize:voiceover`，不要传给 `produce`；单独 `--force` 仍会复用参数相同且有效的源语音缓存。

```bash
npm run synthesize:voiceover -- projects/my-video --tts-config projects/my-video/audio/tts-config.json --force --refresh-voice
```

## 常用字段与排错

| 字段 | 如何填写 |
| --- | --- |
| `voiceType` | 所选服务的音色名称或 ID，不跨服务通用 |
| `voiceTypeEnv` | 存放音色 ID 的环境变量名；优先于 `voiceType`，变量缺失会报错 |
| `model` | 所选服务的模型 ID；不为启用某参数自动换模型 |
| `outputSampleRate` | 最终合并单声道旁白：24000（默认）、44100、48000；不改变原始试听音频 |
| `sampleRate` | 服务请求的源采样率，与最终采样率不同；仅豆包和 MiniMax 的当前适配器支持调节 |
| `timeoutMs` | 单次合成请求超时，单位毫秒；MiniMax 预设为 120000，其他预设默认 30000 |
| `outputDirectory` | 默认 `audio/generated`，路径相对项目根目录且必须在项目 `audio/` 内 |

| 遇到的问题 | 检查方式 |
| --- | --- |
| 网页选了服务，但提示没有可用配置 | 网页不保存密钥；核对实际 JSON、`enabled` 和 `list:tts-profiles` 状态 |
| 已在终端设置 Key，Agent 仍提示缺失 | 检查实际运行进程是否继承同一环境；不要在日志里打印完整凭据 |
| `ready` 后仍鉴权失败或被限流 | `ready` 只做本地预检；在对应平台核对 Key、权限、额度和限制 |
| 豆包有 Key 但音色不可用 | 核对音色 ID、Resource ID 与实际开通的服务组合 |
| 阿里百炼或 MiniMax 换地域后失败 | 核对 Key 所属平台／地域与 `endpoint`，不能只换主机 |
| 配置提示不支持某字段 | 查所选服务的支持范围；不要把其他服务的参数直接复制过来 |
| 更换音色后仍有旧音频包 | 核对配置路径与环境音色，再显式重新生成；不能把不匹配音频包作为新旁白 |
| 语音超出镜头或换镜前空档过长 | 按实测时长调整分镜；TTS 旁白结束到换镜的空档不得超过 0.5 秒 |

内置适配器只访问对应服务商的官方 HTTPS 主机，不接受自定义网关或代理地址，也不自动改用其他模型。其他服务、本地 TTS 或自行录制的旁白，按[外部音频契约](audio-integration.md#external-audio-contract)提供文件。
