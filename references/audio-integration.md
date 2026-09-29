# Audio Integration

FrameLoom supports three audio routes:

1. `silent`: render either an inspection preview or a clean visual master for external editing, chosen with `--output-purpose`.
2. `tts`: generate narration before rendering with Doubao, OpenAI,
   ElevenLabs or Alibaba Cloud Model Studio. `mock` is for deterministic tests.
3. `external`: consume any locally produced voiceover, including recording,
   voice cloning, third-party TTS or manually edited audio.

The storyboard's `scene.narration` is the only source for built-in TTS. TTS
does not create one file per sentence: it creates one segment per scene, then
measures the actual segment duration and uses that duration for the matching
SRT cue. The segment must fit inside its scene. This is what keeps the
visual scene, audio and generated subtitle aligned.

When recording external narration after a script handoff, run
`prepare:script-handoff` first. It exports a scene-keyed script and no MP4;
the later external-audio run compares the current text/version with that
handoff. The CLI checks text identity and audio timing, but it cannot
automatically prove that spoken words match the script. The Agent and creator
must listen to or transcribe the recording before approving delivery. When
the recording already exists at intake, measure it directly and skip the
waiting stage.

## External Audio Contract

Copy `audio/audio-config.example.json` to `audio/audio-config.json`, then enable only the tracks that exist. Paths resolve relative to the config file. Each audio entry requires `source` and `license`; `volume` is between `0` and `1`. SFX may also set `startSec`.

```json
{
  "schemaVersion": "1.0",
  "voiceover": {
    "enabled": true,
    "path": "voiceover.mp3",
    "volume": 1,
    "source": "recorded by project owner",
    "license": "user-owned"
  },
  "captions": {
    "enabled": true,
    "path": "captions.srt",
    "format": "srt",
    "source": "transcribed from approved narration"
  },
  "music": {
    "enabled": false,
    "path": "music.mp3",
    "volume": 0.16,
    "source": "replace-with-source",
    "license": "replace-with-license"
  },
  "sfx": []
}
```

## Built-in TTS Contract

The repository stores the four credential-free presets in
[`examples/tts-profiles/`](../examples/tts-profiles/). Initialize a project,
choose one of its four disabled examples, copy it to
`audio/tts-config.json`, set `enabled` to `true`, and set the named environment
variable. Existing projects can copy a preset from the repository. Do not put
credential values in JSON. The Doubao example leaves
account-specific voice and resource values for the project owner to fill in.

| Example file under `audio/` | Provider | Required environment variable | Initial voice / format |
| --- | --- | --- | --- |
| `tts-config.example.json` | Doubao HTTP v3 SSE | `DOUBAO_TTS_API_KEY`, `DOUBAO_TTS_RESOURCE_ID` | Set your account's voice / MP3 |
| `tts-config.openai.example.json` | OpenAI speech | `OPENAI_API_KEY` | `alloy` / MP3 |
| `tts-config.elevenlabs.example.json` | ElevenLabs | `ELEVENLABS_API_KEY` | `JBFqnCBsd6RMkjVDRZzb` / MP3 |
| `tts-config.aliyun.example.json` | Alibaba Cloud Qwen3-TTS-Flash | `DASHSCOPE_API_KEY` | `Cherry` / WAV |

