---
name: frame-loom
description: Turn documents and structured storyboards into reviewable Remotion previews, clean visual masters for external editing, or narrated videos. Use when planning, producing, or reviewing a FrameLoom video.
---

# FrameLoom Skill

FrameLoom turns a document into a reviewable video with an Agent handling
content decisions and a deterministic Remotion runtime handling validation,
rendering and QA. It is a local, file-based workflow for Codex, Claude Code
and other coding agents, with explicit review and fast execution modes.

For a first visual preview, the creator only needs to provide a readable
document path and ask to see the result. Use `document` unless the creator
supplies images or asks to use screenshots from exact URLs. The Agent extracts
claims, selects a feasible visual route and writes the script and storyboard;
the CLI does not perform those semantic steps. Neither input mode requires
clips, TTS or external audio for a silent preview.

## Use This Skill For

- Knowledge explainers
- Product-document and process explainers
- Report or document summaries
- Metric and relationship explanations

Do not route narrative films, live-action performance, complex 3D scenes or
content whose value depends mainly on generated cinematography to this runtime.

## Current v0.5 Contract

```text
source document -> Agent-authored storyboard.draft.json
  -> fast: promote to generated | review: creator-approved storyboard.json and fingerprint
  -> validate storyboard + assets + safe area
  -> optionally hand off script without rendering, synthesize TTS or load external audio
  -> bundle Remotion
  -> render H.264 visual preview, clean visual master or audio pilot
  -> inspect metadata + extract review evidence
```

The current runtime supports:

- `statement`, `graph-explainer`, `metric-grid` and `interaction-flow` base templates
- all installed Style Packs use the content-driven Storyboard 2.3 route for new projects; existing 2.1 and 2.2 storyboards retain their render paths
- `statement`, `compare`, `sequence`, `network`, `change`, `metric`, and `media` visual kinds in 2.3; the visual kind determines composition before style tokens determine paper, typography, color and motion feel
- `opening`, `claim`, `process`, `evidence`, `media`, `closing` scene purposes in 2.2
- `node`, `card`, `label`, `annotation`, `metric`, `screenshot`, `object`, `callout` layers in the legacy renderer; 2.2 purpose layouts use the narrower content slots in `references/storyboard-schema.md`
- `enter`, `reveal`, `draw`, `focus`, `highlight`, `count`, `camera-push`, `rotate`, `set-state` beats in the legacy renderer; 2.2 purpose layouts currently execute only the documented subset
- `fade`, `slide`, `paper-wipe`, `carry` transition declarations
- `project-input.json` with `document` or `document-images` for new projects; legacy projects without it keep their existing asset behavior

## Content-first video logic for new projects

Use Storyboard 2.3 for new projects. Read the source and identify one claim per
scene. In `shot-map.md`, name what the viewer must understand: a difference,
order, relationship, change, sourced measurement or supplied visual. Choose
`visual.kind` from that job, then specify `visual.explanation`, the visible
subjects, their real connections or before/after states, and timed beats.
An icon beside a paragraph is not an explanation. Do not generate a string of
`statement` scenes to cover a long document; split and graph the claims that
have actual structure. Use media only when the creator supplies a real image,
screenshot or URL to capture. Mark a CSS diagram as `representation: diagram`
and a sourced image shot as `source-media`. Give every metric a traceable
`visual.source`.

For a silent preview, estimate initial scene time from visible reading units
(Chinese characters count as 1; non-space Latin/digits as 0.5; units / 5 +
1 second). The headline and diagram share the same reading window: use the
larger of their estimates instead of adding them as sequential slides. This
window includes a stable final hold; do not append another long hold to every
scene. Show the first subject promptly, introduce further subjects at roughly
1–2.5 second intervals when the content supports it, and trim time after the
last meaningful change. Treat these values as pacing warnings, not fixed
rules. With TTS or external
voiceover, measure the audio and align the scene to that recording. Do not add
bottom narration subtitles to a silent document preview merely to fill time.
Common entrances should settle quickly; visible structure must remain long
enough to read. Review entrance midpoint, complete state, pre-cut state,
transition midpoint and the whole video at normal speed. Background motion
and BGM are optional; add them only when they help this particular video.

