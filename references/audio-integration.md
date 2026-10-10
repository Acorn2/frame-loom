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
    "fadeInSec": 1,
    "fadeOutSec": 2,
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
credential values in JSON. The Doubao example reads the voice, API key and
resource ID from three `VOLC_TTS_*` environment variables. The selected voice
must be available for the selected resource ID.

| Example file under `audio/` | Provider | Required environment variable | Initial voice / format |
| --- | --- | --- | --- |
| `tts-config.example.json` | Doubao HTTP v3 SSE | `VOLC_TTS_API_KEY`, `VOLC_TTS_RESOURCE_ID`, `VOLC_TTS_SPEAKER` | Voice from environment / MP3 |
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
maps `speedRatio` to `voice_settings.speed` (supported range 0.7–1.2).
Alibaba does not map the generic speed/pitch/volume/sample-rate fields.
Doubao v3 maps `speedRatio` and `volumeRatio` to its speech and loudness rates;
`pitchRatio` is not mapped by the SSE preset.
`voiceTypeEnv` selects the environment variable holding the voice ID; a static
`voiceType` remains supported for existing profiles. When the environment
voice changes, TTS reuse and project fingerprints change with it.
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

### Validated voice controls

Configuration remains at schema version 1.0. Neutral legacy placeholders
(`volumeRatio: 1`, `pitchRatio: 1`, `sampleRate: 24000`) remain compatible where
they were unused. Changing an unsupported setting now fails validation instead
of being ignored. ElevenLabs defaults to MP3; Alibaba and mock require WAV.
OpenAI speed is 0.25–4.0; Doubao speed and loudness ratios are 0.5–2.0,
and v3 rejects non-neutral pitch. Format and basic parameter constraints are
also exported in the JSON Schema; model compatibility, endpoint security and
advanced `requestBody` checks run in the local validator.
Synthesis revision 2 invalidates older voice-cache entries and audio-package
reuse fingerprints, including profiles whose JSON is unchanged. Review an old
project's settings, then explicitly use `--force` to regenerate its audio package;
review mode requires current approval again. No existing project is migrated or
regenerated automatically.

| Setting | Provider / behavior |
| --- | --- |
| `instructions` | OpenAI speech instructions, excluding `tts-1` / `tts-1-hd`; Alibaba requires the `qwen3-tts-instruct-flash` model family and writes to `input.instructions` |
| `language` | Alibaba: `Auto`, `Chinese`, `English`, `German`, `Italian`, `Portuguese`, `Spanish`, `Japanese`, `Korean`, `French`, `Russian`; ElevenLabs: ISO 639-1 code, excluding `eleven_multilingual_v2` |
| `voiceSettings` | ElevenLabs `stability`, `similarity_boost`, `style` (0–1), and `use_speaker_boost` (boolean); speed uses top-level `speedRatio` |
| `pronunciationDictionaries` | ElevenLabs: at most three `{pronunciation_dictionary_id, version_id?}` entries referencing existing provider dictionaries |
| `textNormalization` | ElevenLabs: `auto`, `on`, `off`, for provider text normalization such as number reading |
| `useSceneContext` | ElevenLabs only, opt-in; supplies adjacent narrated scene text as `previous_text` / `next_text`; changed neighbors invalidate affected voice-cache entries |
| `outputSampleRate` | Final combined mono voiceover: 24000 (default), 44100, or 48000 Hz; separate from provider `sampleRate`, without regenerating otherwise unchanged source takes |

OpenAI example additions:

```json
{"speedRatio": 1.1, "instructions": "语气沉稳、自然，吐字清楚。", "outputSampleRate": 48000}
```

ElevenLabs example additions:

```json
{"speedRatio": 1.1, "voiceSettings": {"stability": 0.6, "similarity_boost": 0.75}, "textNormalization": "auto", "useSceneContext": true}
```

Alibaba example additions (explicitly selects the instruction-capable model):

```json
{"model": "qwen3-tts-instruct-flash", "language": "Chinese", "instructions": "语气沉稳、自然，吐字清楚。"}
```

