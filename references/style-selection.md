# Style Selection

Style selection happens before the final storyboard. The goal is to narrow the visual system without loading every Style Pack's full design specification.

## 1. Classify the content

Choose one primary content tag from the compact index vocabulary:

- `knowledge`, `opinion`, `story`
- `product`, `tutorial`, `software`
- `learning`, `creative`

Also decide the target canvas: `landscape` or `portrait`.

## 2. Read the compact index

```bash
npm run list:styles
npm run list:styles -- --content product --canvas landscape
```

The command reads only `styles/style-index.json` plus minimal file consistency data. Do not load every `design.md` at this point.

## 3. Compare candidates

Generate a lightweight token gallery:

```bash
npm run preview:styles -- /tmp/frame-loom-style-gallery.html
npm run preview:styles -- /tmp/product-styles.html --content product --canvas landscape
```

Each card contains hook, content and result frames built from the Style Pack tokens. The gallery is a selection aid, not a rendered storyboard or visual QA result.

For the video-template candidates, generate **real Remotion output** from the same seven-scene Storyboard 2.3 semantic example:

```bash
npm run preview:templates
npm run preview:templates -- --portrait --stills-only
npm run preview:templates -- --styles archive-grid,signal-noir,studio-frame
```

The command writes a new directory under `projects/` containing an HTML gallery, storyboard variants, a sourced demonstration illustration, seven representative frames per selected style and, unless `--stills-only` is set, 50.8-second silent MP4s with automated QA reports and review frames. The illustration is a repository fixture, not a real product screenshot. Creators choose `document` without images or `document-images` with local images or captured webpage screenshots for their own projects. Use `--output <new-directory>` to choose a destination; an existing directory is not overwritten unless `--force` is explicitly passed. Automated QA still requires complete human playback. `retro-windows` is deprecated for new selection but remains loadable for existing 2.1 projects. `signal` and the three design-proposal packs are experimental until broader content and playback review is complete.

When the creator asks to compare styles, present up to three candidates with:

- why the style fits the content;
- its reading density and motion character;
- one risk or mismatch;
- supported canvas and templates.

## 4. Select the pack

Honor a creator's explicit Style Pack choice if it supports the requested
canvas and content. For a first visual-preview request without a style choice,
the Agent selects one feasible pack and records its reason in
`production-brief.md`; this routine choice does not stop `fast + silent`.
Present candidates and wait only when the creator explicitly asks to compare
styles or when materially different styles would change the result they asked
to review. In `review` mode, the chosen style remains part of storyboard review.

## 5. Load only the selected pack

After selection, read:

```text
styles/<style-id>/design.md
styles/<style-id>/style.json
styles/<style-id>/motion.json
styles/<style-id>/renderer-map.json
```

Each Style Pack defines `captionInk` separately from body `ink`. Use a readable deep color on light canvases and white on dark canvases; narration captions have no background fill.

Use only templates and actions supported by both the selected pack and `src/renderer/capability-manifest.ts`. The current production-safe templates are `statement`, `graph-explainer`, `metric-grid` and `interaction-flow`.

Project colors can override style colors independently of font and shot selection. See [project colors](project-palette.md); published samples retain their default palettes.
