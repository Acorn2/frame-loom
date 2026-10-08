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
- Style Pack and shot recipes are independent choices in Storyboard 2.4; legacy style-only initialization retains 2.3, and existing 2.1 and 2.2 storyboards retain their render paths
- `statement`, `compare`, `sequence`, `network`, `change`, `metric`, and `media` visual kinds in 2.3; the visual kind determines composition before style tokens determine paper, typography, color and motion feel
- an opt-in `network` shot pattern, `document-conclusion-deal`, keeps a sourced document excerpt on the left while exactly three connected conclusions enter in narration order; it uses document text and CSS only
- `opening`, `claim`, `process`, `evidence`, `media`, `closing` scene purposes in 2.2
- `node`, `card`, `label`, `annotation`, `metric`, `screenshot`, `object`, `callout` layers in the legacy renderer; 2.2 purpose layouts use the narrower content slots in `references/storyboard-schema.md`
- `enter`, `reveal`, `draw`, `focus`, `highlight`, `count`, `camera-push`, `rotate`, `set-state` beats in the legacy renderer; 2.2 purpose layouts currently execute only the documented subset
- `fade`, `slide`, `paper-wipe`, `carry` transition declarations
- `project-input.json` with `document` or `document-images` for new projects; legacy projects without it keep their existing asset behavior

## Select a video style and multiple shot recipes

Style Pack controls appearance; a shot recipe controls composition and how information appears over time. The primary workflow lets the creator choose one style and multiple compatible recipes, then the Agent maps source claims to shots. Read the [recipe library](shots/README.md), [shot-index](shots/shot-index.json) and relevant recipes. Use `list:shots -- --style <id> --canvas <orientation>` to inspect actual capabilities, then `init:project -- --slug <topic> --style <id> --shots <id,id,...>` to create a 2.4 planning draft. No preset is required. The selected pool is stored in `shotRecipes`; initialization does not invent scenes or render a video.

The [shortlist coverage ledger](shots/shortlist-coverage.json) records the research candidates. Only entries marked registered-experimental have runtime implementations; native recipes do not count toward the shortlist. Read adaptedImplementations before choosing a family variant. Use `list:shots -- --auxiliary` for hosted actions: marker-underline uses an explicit emphasis phrase and a post-entry highlight beat in its declared title hosts. It is not a scene ID or a pool item. Do not silently substitute pending recipes or unimplemented variants.

当前运行时：37 个场景配方、9 个宿主动作、5 个换章配方；筛选清单接入 48/48。

If the creator supplies no recipe choices, recommend a compatible pool from the document and record the final selection. All 37 current scene recipes support all six active styles in 16:9 landscape; portrait combinations retain semantic-default, which covers seven semantic visual kinds. Switching landscape styles does not narrow the creator-selected shot pool. Hosted actions and chapter transitions inherit the selected host style, while retaining their content and timing requirements. Query `list:shots -- --style <id> --canvas <orientation>` before recommending a pool. Do not silently advertise all style/recipe combinations. A video template is a preset style/recipe combination with matching rules and pacing, available as an optional shortcut through `list:video-templates` and `--video-template`. Currently `retro-zine-explainer@1.2.0` is experimental. Read its [guide](video-templates/retro-zine-explainer/guide.md) only when selecting that preset.

Video style and the project-wide font are independent selections. Use `--font <id>` with `--style` and `--shots`; the registered font IDs are `source-han-sans-sc`, `source-han-serif-sc`, `lxgw-wenkai`, `smiley-sans`, and `xiaolai`. Read [fonts/font-index.json](fonts/font-index.json) to resolve exact versions and provenance. Preserve the creator’s explicit font choice when changing styles. New initialization defaults to the style’s recommended font. Keep `font: {id, version}` on the final storyboard, use one family for generated titles, body text, diagram labels and captions, and leave embedded source-image lettering intact. Existing storyboards without `font` retain the original style font stacks. Missing files or mismatched versions must fail; do not substitute a system font. Font changes invalidate production/review fingerprints and require new render and review. `npm run preview:fonts` generates representative landscape combinations; original style/shot samples retain their original typography and do not demonstrate a newly selected font.