Merge these fields into a chosen enabled profile; they are not standalone
configuration files. Do not silently change a user's model to enable a control.
Provider model, voice, region, subscription and language limitations still apply.
See the [Qwen-TTS API](https://help.aliyun.com/zh/model-studio/qwen-tts-api)
and [ElevenLabs speed guide](https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/can-i-change-the-pace-of-the-voice).

`requestBody` remains an advanced escape hatch, but cannot override managed
text, model, voice, format or basic audio fields. Known instruction, language
and ElevenLabs voice controls are checked for invalid values and conflicts
with top-level fields. Other vendor-specific options must be checked against
the selected model's official documentation. Automatic scene context cannot
be combined with manual context text or request IDs.

Profiles may also live in `audio/tts-config.<name>.json` or
`audio/tts-profiles/<name>.json`. Run `npm run list:tts-profiles --
projects/<video-id>` to see safe summaries. With more than one enabled valid
profile, pass `--tts-config <selected-file>` to `produce`; it will not choose a
voice silently. The selected provider and voice are recorded in `run.json`.
The listing reports each discovered profile as `ready`, `needs-environment`,
`disabled`, `invalid` or `test-only`, including safe reasons. A bad profile
does not hide the others. `ready` means local configuration and named environment
variables are present; it does not verify online credentials, balance or voice
permissions. Automatic selection considers ready real providers first and does
not fall back to mock when a real enabled profile is unavailable.

### Explicit voice preview

```bash
npm run preview:tts -- projects/<video-id> --tts-config projects/<video-id>/audio/tts-config.json --text "你好，请确认这段配音的音色与语速。"
```

This is an explicit online synthesis request and may incur provider charges.
It accepts `--text` or `--text-file` (1–500 characters); omitting both uses a
short built-in audition sentence. It writes a unique original provider audio
file under `audio/previews/` and prints the measured duration and safe profile
summary. It never creates or replaces the production audio manifest, captions
or storyboard, and rejects mock audition. No automatic playback or vendor voice
catalog fetching is performed. `outputSampleRate` applies to production mixing,
not this original preview file. Audition before approving the storyboard;
files under `audio/` participate in project input fingerprints.

```bash
cp examples/tts-profiles/openai.json projects/<video-id>/audio/tts-config.json
# Edit audio/tts-config.json: set enabled=true, then export the named API key.
npm run list:tts-profiles -- projects/<video-id>
npm run synthesize:voiceover -- projects/<video-id>
```

Generated files:

- `audio/generated/<scene-id>.<wav|mp3>`: one measured segment per narrated scene
- `audio/generated/voiceover.<wav|mp3>`: scene segments placed on the project timeline
- `audio/generated/captions.srt`: short, single-line phrase cues derived from
  the same text and measured durations. Cue edges omit pause punctuation;
  punctuation within a cue and tone-bearing final `?`/`!` remain
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
For a scene-keyed TTS audio manifest, automated QA also compares each measured segment to its scene: narration starts with the shot, and a gap longer than 0.5 second after speech fails the alignment check.
Phrase-level subtitle timing is allocated from measured segment durations and text length; check it against the spoken words during manual playback.

When enabled, `music.ducking` lowers music while the voiceover is active. `volume` is a multiplier applied to the configured music volume; `attackSec` and `releaseSec` smooth the transitions:

An enabled music track fades in over 1 second and out over 2 seconds by default. `music.fadeInSec` and `music.fadeOutSec` override those durations; `0` disables that edge's fade. TTS projects use the measured end of the last speech segment for ducking release, so a silent end card can retain music. Music is optional and must have a documented source and license; never add an arbitrary bundled track to every video. Rendered narrated QA flags more than 2 seconds of trailing silence as a warning for listening review.

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

## Measured timing and corrected captions

See [quality production](quality-production.md) for segment caching, `--plan-timing`, explicit voice refresh and scene-local manual cues. The audio manifest labels caption timing as estimated or manual; generated segment duration alone is not evidence of word alignment. Final narrated candidates suppress the review marker before QA and require a matching `.render.json` receipt for approval.
