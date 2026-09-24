# Production Pipeline

FrameLoom separates semantic decisions from deterministic execution. Each stage produces an artifact and has a stop condition.

## Execution policy

The stages below are always available, but they do not always require a user
interaction:

- `review`: pause at the storyboard and approval gates; render only
  `reviewed` or `approved` storyboards.
- `fast`: run the same validation and QA chain automatically; promote a draft
  to `generated`, then to `validated` after deterministic checks pass. The
  output is an automated preview and still requires playback review.

Use the unified entry point:

```bash
npm run produce -- projects/<video-id> --mode review
npm run produce -- projects/<video-id> --mode fast
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

- Put source material in `source/`.
- Identify audience, platform, canvas and target duration.
- Confirm the content fits a structured explainer or product workflow.
- Route live action, character performance, complex 3D and cinematography-first work elsewhere.

Output: `production-brief.md`.

## Stage 02 — Content and Style Pack

- Preserve source facts and mark uncertain claims.
- Define the one-sentence outcome and visible targets.
- Follow `style-selection.md` and record the selected pack.

Output: `content-brief.md` and a selected Style Pack.

## Stage 03 — Script and storyboard draft

- Write `script.md` before timing details.
- Map every important meaning to a visible layer, beat target or caption window.
- During validation, check that caption windows overlap beats and that important content layers are actually reached by beats. These are warnings so a producer can review intentional static holds without blocking the contract.
- Create `storyboard.draft.json`; never render it directly.
- Without measured audio, treat timing as provisional. For Chinese narration, estimate roughly 3.8–4.5 characters per second and leave breathing room.

Output: `script.md` and `storyboard.draft.json`.

## Stage 04 — Review contract

- Review claims, scene jobs, reading order, timing and Style Pack fit.
- Confirm every beat target exists and every scene has enough final hold time.
- After approval, create `storyboard.json` with `project.status` set to `reviewed` or `approved`.

Output: reviewed `storyboard.json`, or a `generated`/`validated` storyboard
when the fast execution policy is explicitly selected.

## Stage 05 — Assets and provenance

- Put project assets under `assets/` and list their origin and intended use in `asset-manifest.json`.
- Keep relative manifest paths inside the project directory and make the manifest type agree with the storyboard layer type; the asset gate rejects duplicate paths, path traversal and mismatched screenshot metadata.
- Do not replace real product UI with invented screenshots.
- Do not bundle unlicensed fonts, music, images or private assets.

Output: reviewed assets and manifest.

Run the provenance gate before rendering:

```bash
npm run validate:assets -- projects/<video-id>/storyboard.json
```

## Stage 06 — Optional audio timing

- Keep voiceover, captions, music and SFX under `audio/`.
- Record source and license in `audio-config.json`; FrameLoom does not acquire or clone voices.
- Measure actual audio and caption timing before treating scene timing as final.

```bash
npm run inspect:audio -- projects/<video-id>/storyboard.json projects/<video-id>/audio/audio-config.json
```

Output: a timing-compatible audio contract, or skip this stage for a silent preview.

## Stage 07 — Validate and preview

```bash
npm run validate:storyboard -- projects/<video-id>/storyboard.json
npm run validate:assets -- projects/<video-id>/storyboard.json
npm run check:safe-area -- projects/<video-id>/storyboard.json
npm run render:storyboard -- projects/<video-id>/storyboard.json projects/<video-id>/output/preview-silent.mp4
```

Fix every validation and safe-area error before rendering. Warnings about implicit dimensions require visual review.

For an audio pilot, add `--audio-config projects/<video-id>/audio/audio-config.json`. Rendering refuses to overwrite an existing output unless `--force` is explicit.

## Stage 08 — QA and delivery

```bash
npm run qa:storyboard -- projects/<video-id>/storyboard.json projects/<video-id>/output/preview-silent.mp4 projects/<video-id>/output/review-frames
```

For audio, pass the same `--audio-config` used by rendering. Review `qa-report.json` and the contact sheet, then watch the whole video at normal speed. Automated success proves contracts and encoding facts, not visual or listening quality. The default output has no audio track and must be described as a silent visual preview.