Every 2.4 scene needs `shot`, including `semantic-default`. Slots reference existing layer IDs. Record source location, claim, relation, shot ID/version, selection reason, asset requirements, key cues and fallback reasons in `shot-map.md`. Do not fabricate three conclusions or causal links to match a shot. Scenes may reuse recipes or omit selected recipes; the pool is not a forced sequence. Every scene must use a recipe in `shotRecipes` when it is supplied. If none fits, explain the content gap and request a pool change; do not add `semantic-default` unless it is selected. A requested but incompatible shot must be reported rather than silently replaced. Historical requests naming `retro-zine` select a Style Pack.

`dock` and `demote` are explicit beats; require source/title reading before migration and stable reading after completion. TTS timing proposals bound action lengths instead of stretching all animations with speech; short speech conflicts require shorter content, another shot or split scenes. Audio, subtitles and sound sources use the existing package, never an embedded shot caption or TTS client. `preview:shot` and QA extract every parsed event, including stage handoffs. Inspect all contact-sheet pages and the actual clip. Only truthful complete playback review can authorize delivery.

2.4 rendering binds a production lock and resolved shot plan to the receipt; `produce`, QA, recovery and approval verify the same hash and video bytes. Derived plans are evidence, not editable production inputs. `migrate:storyboard -- <2.3.json> <new-2.4.json>` leaves the source and prior audio/output untouched, maps the old document pilot explicitly, and clears approval. The old 2.1–2.3 routes remain available. See [the 2.4 contract](references/storyboard-schema.md#storyboard-24-controlled-shots).

## Content-first video logic for new projects

Use Storyboard 2.4 for style plus recipe selection or an optional preset; retain the old 2.3 initialization for explicit legacy style-only requests. Read the source and identify one claim per
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
rules. With TTS or external voiceover, measure the audio and align the scene
to that recording. Keep bottom captions to short, single-line phrases. Start
and end each cue without pause punctuation such as commas, periods, semicolons
or colons. Keep punctuation within a cue where it separates clauses, and keep
final question or exclamation marks when they convey tone. Apply this to every
template and audio source; leave narration and TTS input text intact. Start
the next scene within 0.5 second of narration ending. Use a separate scene
for a longer visual hold. Do not add
bottom narration subtitles to a silent document preview merely to fill time.
Common entrances should settle quickly; visible structure must remain long
enough to read. Review entrance midpoint, complete state, pre-cut state,
transition midpoint and the whole video at normal speed. Background motion
and BGM are optional; add them only when they help this particular video.

Use the Style Pack's entrance rule rather than forcing a spring onto every visual. The newest entered or focused subject gets the visual emphasis; earlier subjects stay readable at lower priority. For overlapping visual transitions, inspect the midpoint and both titles; old information fades away before new information appears. A TTS timing proposal keeps narrated scenes separate because narration begins with its shot. After rendering a narrated ending, inspect `checks.audioTail` in QA; more than two seconds of low-level audio is a listening prompt, not an automatic failure. If licensed BGM is enabled, review its default one-second entrance, two-second exit and ducking release against the actual last spoken word.

At storyboard review, decide the handoff at each boundary from the content: a hard cut is valid for a clear new topic, while a silent visual sequence may use a short overlap when two scenes share a visual thread. Do not add overlap to narrated shots merely to satisfy a style checklist. Plan the final card's spoken or musical ending before rendering; if it intentionally ends in silence, record that choice in the review notes. Never add motion behind text just to clear a static-hold warning.

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
scene, measures each segment with `ffprobe`, and derives short, single-line SRT
cues from those measured durations. External audio keeps the user's audio and subtitle files
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
   the filename is Chinese). After selection, step 3 creates
   `projects/YYYYMMDD-<topic-slug>` using the machine's local creation date;
   the initializer adds `-02`, `-03`, etc. when that day's name already exists.
   Do not include style, execution mode or audio mode in the slug. Keep the
   creation date fixed. Continue an existing project only when the creator is
   revising that production; a request for a fresh preview needs a fresh run,
   not an old matching MP4. Do not create the directory manually.
2. Default to `document` and `landscape` when neither is specified. Read the
   document, compare feasible routes, then choose a supported Style Pack and
   a compatible recipe pool using `list:shots`. Record user-selected recipes
   exactly; otherwise recommend the pool from the source. A creator's
   explicit choices take precedence. Do not pause for routine default choices;
   ask only when the source is unreadable, requested material is unavailable,
   or a decision would materially change the requested result.
