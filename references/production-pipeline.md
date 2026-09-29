# Production Pipeline

FrameLoom separates semantic decisions from deterministic execution. Each stage produces an artifact and has a stop condition.

## Execution policy

The stages below are always available, but they do not always require a user
interaction:

- `review`: pause at the storyboard gate; render only `reviewed` or `approved`
  storyboards with a current `storyboard-approval.json` fingerprint.
- `fast`: run the same validation and QA chain automatically; promote a draft
  to `generated`, then to `validated` after deterministic checks pass. The
  output still requires the final playback review appropriate to its purpose.

Both modes can produce a silent visual preview, a clean visual master for
external editing, or a narrated video inside FrameLoom. An explicit first
preview request uses `fast + silent + visual-preview` unless the creator asks
for storyboard review. For an unqualified “make a video” request, ask once
whether the creator wants to inspect pictures, hand them to an external editor,
or finish a narrated video inside FrameLoom. A visual master requires a full
visual review; an in-project narrated video requires a voiceover, automated QA
and a separate full playback review. `run.status=completed` reports execution
success; `deliveryStatus` reports the selected handoff or review state.

Use the unified entry point:

```bash
npm run produce -- projects/<video-id> --mode fast --audio-mode silent --output-purpose visual-preview
npm run produce -- projects/<video-id> --mode fast --audio-mode silent --output-purpose visual-master
npm run produce -- projects/<video-id> --mode fast --audio-mode tts --output-purpose in-project-video
npm run produce -- projects/<video-id> --mode fast --from qa
```

The orchestrator records progress in `projects/<video-id>/run.json`, so a
failed stage and its artifacts are visible without reading terminal history.
After a failed run, `--from validation|assets|safeArea|render|qa` reuses only
the successfully completed stages recorded by the previous `run.json`. A
resume also compares fingerprints of project inputs and the rendered video;
changed inputs require an updated `storyboard.json` when content changed, then
a new run from `storyboard`. A render resume still
respects the explicit output overwrite guard. `init:project` creates an empty
draft scaffold; the Agent must first turn source material into a valid draft.

## Stage 01 — Intake and route

- Put an unchanged copy of the creator's source document in `source/` and record its original path. Read `project-input.json` (or initialize a new project with `--input-mode document|document-images`). For a new production, the Agent chooses a meaningful lowercase ASCII topic slug from the source and calls `init:project -- --slug <topic-slug>`; the command adds the local creation date (`YYYYMMDD-`) and a numbered suffix on collision. Use its printed path for later steps. Keep an existing project for revisions of that production; do not reuse an old MP4 to answer a request for a fresh render. The creator does not need to supply an ID. `document` is the default and needs no image; `document-images` uses local images or exact URLs supplied by the creator. Neither requires clips or audio for a silent preview.
- Infer audience and platform from the source when possible; do not ask the creator to state a purpose just to begin a visual preview. Use landscape canvas when none is specified. Record a duration limit only if the creator supplied one; otherwise derive duration from the script and visible reading time in Stage 03.
- Extract a few key claims with exact source locations; put stable `C1`, `C2`… IDs in `shot-map.md` and mark unsupported claims for review.
- Compare a route that the document and selected images can support with any materially different narrative route in `route-card.md`. Use text, diagrams and data relationships grounded in the document; in image mode, also identify which real image supports which shot. A generic Style Pack sample is not a project-specific preview.
- Record unsupported facts or relationships that the document cannot explain clearly against a route, claim and intended shot in `content-gaps.md`. Narrow the claim or reframe the visual. Do not require an image to complete `document` mode.
- Confirm the content fits a structured explainer or product workflow.
- Route live action, character performance, complex 3D and cinematography-first work elsewhere.

Output: `production-brief.md`, `route-card.md`, `content-gaps.md`, and an initial `shot-map.md`. Keep the original source intact.

## Stage 02 — Content and Style Pack

- Preserve source facts and mark uncertain claims.
- Define the one-sentence outcome and visible targets.
- Choose a route before following `style-selection.md`; record whether the route was creator-reviewed or selected only for an automated preview.

Output: `content-brief.md` and a selected Style Pack.

## Stage 03 — Script and storyboard draft

