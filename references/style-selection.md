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

For the three current video-template candidates, generate **real Remotion output** from the same five-scene example:

```bash
npm run preview:templates
npm run preview:templates -- --portrait --stills-only
```

The command writes a new directory under `projects/` containing an HTML gallery, storyboard variants, sourced example asset, five representative frames per style and, unless `--stills-only` is set, three 15-second silent MP4s with automated QA reports and review frames. Use `--output <new-directory>` to choose a destination; an existing directory is never overwritten. Automated QA still requires complete human playback. `retro-windows` is deprecated for new selection but remains loadable for existing 2.1 projects. `signal` is experimental until broader content and playback review is complete.

Present up to three candidates with:

- why the style fits the content;
- its reading density and motion character;
- one risk or mismatch;
- supported canvas and templates.

## 4. Stop for selection

Do not create the final storyboard or render a full video until the user selects a Style Pack. If the user delegates the choice, record the choice and rationale in `production-brief.md`.

## 5. Load only the selected pack

After selection, read:

```text
styles/<style-id>/design.md
styles/<style-id>/style.json
styles/<style-id>/motion.json
styles/<style-id>/renderer-map.json
```

Use only templates and actions supported by both the selected pack and `src/renderer/capability-manifest.ts`. The current production-safe templates are `statement`, `graph-explainer`, `metric-grid` and `interaction-flow`.