3. Run `npm run init:project -- --slug <topic-slug> --style <id> --shots <id,id,...>`
   with the selected canvas and input mode. Use the actual project ID printed by the command in
   every later path, then copy the source into `source/source.md` without rewriting it.
   Record the original path and style rationale in `production-brief.md`,
   document the route choice, and tell the creator the project path after it
   exists. Fill `route-card.md`, `content-gaps.md`, `shot-map.md`, `script.md` and
   `storyboard.draft.json` from the actual document. Match claims to source
   locations and visible scene jobs. For each 2.4 scene, select its explicit
   shot and slots from the pool, then make the difference,
   order, connection or state change visible in the chosen visual kind.
   Determine scene count and provisional
   timing from narration, reading time and holds; replace the scaffold's
   20-second placeholder. Keep the draft's status `draft` and never render the
   empty scaffold.
4. For a nontrivial 2.3 storyboard, first promote the source-checked draft to a separate `storyboard.json` with `project.status: generated`. Run `npm run preview:shot -- projects/<id>/storyboard.json <representative-scene-id> projects/<id>/output/shot-preview.mp4` and inspect its entry midpoint, complete state, pre-cut frame and short clip. Revise the storyboard if the picture still reads like a text slide; do not change the source document. Then run `npm run produce -- projects/<id> --mode fast --audio-mode silent --output-purpose visual-preview`.
   Inspect `run.json`, the QA report and representative frames. For a long 2.3 video, inspect every contact-sheet page listed in `review-frames.json.pages` and use its frame range to check each scene's complete and pre-cut state. Resolve actual
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
npm run init:project -- --slug knowledge-explainer --style retro-zine --shots paper-title,document-conclusions,list-reveal,semantic-default --canvas landscape --input-mode document
npm run init:project -- --slug product-walkthrough --style studio-frame --shots semantic-default --input-mode document-images
npm run list:tts-profiles -- projects/my-video
npm run approve:storyboard -- projects/my-video projects/my-video/storyboard-review.json
npm run prepare:script-handoff -- projects/my-video --mode fast
npm run approve:visual-handoff -- projects/my-video projects/my-video/output/visual-review.json
npm run validate:storyboard -- examples/article-video/storyboard.json
npm run validate:assets -- examples/article-video/storyboard.json
npm run check:safe-area -- examples/article-video/storyboard.json
npm run render:storyboard -- examples/article-video/storyboard.json /tmp/frame-loom-preview.mp4 --mode fast
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
- No voice cloning, mastering or universal vendor SDK. Built-in HTTP TTS
  adapters support Doubao, OpenAI, ElevenLabs and Alibaba Cloud Qwen3 TTS;
  credentials remain in environment variables. Other providers use the
  external-audio route.
- Webpage screenshots are captured by the Agent before rendering; the CLI and renderer do not fetch URLs or discover images automatically.
- Automated QA does not replace complete human playback review.

## Quality production updates

Read [quality-production](references/quality-production.md) when producing narrated work or using the opt-in 2.3 semantic extensions. For TTS, use `synthesize:voiceover -- <project> --plan-timing <new-storyboard.json>` after narration and provider use are authorized; inspect and explicitly adopt the proposal, then reapprove in review mode. The proposal measures speech and reuses cached takes; it does not guarantee semantic beat alignment. Never claim estimated subtitles are speech-aligned. Manual cues must retain the original narration.

Use inward network connections for convergence, changeMode replace for a single object's state, and mediaFocus for a sourced image region only when the content needs them. Verify both entry and complete states. A voiced representative clip can use `preview:shot -- ... --audio-config <config>`; inspect its adjacent handoff and actual audio. Final narrated candidates are clean before review; keep their `.render.json` receipt and never fabricate one for an old video. Approval does not remove a marker or change the file.

当前能力以上面的 catalog 摘要和实际兼容清单为准，`validate:shots` 会检查 README 与本 Skill 的摘要是否一致。选择始终是style＋多个场景配方；C类动作只能由声明宿主启用，换章使用transitionIn，不加入--shots。轮换项需独立阅读，证据/词同步，时间线按输入日期等距排序并注明非时间跨度，指标用保留精度的字符串。换章须显式chapterBoundary、无字幕交接窗口；有声换章需字幕时间轴核对关键词。详见[配方库](shots/README.md)。