The Alibaba example uses the Beijing Qwen non-streaming endpoint and requires
a Beijing API key. For Singapore, change the host to
`dashscope-intl.aliyuncs.com` and use a Singapore key. Its temporary audio URL
is downloaded into the project immediately. If DashScope returns an HTTP-scheme
signed OSS URL, FrameLoom upgrades that same Alibaba Cloud host and signature
to HTTPS before downloading; it never downloads over HTTP. `voiceType` is the provider's voice
name or ID, and `model` selects the model. OpenAI maps `speedRatio` to its
speech speed; its sample-rate, pitch and volume fields are unused. ElevenLabs
and Alibaba do not map the generic speed/pitch/volume/sample-rate fields.
Doubao v3 maps `speedRatio` and `volumeRatio` to its speech and loudness rates;
`pitchRatio` is not mapped by the SSE preset.
Each scene is sent as one request, so keep
`scene.narration` within the selected model's input limit.
ElevenLabs currently uses `mp3_44100_128`; Alibaba Qwen currently uses WAV.
Built-in TTS sends credentials only to the selected provider's official HTTPS
host and rejects redirects. Alibaba audio downloads require an Alibaba Cloud
HTTPS host. Use the external-audio route for a custom proxy or self-hosted
endpoint. `outputDirectory` must stay inside the project's `audio/` directory,
and scene IDs may contain only safe filename characters.
See the [OpenAI speech API](https://platform.openai.com/docs/api-reference/audio/createSpeech),
[ElevenLabs conversion API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert),
and [Alibaba Cloud non-real-time TTS guide](https://help.aliyun.com/zh/model-studio/non-realtime-tts-user-guide)
when changing models or voices.

Profiles may also live in `audio/tts-config.<name>.json` or
`audio/tts-profiles/<name>.json`. Run `npm run list:tts-profiles --
projects/<video-id>` to see safe summaries. With more than one enabled valid
profile, pass `--tts-config <selected-file>` to `produce`; it will not choose a
voice silently. The selected provider and voice are recorded in `run.json`.

```bash
cp examples/tts-profiles/openai.json projects/<video-id>/audio/tts-config.json
# Edit audio/tts-config.json: set enabled=true, then export the named API key.
npm run list:tts-profiles -- projects/<video-id>
npm run synthesize:voiceover -- projects/<video-id>
```

Generated files:

- `audio/generated/<scene-id>.<wav|mp3>`: one measured segment per narrated scene
- `audio/generated/voiceover.<wav|mp3>`: scene segments placed on the project timeline
- `audio/generated/captions.srt`: subtitles derived from the same text and
  measured durations
- `audio/audio-manifest.json`: text hash, scene mapping, timings and paths
- `audio/audio-config.tts.json`: renderable audio contract

`produce --audio-mode tts` reuses a previously generated package only when the
selected TTS config, scene text/timing and audio bytes still match its
manifest. If they differ, it stops and asks for an explicit `--force`
regeneration. A failed synthesis keeps its temporary segments out of the
project's ready audio package, so correcting scene timing and retrying does
not require clearing partial files manually.

`mock` produces an audible test tone so timing and loudness QA can run. It is
only for tests and local verification and cannot be approved for delivery. Real providers must be
checked for pronunciation, rights, rate limits and response format.

## Timing and loudness gate

Measure files before rendering:

```bash
npm run inspect:audio -- projects/<video-id>/storyboard.json projects/<video-id>/audio/audio-config.json
```

Voiceover, SFX and captions may not end after the storyboard. Caption cues may not overlap. Background music can be longer because rendering clips it to the composition; short music produces a warning. If narration timing changes, update scene durations and beat windows, revalidate the storyboard, then render again.

When enabled, `music.ducking` lowers music while the voiceover is active. `volume` is a multiplier applied to the configured music volume; `attackSec` and `releaseSec` smooth the transitions:

```json
"ducking": {
  "enabled": true,
  "volume": 0.22,
  "attackSec": 0.08,
  "releaseSec": 0.18
}
```

`inspect:audio` also measures each enabled file with FFmpeg loudnorm and reports integrated loudness, true peak and loudness range. These measurements are warnings and evidence for manual listening, not an automatic mastering decision.

## Render and QA

```bash
npm run render:storyboard -- projects/<video-id>/storyboard.json projects/<video-id>/output/pilot-audio.mp4 --mode fast --audio-config projects/<video-id>/audio/audio-config.json --output-purpose in-project-video
npm run qa:storyboard -- projects/<video-id>/storyboard.json projects/<video-id>/output/pilot-audio.mp4 projects/<video-id>/output/review-audio --mode fast --audio-config projects/<video-id>/audio/audio-config.json --output-purpose in-project-video
```

An audio pilot is still not automatically release-ready. Listen to the full
output, verify that narration matches the visible scene and generated/external
captions, check pronunciation and loudness, inspect subtitle readability, and
confirm every asset's permission.
