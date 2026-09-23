# Storyboard 2.1 Contract

The machine-readable contract is `schemas/storyboard.schema.json`; runtime checks live in `src/validation/storyboard-validator.ts`. This reference explains the production rules and does not replace either file.

## Root

```json
{
  "schemaVersion": "2.1",
  "style": {"id": "retro-zine", "version": "1.0.0"},
  "project": {
    "title": "Example",
    "width": 1920,
    "height": 1080,
    "fps": 30,
    "durationSec": 20,
    "durationFrames": 600,
    "status": "reviewed"
  },
  "scenes": []
}
```

- `durationFrames` must equal `durationSec × fps`.
- Scene durations must sum to `project.durationFrames`.
- Rendering accepts only `reviewed` and `approved`; a draft stays in `storyboard.draft.json`.
- Style ID and version must match `styles/style-index.json` and the selected `style.json`.

## Scene

Every scene requires:

- stable `id`, semantic `title` and source-faithful `narration`;
- `durationFrames`;
- explicit `template`, `layers`, `connections`, `beats` and `captions`;
- optional `transitionOut`.

Current production-safe capability:

- templates: `statement`, `graph-explainer`, `metric-grid`, `interaction-flow`;
- layers: `node`, `card`, `label`, `annotation`, `metric`, `screenshot`;
- actions: `enter`, `reveal`, `draw`, `focus`, `highlight`, `count`, `camera-push`;
- transitions: `fade`, `slide`, `paper-wipe`, `carry`.

Template-specific semantic gates apply in addition to the structural schema: `graph-explainer` needs at least two nodes, a connection and a `draw` beat; `metric-grid` needs at least two metrics; `interaction-flow` needs at least two screenshots and an explicit visibility window. `statement` handles claims, headings and conclusions.

## Coordinates and safety

Layer coordinates are relative to the content box inside the selected Style Pack's safe area. Declare `width` and `height` for cards, metrics, screenshots and other bounded objects. Layers with implicit dimensions produce a safe-area warning and require frame review.

For portrait storyboards the runtime and checker use `safeArea.portrait`; otherwise they use `safeArea.landscape`.

## References and timing

- IDs must be unique inside a scene.
- A connection must reference layers in the same scene.
- A beat target must reference a layer or connection in the same scene.
- `count` targets a metric. `draw` targets a connection. Other actions target visible layers according to the capability manifest.
- Beat and caption windows must stay inside the scene.
- Each caption should overlap at least one beat window. A caption with no overlapping beat produces a mapping warning because its meaning may not have a corresponding visual state.
- Long narration should have at least one beat whose target references a layer or connection in the current scene. Important content layers (`node`, `card`, `metric`, `screenshot`, `annotation`) should be reached by beats; decorative `label` layers are not required to animate.
- Screenshot assets resolve relative to the storyboard file and must exist as non-empty files.

Screenshot `asset` paths resolve relative to the storyboard and must also be registered in `asset-manifest.json` as `type: "screenshot"`. Relative manifest paths must stay inside the project directory; absolute paths are allowed for explicitly supplied external assets. Duplicate manifest paths are rejected. `visibleFrom` and `visibleUntil` are scene-relative frame numbers and allow deterministic state replacement.

Free-text motion instructions are documentation only. They cannot introduce an action absent from the capability manifest. The checked-in JSON Schema is generated from Zod with `npm run generate:schemas`; edit the TypeScript source, not the generated file.
