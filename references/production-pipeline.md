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
a new run from `storyboard`. A render resume still respects the explicit
output overwrite guard. Rendering and media inspection happen in a staging
directory beside the final MP4. The video, receipt, 2.4 production lock and
resolved plan, plus any required cover and cover receipt, are prepared before
publication. An explicit `--force` rerender retains the prior package for rollback
until all files are published. A dead process's preparation-only stage can be
cleaned on retry; an interrupted publication or failed rollback retains its
`owner.json` journal and backups and blocks retries, including `--force`, until
the package is inspected and recovered. See [recovery boundaries](../SECURITY.md#本地产物与资源保护).
If outputs change while rendering, publication stops without replacing them.
`--from qa` reuses a fingerprint-matched video and
rebuilds the review frames and contact-sheet pages without rendering again.
Long renders print coarse progress updates near ten-percent milestones. `init:project` creates an empty
draft scaffold; the Agent must first turn source material into a valid draft.

## Route capability check

After reading the request and source, check route dependencies before choosing a style, running `init:project` or writing detailed scene/asset plans. This is an availability check, not an online audition or proof of successful production.

| Requested route | Check before committing to the route |
| --- | --- |
| Local video rendering | Node.js 24+, installed project dependencies, FFmpeg and ffprobe; resolve missing setup using the [installation guide](installation.md). |
| Document-only AI illustration style | A callable native image-generation tool that can deliver inspectable transparent images for local PNG registration; a prompt-writing command alone is insufficient. Keep the existing generated-subject policy. |
| Exact webpage URL for visible imagery or palette reference | An available browser/capture tool and access to the requested page/state. Capture and register the actual local image before its dependent storyboard/asset work. Supplied local images need file access, not browser access. |
| TTS narration | For an existing project, run `list:tts-profiles -- <project-dir>`. Before creating a new project, inspect a creator-specified existing profile with `inspectTtsProfile` from `scripts/lib/tts-profiles.mjs`; if none is supplied or available, identify the setup gap. Check the requested provider/model/voice and report only safe summaries. Once the project exists, list its profiles and pass the chosen path through `--tts-config`. `ready` is local readiness, not online permission. Do not call `preview:tts` or synthesize audio merely to test availability. Follow [TTS setup](tts-setup.md) for missing configuration. |
| External narration | Check access to the supplied recording and measure it immediately. Inspect supplied timing/captions or identify the work needed to create the matching contract after scene mapping under [audio integration](audio-integration.md); duration alone does not establish speech matching. Use script-first handoff only when that is what the creator requested. |

If the creator left the style open, select a content-appropriate route supported by available tools and state the choice. If an explicit style, screenshot source or narrated output lacks a dependency, report the specific gap before dependent initialization/planning; continue source analysis that does not depend on it. Do not silently change those choices or disable an illustration policy. Apply existing authorization to requested generation/capture/audio work; availability checking adds no routine confirmation gate. Recheck affected dependencies when the requested route changes.

## Revising an existing production

Use the existing project for revisions of the same video. Read `project-input.json`, the current `storyboard.json`, `script.md`, `shot-map.md` and `run.json` before editing; retain the source, scene IDs and explicit style/font/pool choices except where the requested change requires otherwise.

1. Before replacing current inputs or video, run `npm run archive:revision -- <project> <revision-id>` using the [compact archive policy](artifact-storage.md). Preserve current inputs, adopted assets/audio, approvals, `run.json`, video, receipt, production lock, QA records, contact sheets and handoff. Include additional manual evidence with `--include <project-relative-path>`. Do not recursively copy `output/`, caches, prior revisions or standalone video-derived review images; omitted images are indexed with hashes for reconstruction from the archived video. Keep external referenced bytes available. This archive is historical evidence, not a relocated project to resume; recorded paths may refer to the original project.
2. Edit `storyboard.json` as the production input and keep narration in `script.md` and the claim/scene mapping in `shot-map.md` consistent. If working in a draft or timing proposal first, inspect the diff and explicitly adopt the intended changes into `storyboard.json`. `produce` always prefers an existing `storyboard.json`; changing only `storyboard.draft.json` does not update production. Do not delete the production file to force promotion.
3. After production-input changes, use `project.status: generated` while preparing the revision. Recheck affected assets, layout and timing; changed narration requires matching TTS or external recordings/captions. Old approval/delivery evidence is historical. In review mode, present the affected changes, obtain genuine renewed approval, set `reviewed`/`approved`, and run `approve:storyboard` before rendering. Fast mode needs no additional storyboard approval.
4. Preview changed scenes and affected handoffs with `preview:shot`, using the chosen mode and a new clip filename. Then rerun `produce` from `storyboard` (the default) with the intended mode, output purpose and audio options explicit. Changed inputs cannot use `--from qa` to reuse an old video. Use later-stage recovery only for unchanged inputs with matching recorded fingerprints.
5. `visual-master` automatically chooses the next versioned output unless forced. Silent previews and narrated pilots use fixed filenames; use `--force` for an authorized replacement only after preserving the previous version. `produce` has no arbitrary `--output` option. Temporary render rollback files are not a durable version archive. Follow the existing picture-lock/retiming contract when previously handed-off audio or visual masters are involved.
6. Inspect the new run's actual artifacts, QA and affected event frames, then perform the full playback review required by the output purpose. Earlier delivery approval never approves the revised video. Report its actual path, delivery status and `run.storage`; investigate the 256 MiB storage warning using `inspect:storage` without automatically deleting history.

## Stage 01 — Intake and route

- Complete the [route capability check](#route-capability-check) before initialization. After selecting the style and fixed/adopted recipe range in Stage 02, initialize with `--slug <topic-slug> --style <id> --input-mode document|document-images`; add `--shots` only for an original-six style. The command adds the local creation date (`YYYYMMDD-`) and a numbered suffix on collision. Use its printed path, copy the source unchanged into `source/` and record its original path. Keep an existing project for [revisions](#revising-an-existing-production); do not reuse an old MP4 to answer a fresh-render request. The creator does not need to supply an ID. `document` needs no creator-supplied image, but AI illustration styles require generated subjects; `document-images` uses local images or exact URLs supplied by the creator. Neither requires clips or audio for a silent preview.
- Infer audience and platform from the source when possible; do not ask the creator to state a purpose just to begin a visual preview. Use landscape canvas when none is specified. Record a duration limit only if the creator supplied one; otherwise derive duration from the script and visible reading time in Stage 03.
- Extract a few key claims with exact source locations; put stable `C1`, `C2`… IDs in `shot-map.md` and mark unsupported claims for review.
- Compare a route that the document and selected images can support with any materially different narrative route in `route-card.md`. Use text, diagrams and data relationships grounded in the document; in image mode, also identify which real image supports which shot. A generic Style Pack sample is not a project-specific preview.
- Record unsupported facts or relationships that the document cannot explain clearly against a route, claim and intended shot in `content-gaps.md`. Narrow the claim or reframe the visual. Do not require a creator-supplied image for `document` mode; follow the selected style's generated-subject requirements.
- Confirm the content fits a structured explainer or product workflow.
- Route live action, character performance, complex 3D and cinematography-first work elsewhere.

Output: `production-brief.md`, `route-card.md`, `content-gaps.md`, and an initial `shot-map.md`. Keep the original source intact.

## Stage 02 — Content and Style Pack

- Preserve source facts and mark uncertain claims.
- Define the one-sentence outcome and visible targets.
- Choose a route before following `style-selection.md`; record whether the route was creator-reviewed or selected only for an automated preview.
- Explain that subject screenshots guide background, text, card and accent colors before style defaults. Capture exact URLs locally, distinguish subject references from citations/competitors, and follow [project colors](project-palette.md). Keep the selected style's composition and motion; only an explicit style-color choice retains default colors when subject references are available. Published style samples show default palettes, not this project's source palette.
- For primary styles, use the [fixed built-in flow](primary-style-production.md) and omit a custom `--shots` pool. For the original six, default to [document-driven shot planning](shot-planning.md): after reading the source, map claims to visible jobs and recommend compatible recipes. Initialize with the adopted pool through `--shots`. Do not fill every library category. Manual pools remain strict; explain title-only or other expression gaps before committing to a long explainer. In fast mode, present the choice briefly and continue; review mode includes it in the existing storyboard gate.

Output: `content-brief.md` and a selected Style Pack.

## Stage 03 — Script and storyboard draft

- Write `script.md` before timing details.
- For current 2.4 projects and legacy 2.3 projects, decide the visible explanation before styling it: one claim per scene, then `compare`, `sequence`, `network`, `change`, sourced `metric`, `media`, or a short `statement`. Specify the actual subjects and relationships in `visual` and the layer/connection graph. Follow the [image provenance and visual-kind rules](../SKILL.md#content-first-video-logic-for-new-projects): generated illustration subjects are diagram content, not real source evidence. A sequence of differently colored text cards does not fulfill this stage.
- A document-only project may use document-derived diagrams. Real website footage is used only when the creator provides a URL or screenshot; a diagram must declare `representation: diagram`. Numeric scenes must record a source location in `visual.source`.
- Replace proposed scene IDs in `shot-map.md` with the stable IDs used by the storyboard. Give each key claim one visible shot job and name the document-derived text, graphic or source-listed image that makes it understandable.
- Map every important meaning to a visible layer, beat target or caption window.
- During validation, check that caption windows overlap beats and that important content layers are actually reached by beats. These are warnings so a producer can review intentional static holds without blocking the contract.
- Create `storyboard.draft.json`; never render it directly.
- Set each scene's duration from its script segment and visible reading time, including the stable final hold; then compute the project duration from the scene timeline. The scaffold's 20 seconds is only a placeholder. For a silent 2.4 or legacy 2.3 preview, estimate headline and diagram-label reading windows separately, use the larger window (units / 5 + 1 second), and adjust for diagram complexity and the selected recipe's writing/reveal/hold budgets. Keep the first subject prompt, reveal later subjects near the corresponding explanation, and trim empty time after the final action. Without measured audio, timing remains provisional. With voiceover, use the measured audio timing instead of the silent reading estimate.

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

- In `document` mode, text and graphics motion styles use text and CSS graphics. AI illustration styles use the actual generated-subject workflow in [illustrated production](illustrated-production.md); register those generated assets before rendering. For text and graphics motion styles, `asset-manifest.json` can have an empty `assets` array; image/screenshot layers and scene-media manifest entries are rejected; palette-reference images are allowed and need not appear on screen.
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

Before rendering and after audio retiming, inspect whether key steps, differences and quantities have visible explanations; review repeated layouts and actions that finish far ahead of speech. Record justified holds or manual-pool limitations in `shot-map.md`. Shared preflight adds warning-only content checks to validation, run records and QA; these neither prove narrative quality nor require an extra approval. See [thresholds and semantic review](shot-planning.md).

For current 2.4 and legacy 2.3 production, complete required asset generation/capture,
inspection and registration, then promote a checked draft to `storyboard.json`
with `project.status: generated` for fast mode. In review mode, use the
reviewed/approved file with a current `approve:storyboard` fingerprint.
Test a representative scene before the whole video. The command renders the scene
from its position on the real timeline and saves `entry-mid`, `complete`,
`before-cut` and, for 2.4, parsed shot-event frames next to the clip. Inspect the
frames and actual clip; a successful short render does not replace full video QA.
Use a new clip filename for each retry. The examples below use fast mode; pass
`--mode review` to both preview and validation/render commands when review was
selected, and reapprove changes before rendering again.

```bash
npm run preview:shot -- projects/<video-id>/storyboard.json <scene-id> projects/<video-id>/output/shot-preview.mp4 --mode fast
```

```bash
npm run validate:storyboard -- projects/<video-id>/storyboard.json --mode fast
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
the whole video at normal speed. Inspect every page in `review-frames.json.pages`,
each scene's complete/pre-cut states and the required 2.4 shot-event coverage.
Automated success proves contracts and
encoding facts, not pronunciation, voice identity, loudness or listening
quality. `visual-preview` stays an inspection file; `visual-master` becomes
`visual-handoff-pending` after automated QA and `visual-handoff-ready` only
after full visual review via `approve:visual-handoff`. An in-project audio
pilot remains `manual-review-pending` until full audio and visual review.

Before playback, prepare a new review file for the current candidate:

```bash
npm run prepare:review -- projects/<video-id> projects/<video-id>/output/manual-review.json
```

The template binds `inputFingerprint` and `outputFingerprint` and leaves every check false. Keep those fingerprints unchanged during review. A new render or changed input requires a new file and another review; do not transfer old checked values. The same command prepares the appropriate checks for a visual master before `approve:visual-handoff`.

After the creator watches the entire audio pilot, they complete the manual review
JSON with a reviewer, notes, and `true` for `fullPlaybackPassed`,
`visualHierarchyPassed`, `textReadabilityPassed`, `transitionTimingPassed`,
`audioQualityPassed`, `captionReadabilityPassed`, and `assetRightsPassed`. Then:

```bash
npm run approve:delivery -- projects/<video-id> projects/<video-id>/output/manual-review.json
```

This checks that the manual review matches the recorded input and video fingerprints, current audio stream,
and automated QA before setting `releaseReady=true` and
`deliveryStatus=release-ready`. The mock TTS test tone cannot pass this gate.

## Project colors

Follow [project colors](project-palette.md) before finalizing the storyboard when product sources or brand colors are supplied. Palette intent is independent of visible input mode. Capture, register and sample first; the final palette is adopted in the storyboard, never inferred during rendering. Use the existing review/fast route, then inspect actual light, dark and source-media representative shots.
