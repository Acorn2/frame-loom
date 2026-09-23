# FrameLoom Skill

FrameLoom turns an approved structured storyboard into a deterministic Remotion
video preview. It is a local, file-based workflow for Codex, Claude Code and
other coding agents.

## Use This Skill For

- Knowledge explainers
- Product and process walkthroughs
- Report or document summaries
- Metric and relationship explanations

Do not route narrative films, live-action performance, complex 3D scenes or
content whose value depends mainly on generated cinematography to this runtime.

## Current v0.5 Contract

```text
reviewed storyboard.json
  -> validate storyboard + assets + safe area
  -> bundle Remotion
  -> render H.264 preview
  -> inspect metadata + extract review evidence
```

The current runtime supports:

- `statement`, `graph-explainer`, `metric-grid` and `interaction-flow` templates
- `retro-zine`, `retro-windows` and `scatterbrain` Style Packs
- `node`, `card`, `label`, `annotation`, `metric`, `screenshot` layers
- `enter`, `reveal`, `draw`, `focus`, `highlight`, `count`, `camera-push` beats
- `fade`, `slide`, `paper-wipe`, `carry` transition declarations

The default v0.5 output is a silent visual preview. Optional local audio,
SRT/VTT captions, music and SFX can produce an audio pilot. Neither mode is
release-ready until manual playback review is complete.

## Required Gates

1. Keep `storyboard.draft.json` separate from the reviewed `storyboard.json`.
2. Do not render a storyboard whose `project.status` is `draft`.
3. Keep every beat target inside its scene and every timing value inside its
   scene duration.
4. Verify screenshot assets and their provenance before rendering.
5. Run `qa:storyboard` after rendering. A successful encoder exit is not enough
   to claim the video passed visual QA.

## Commands

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run list:styles
npm run preview:styles -- /tmp/frame-loom-style-gallery.html
npm run init:project -- my-video --style retro-zine --canvas landscape
npm run validate:storyboard -- examples/article-video/storyboard.json
npm run validate:assets -- examples/article-video/storyboard.json
npm run check:safe-area -- examples/article-video/storyboard.json
npm run render:storyboard -- examples/article-video/storyboard.json /tmp/frame-loom-preview.mp4
npm run qa:storyboard -- examples/article-video/storyboard.json /tmp/frame-loom-preview.mp4 /tmp/frame-loom-review
```

`render:storyboard` already runs output inspection. Run `inspect:output`
separately when checking an existing MP4.

## Agent Workflow

Read references progressively:

1. For candidate filtering and the selection gate, read `references/style-selection.md`.
2. For stage artifacts and stop conditions, read `references/production-pipeline.md`.
3. Before writing or reviewing JSON, read `references/storyboard-schema.md`.
4. Before delivery, read `references/review-checklist.md`.
5. When audio is requested, read `references/audio-integration.md`.

Do not load every Style Pack's full design notes. Read only the selected pack after the style gate.

Do not add a new template or action by inventing free-text motion. Update the
schema, capability manifest, validator fixtures and renderer together.

## Known Boundaries

- No online editor, cloud rendering, account system or automatic publishing.
- No built-in TTS, voice cloning, mastering or vendor-specific audio SDK.
- No automatic asset acquisition.
- Automated QA does not replace complete human playback review.