- Write `script.md` before timing details.
- For new Storyboard 2.3 projects, decide the visible explanation before style: one claim per scene, then `compare`, `sequence`, `network`, `change`, sourced `metric`, `media`, or a short `statement`. Specify the actual subjects and relationships in `visual` and the layer/connection graph. A sequence of differently colored text cards does not fulfill this stage.
- A document-only project may use document-derived diagrams. Real website footage is used only when the creator provides a URL or screenshot; a diagram must declare `representation: diagram`. Numeric scenes must record a source location in `visual.source`.
- Replace proposed scene IDs in `shot-map.md` with the stable IDs used by the storyboard. Give each key claim one visible shot job and name the document-derived text, graphic or source-listed image that makes it understandable.
- Map every important meaning to a visible layer, beat target or caption window.
- During validation, check that caption windows overlap beats and that important content layers are actually reached by beats. These are warnings so a producer can review intentional static holds without blocking the contract.
- Create `storyboard.draft.json`; never render it directly.
- Set each scene's duration from its script segment and visible reading time, including the stable final hold; then compute the project duration from the scene timeline. The scaffold's 20 seconds is only a placeholder. For a silent 2.3 preview, estimate headline and diagram-label reading windows separately, use the larger window (units / 5 + 1 second), and adjust for diagram complexity. Keep the first subject prompt, reveal later subjects near the corresponding explanation, and trim empty time after the final action. Without measured audio, timing remains provisional. With voiceover, use the measured audio timing instead of the silent reading estimate.

Output: `script.md` and `storyboard.draft.json`.

## Stage 04 — Review contract

- Review claims, scene jobs, reading order, timing and Style Pack fit.
- Compare `shot-map.md` with the storyboard: every key claim should point to an existing scene, and the scene should visibly do the job listed. Review open gaps for the selected route before rendering.
- Confirm every beat target exists and every scene has enough final hold time.
- After the creator approves, create `storyboard.json` with `project.status`
  set to `reviewed` or `approved`, then record reviewer and notes with
  `approve:storyboard`. Changing the script, storyboard or overlay-region
  config invalidates that approval.

Output: reviewed `storyboard.json`, or a `generated`/`validated` storyboard
when the fast execution policy is explicitly selected.

## Stage 05 — Selected image inputs and provenance

- In `document` mode, use text and CSS graphics. `asset-manifest.json` can have an empty `assets` array; image/screenshot layers and image/screenshot manifest entries are rejected.
- In `document-images` mode, fill `visual-sources.md` with a stable visual ID, the creator's image path or exact URL, intended claim and shot, local file path, and rights/review state. Copy supplied local images into `assets/` when appropriate; do not alter originals.
- For each creator-provided URL, open it in the browser, capture the actual visible page into `assets/`, and record the original and final URL, capture time, viewport, and visible state in `visual-sources.md`. If the page cannot be accessed or captured, mark the image route blocked and tell the creator; do not substitute a fabricated screen or silently fall back to `document` mode.
- Register each used file in `asset-manifest.json` with source, license/permission state and intended use. Use `type: "screenshot"` for webpage captures and `type: "image"` for other images; mark unverified rights as unverified rather than inventing permission. Map the visual/asset ID to the claim and scene in `shot-map.md`.
- In Storyboard 2.3, put each used `screenshot` or `object` layer in a `visual.kind: "media"` scene (`purpose: "media"`) with its local `asset` path. Existing 2.2 projects retain the `purpose: "media"` route. The image mode needs at least one visible image shot. The renderer never fetches a live URL.
- Keep relative manifest paths inside the project directory and make the manifest type agree with the storyboard layer type; the asset gate rejects duplicate paths, path traversal and mismatched types.
- Do not replace real product UI with invented screenshots.
- Do not bundle unlicensed fonts, music, images or private assets.

Output: reviewed assets and manifest.

Run the provenance gate before rendering:

```bash
npm run validate:assets -- projects/<video-id>/storyboard.json
```

## Stage 06 — Audio route and timing

Choose the output purpose and audio source separately. For a preview or visual
master pass `--audio-mode silent` and an explicit `--output-purpose`:

- `silent + visual-preview`: render with optional scene captions and a preview marker.
- `silent + visual-master`: render without an audio stream, narration captions
  or preview marker. Use `visual-handoff.json` to reserve a right column for
  facecam and a bottom band for subtitles; the renderer uniformly scales scene
  content outside those areas. The handoff package includes a stable script,
  scene timing table and picture-lock policy.
- `tts`: use `scene.narration` as the single narration source. FrameLoom
  generates one audio segment per scene, measures each segment with `ffprobe`,
  writes `audio-manifest.json` and `captions.srt`, then renders the audio
  pilot. The segment must fit inside its scene; the tool stops instead of
  silently truncating or stretching speech.
- `external`: place any user-produced voiceover under `audio/` and describe
  it in `audio-config.json`. This route supports recordings, voice cloning,
  third-party TTS and manually edited audio without requiring FrameLoom to
  know how the file was made. Captions must be supplied in the same contract
  when they are needed.

