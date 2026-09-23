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

Generate a self-contained HTML gallery:

```bash
npm run preview:styles -- /tmp/frame-loom-style-gallery.html
npm run preview:styles -- /tmp/product-styles.html --content product --canvas landscape
```

Each card contains hook, content and result frames built from the Style Pack tokens. The gallery is a selection aid, not a rendered storyboard or visual QA result.

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
