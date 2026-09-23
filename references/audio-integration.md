# Audio Integration

Audio is optional and vendor-neutral. FrameLoom does not call TTS or voice-cloning services; it consumes local audio and subtitle files whose source and permission are recorded in `audio-config.json`.

## Contract

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
npm run render:storyboard -- projects/<video-id>/storyboard.json projects/<video-id>/output/pilot-audio.mp4 --audio-config projects/<video-id>/audio/audio-config.json
npm run qa:storyboard -- projects/<video-id>/storyboard.json projects/<video-id>/output/pilot-audio.mp4 projects/<video-id>/output/review-audio --audio-config projects/<video-id>/audio/audio-config.json
```

An audio pilot is still not automatically release-ready. Listen to the full output, verify pronunciation and loudness, inspect subtitle readability, and confirm every asset's permission.