Output purpose is independent of `--audio-mode`. A silent `visual-preview` is
for checking pictures. A silent `visual-master` is a clean picture deliverable
for an external editor: no narration captions or preview marker, optional
reserved facecam/subtitle regions, and a script/timing handoff package. It
requires full visual playback review before `visual-handoff-ready`; external
voiceover and facecam editing may finish outside FrameLoom. An
`in-project-video` requires a voiceover, automated QA, and a creator's full
playback review recorded with `approve:delivery`. Audio routes are `silent`,
configured TTS, or externally produced audio.
TTS uses `scene.narration` as its only text source, generates one segment per
scene, measures each segment with `ffprobe`, and derives SRT cues from those
measured durations. External audio keeps the user's audio and subtitle files
as-is and requires an `audio-config.json` contract. Neither route is
release-ready until manual playback review is complete.

## Execution Modes

At the CLI level, `review` is the default mode. It requires `reviewed` or
`approved` storyboard status and a `storyboard-approval.json` fingerprint
created only after the creator has reviewed the script, storyboard, timing and
overlay regions. A later change to these inputs invalidates that approval.
For a creator's explicit first visual-preview request, the Agent selects
`fast + silent` unless the creator asks to review the storyboard first.

`fast` runs the same deterministic validation, asset, safe-area, rendering and
QA stages without stopping for each intermediate confirmation. It can promote
`storyboard.draft.json` to `generated`, then to `validated` after automated
checks pass. Both modes can produce each output purpose; both require final
full playback review for visual handoff or narrated delivery.

```bash
npm run produce -- projects/my-video --mode fast --audio-mode silent --output-purpose visual-preview
npm run produce -- projects/my-video --mode fast --audio-mode silent --output-purpose visual-master
npm run prepare:script-handoff -- projects/my-video --mode fast
npm run produce -- projects/my-video --mode fast --audio-mode tts --output-purpose in-project-video
npm run produce -- projects/my-video --mode review --audio-mode external --output-purpose in-project-video --audio-config projects/my-video/audio/audio-config.json
npm run produce -- projects/my-video --mode fast --from qa
```

Both modes write `run.json` with stage status, warnings, errors and artifact
paths. Fast mode stops on errors and continues past warnings; review mode keeps
the existing human approval gate. `--from` reuses successfully completed
stages from the previous `run.json` only when project inputs and any reused
video match their recorded fingerprints. `init:project` creates an empty draft
scaffold; an Agent must fill it from source material before either mode runs.
`run.status=completed` means the selected pipeline run finished. The separate
`deliveryStatus` is `script-ready`, `preview-only`,
`visual-handoff-pending` / `visual-handoff-ready`, or
`manual-review-pending` / `release-ready` according to the selected route.
Only the corresponding approval command can advance the two final states.

## First-use visual preview

When the creator provides only a readable Markdown or plain-text document path
and asks to see the visual result, carry out the following workflow without
asking for a project ID,
content purpose, input-mode code, template ID, TTS setup or audio file:

1. Read the supplied document and confirm it is accessible. Preserve the
   original. Choose a short, meaningful lowercase ASCII topic slug from the
   document title and content (for example `tongliao-zhihu-update`, even when
   the filename is Chinese). Use `init:project -- --slug <topic-slug>` to create
   `projects/YYYYMMDD-<topic-slug>` using the machine's local creation date;
   the command adds `-02`, `-03`, etc. when that day's name already exists.
   Do not include style, execution mode or audio mode in the slug. Keep the
   creation date fixed. Continue an existing project only when the creator is
   revising that production; a request for a fresh preview needs a fresh run,
   not an old matching MP4. Do not create the directory manually.
2. Default to `document` and `landscape` when neither is specified. Read the
   document, compare feasible routes, then choose one supported Style Pack
   based on its content. A creator's
   explicit choices take precedence. Do not pause for routine default choices;
   ask only when the source is unreadable, requested material is unavailable,
   or a decision would materially change the requested result.