`auto` uses a single enabled TTS configuration first, then enabled external
audio, otherwise silent output. With multiple enabled TTS profiles, the
creator must choose one using `--tts-config`; list safe summaries with
`list:tts-profiles`. An explicit `in-project-video` never falls back to silent.
Music and sound effects alone cannot pass the narration delivery gate.

For script-first external recording, validate and hand off the exact
`script.md` / `scene.narration` version with
`prepare:script-handoff -- projects/<video-id> --mode fast|review`. This stops
at `script-ready` without rendering an MP4. On audio return, compare the
recording to that version, measure it and adjust the storyboard before
`external` production. If the creator starts with recorded audio, skip this
waiting stage. If a visual master was handed off first, keep its versioned
file when audio retiming produces a later in-project video. For a
`picture-locked` master, changing the storyboard before audio return requires
an explicit `--retime-from-master`; the old picture file is preserved.

For the built-in TTS route:

```bash
cp projects/<video-id>/audio/tts-config.example.json projects/<video-id>/audio/tts-config.json
# Set enabled=true and configure the provider environment variables.
npm run synthesize:voiceover -- projects/<video-id>
```

Built-in adapters support Doubao HTTP TTS, OpenAI, ElevenLabs and Alibaba
Cloud Qwen3 TTS. Choose the corresponding disabled config example generated
under `audio/`, copy it to `tts-config.json`, and set `enabled=true`. Endpoint
and voice/model choices stay in the config; credentials stay in environment
variables and must not be committed. `mock` is for deterministic tests and
local pipeline checks. See [Audio Integration](audio-integration.md) for each
provider's example and environment variable.

For external audio:

```bash
npm run inspect:audio -- projects/<video-id>/storyboard.json projects/<video-id>/audio/audio-config.json
```

Output: a timing-compatible audio contract, a script handoff, a visual preview,
or a clean picture master, according to the selected route.

## Stage 07 — Validate and preview

For a new 2.3 production, promote a checked draft to `storyboard.json` with
`status: generated` (or use the reviewed file in review mode), then test one
representative scene before the whole video. This command renders the scene
from its position on the real timeline and saves `entry-mid`, `complete` and
`before-cut` frames next to the clip. A successful short render does not
replace full video QA.

```bash
npm run preview:shot -- projects/<video-id>/storyboard.json <scene-id> projects/<video-id>/output/shot-preview.mp4
```

```bash
npm run validate:storyboard -- projects/<video-id>/storyboard.json
npm run validate:assets -- projects/<video-id>/storyboard.json
npm run check:safe-area -- projects/<video-id>/storyboard.json
npm run render:storyboard -- projects/<video-id>/storyboard.json projects/<video-id>/output/preview-silent.mp4 --mode fast --output-purpose visual-preview
```

Fix every validation and safe-area error before rendering. Warnings about implicit dimensions require visual review.

For an audio pilot, use the unified producer:

```bash
npm run produce -- projects/<video-id> --mode fast --audio-mode tts --output-purpose in-project-video
npm run produce -- projects/<video-id> --mode review --audio-mode external --output-purpose in-project-video --audio-config projects/<video-id>/audio/audio-config.json
```

Direct rendering still accepts `--audio-config` for an already prepared
external audio package. Rendering refuses to overwrite an existing output
unless `--force` is explicit.

## Stage 08 — QA and delivery

```bash
npm run qa:storyboard -- projects/<video-id>/storyboard.json projects/<video-id>/output/preview-silent.mp4 projects/<video-id>/output/review-frames
```

For audio, pass the same `--audio-config` used by rendering. Review
`audio/audio-manifest.json`, `qa-report.json` and the contact sheet, then watch
the whole video at normal speed. Automated success proves contracts and
encoding facts, not pronunciation, voice identity, loudness or listening
quality. `visual-preview` stays an inspection file; `visual-master` becomes
`visual-handoff-pending` after automated QA and `visual-handoff-ready` only
after full visual review via `approve:visual-handoff`. An in-project audio
pilot remains `manual-review-pending` until full audio and visual review.

After the creator watches the entire audio pilot, they provide a manual review
JSON with a reviewer, notes, and `true` for `fullPlaybackPassed`,
`visualHierarchyPassed`, `textReadabilityPassed`, `transitionTimingPassed`,
`audioQualityPassed`, `captionReadabilityPassed`, and `assetRightsPassed`. Then:

```bash
npm run approve:delivery -- projects/<video-id> projects/<video-id>/output/manual-review.json
```

This checks the recorded input and video fingerprints, current audio stream,
and automated QA before setting `releaseReady=true` and
`deliveryStatus=release-ready`. The mock TTS test tone cannot pass this gate.
