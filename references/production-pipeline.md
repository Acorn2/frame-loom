# Production Pipeline

FrameLoom separates semantic decisions from deterministic execution. Each stage produces an artifact and has a stop condition.

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

Output: reviewed `storyboard.json`.

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