3. Run `npm run init:project -- --slug <topic-slug>` with the selected style,
   canvas and input mode. Use the actual project ID printed by the command in
   every later path, then copy the source into `source/source.md` without rewriting it.
   Record the original path and style rationale in `production-brief.md`,
   document the route choice, and tell the creator the project path after it
   exists. Fill `route-card.md`, `content-gaps.md`, `shot-map.md`, `script.md` and
   `storyboard.draft.json` from the actual document. Match claims to source
   locations and visible scene jobs. For each 2.3 scene, make the difference,
   order, connection or state change visible in the chosen visual kind.
   Determine scene count and provisional
   timing from narration, reading time and holds; replace the scaffold's
   20-second placeholder. Keep the draft's status `draft` and never render the
   empty scaffold.
4. For a nontrivial 2.3 storyboard, first promote the source-checked draft to a separate `storyboard.json` with `project.status: generated`. Run `npm run preview:shot -- projects/<id>/storyboard.json <representative-scene-id> projects/<id>/output/shot-preview.mp4` and inspect its entry midpoint, complete state, pre-cut frame and short clip. Revise the storyboard if the picture still reads like a text slide; do not change the source document. Then run `npm run produce -- projects/<id> --mode fast --audio-mode silent --output-purpose visual-preview`.
   Inspect `run.json`, the QA report and representative frames. Resolve actual
   validation/QA failures before calling the preview complete. Do not use
   `--audio-mode auto` for an explicit silent-preview request.
5. Give the creator a directly openable `output/preview-silent.mp4` link,
   representative frames, the actual duration and a concise QA conclusion.
   State that this is a silent visual preview, not a finished video. Keep the
   project path so a later audio route can reuse the source, script and
   storyboard; offer TTS or external narration as the next step without
   requiring it now.

If the creator says only “make a video,” ask once whether they want to inspect
the pictures first, hand a clean picture master to an external editor, or
finish a narrated video inside FrameLoom. For a visual master, use the same
source and storyboard and set `visual-handoff.json` from the requested facecam
and subtitle positions before rendering. If no working TTS or matching
external voiceover exists, an explicit `in-project-video` request must stop
with an actionable explanation; do not silently deliver a preview instead.
`fast` and `review` govern storyboard approval independently of this route.

## Required Gates

1. Keep `storyboard.draft.json` separate from the reviewed `storyboard.json`.
2. Do not render a storyboard whose `project.status` is `draft`.
3. Keep every beat target inside its scene and every timing value inside its
   scene duration.
4. Honor the creator's selected input mode. In `document`, use document-derived text and graphics only. In `document-images`, use at least one real local image or captured screenshot in a visible shot, and verify its provenance before rendering.
   Check title, card and caption layout warnings or errors before rendering.
5. For TTS, generate audio before rendering; for external audio, provide the
   matching audio and captions contract. A subtitle file is not inferred from
   an unrelated audio file. Run `list:tts-profiles` and show safe profile
   summaries; with multiple enabled profiles, let the creator select one and
   pass its path through `--tts-config`. Never expose credential values.
6. Run `qa:storyboard` after rendering. A successful encoder exit is not enough
   to claim the video passed visual QA.
7. `review` accepts only `reviewed` or `approved` plus a current approval
   fingerprint; `fast` accepts `generated`, `validated`, `reviewed` or `approved`.
   After changing an approved script, storyboard, timing or overlay region,
   show the affected changes and rerun `approve:storyboard` before rendering.
8. For a clean visual master, ensure `script.md` contains the exact narration
   for each scene ID. Set `visual-handoff.json` before review when overlays are
   planned. After automated QA, the creator must watch the whole picture and
   provide a genuine visual review record before `approve:visual-handoff`.
9. For a script-first external audio route, run `prepare:script-handoff`; it
   writes a stable scene-keyed narration package and no MP4. On return, check
   the recording against that version and measure timing before `external`
   production. If an external voiceover arrives at the start, measure it
   immediately and skip the artificial first stage.
10. For project-internal narrated delivery, require a voiceover. Music and SFX
    alone do not satisfy the narration contract. A successful `produce` run is
    not by itself release-ready.

## Commands

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run list:styles
npm run preview:styles -- /tmp/frame-loom-style-gallery.html
npm run preview:templates
npm run preview:shot -- projects/my-video/storyboard.json scene-02 projects/my-video/output/shot-preview.mp4
npm run init:project -- --slug knowledge-explainer --style retro-zine --canvas landscape --input-mode document
npm run init:project -- --slug product-walkthrough --style studio-frame --input-mode document-images
npm run list:tts-profiles -- projects/my-video
npm run approve:storyboard -- projects/my-video projects/my-video/storyboard-review.json
npm run prepare:script-handoff -- projects/my-video --mode fast
npm run approve:visual-handoff -- projects/my-video projects/my-video/output/visual-review.json
npm run validate:storyboard -- examples/article-video/storyboard.json
npm run validate:assets -- examples/article-video/storyboard.json
npm run check:safe-area -- examples/article-video/storyboard.json
npm run render:storyboard -- examples/article-video/storyboard.json /tmp/frame-loom-preview.mp4
npm run qa:storyboard -- examples/article-video/storyboard.json /tmp/frame-loom-preview.mp4 /tmp/frame-loom-review
```

After the Agent creates a valid project storyboard, run `produce --mode review`
for a reviewed storyboard or `produce --mode fast` for an automated preview.

`render:storyboard` already runs output inspection. Run `inspect:output`
separately when checking an existing MP4.

## Agent Workflow

Read references progressively:

1. Infer the input mode from the creator's request. Use `document` by default;
   use `document-images` when the creator supplies or explicitly requests real
   images or webpage screenshots. Initialize with `--input-mode`. For document
   intake, route cards, content gaps, image provenance and claim-to-shot mapping,
   read `references/production-pipeline.md`.
2. After selecting a feasible visual route, read `references/style-selection.md` for Style Pack candidates.
3. Before writing or reviewing JSON, read `references/storyboard-schema.md`.
4. Before delivery, read `references/review-checklist.md`.
5. Route an explicit preview request to `visual-preview + silent`; an external
   editor's picture request to `visual-master + silent`; a project-internal
   narrated request to `in-project-video + tts|external`. Read
   `references/audio-integration.md` for audio. For creator-made audio, check
   the recording against the scene-keyed script; do not claim automated speech
   matching when only duration and encoding were checked. After an audio pilot
   passes QA, ask the creator to review the complete playback; run
   `approve:delivery` only after a genuine manual review record. `mock` is
   test-only and cannot be approved.

Do not load every Style Pack's full design notes. Read only the selected pack after the style gate.

For `document-images`, list supplied image paths or exact creator-provided webpage URLs in `visual-sources.md`. If a URL is supplied, use the browser to capture a real screenshot under the project's `assets/` directory before writing the media shot. Record the original and final URL, capture time, viewport, visible state, local path, and intended claim/shot. Register each file in `asset-manifest.json` (`screenshot` for webpage captures, `image` for other images), then reference it from a `screenshot`/`object` layer in a Storyboard 2.3 `visual.kind: media` scene. A URL is not a renderer asset. If capture fails, report the blocker; do not invent a screenshot or silently switch input modes. Do not claim publication rights that have not been verified.

Do not add a new template or action by inventing free-text motion. Update the
schema, capability manifest, validator fixtures and renderer together.

## Known Boundaries

- No online editor, cloud rendering, account system or automatic publishing.
- No voice cloning, mastering or universal vendor SDK. The first built-in TTS
  adapter is configuration-based Doubao HTTP TTS; credentials remain in
  environment variables and other providers use the external-audio route.
- Webpage screenshots are captured by the Agent before rendering; the CLI and renderer do not fetch URLs or discover images automatically.
- Automated QA does not replace complete human playback review.
