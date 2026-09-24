# Storyboard 2.1 / 2.2 Contract

The machine-readable contract is `schemas/storyboard.schema.json`; runtime checks live in `src/validation/storyboard-validator.ts`. This reference explains the production rules and does not replace either file.

## 2.2 镜头职责版式

新分镜使用 `schemaVersion: "2.2"`，且每个 scene 必须声明 `purpose`：`opening`、`claim`、`process`、`evidence`、`media`、`closing`。Style Pack 目前仅有 `retro-zine`、`signal`、`scatterbrain` 支持这条路径；`retro-windows` 和旧版 2.1 分镜仍走原有坐标版式。2.1 不允许混入 `purpose`。

用户选的是整套视频模板：同一份 2.2 分镜只替换 `style.id/version`，renderer 会按风格与镜头职责选择固定注册的版式。2.2 图层只提供内容，不提供 `x/y/width/height`、旋转、颜色、可见时间窗口或节点状态；这些字段在职责版式中会被拒绝，避免静默忽略。`template` 仍是基础语义标识：`process` 用 `graph-explainer`，`evidence` 用 `metric-grid`，其他职责用 `statement`。

| purpose | 当前内容槽位 | 当前限制 |
| --- | --- | --- |
| `opening`、`claim`、`closing` | `title`，可选一个 `annotation.text` | 大标题与副标题 |
| `process` | 2–5 个 `node/card`，建议 `label` 加简短 `text` | 按数组顺序展示；暂不显示 connection |
| `evidence` | 1–3 个带 `value` 和 `label` 的 `metric` | 数字与口径均可见 |
| `media` | 恰好一个有来源的 `screenshot/object`，可用 `label`、`fit` | `fit: contain` 可保留完整界面 |

职责版式目前仅执行指向主体图层的 `enter`、`reveal`、`count` beat；标题与副标题使用模板默认错时入场。其他 action 与 connection 仍可在 2.1 坐标版式使用。场景字幕与外部字幕都预留底部区域。文本预检在 2.2 按风格、画幅和镜头槽位估算；超过可读区域必须缩短或拆镜头。公开例子见 `examples/template-families/storyboard.json`。

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
- With no overlap transitions, scene durations sum to `project.durationFrames`. An incoming scene's `transitionIn.durationFrames` subtracts that many frames from the total; the shared scene timeline determines render and QA timestamps.
- `project.status` is `draft`, `generated`, `validated`, `reviewed` or `approved`.
  Standalone review rendering accepts only `reviewed` and `approved`; the
  explicit fast execution policy may render `generated` or `validated`.
  A draft stays in `storyboard.draft.json`.
- Style ID and version must match `styles/style-index.json` and the selected `style.json`.

## Scene

Every scene requires:

- stable `id`, semantic `title` and source-faithful `narration`;
- `durationFrames`;
- explicit `template`, `layers`, `connections`, `beats` and `captions`;
- optional `primaryClaim` and `attentionTarget` for review and a deterministic focus target;
- optional `transitionIn` (`overlap-fade`, `overlap-slide`, `overlap-carry`) with `durationFrames`, legacy `transitionOut`, and `outro` with `holdFrames` and `fadeFrames`.

Current production-safe capability:

- templates: `statement`, `graph-explainer`, `metric-grid`, `interaction-flow`;
- layers: `node`, `card`, `label`, `annotation`, `metric`, `screenshot`, `object`, `callout`;
- actions: `enter`, `reveal`, `draw`, `focus`, `highlight`, `count`, `camera-push`, `rotate`, `set-state`;
- transitions: `fade`, `slide`, `paper-wipe`, `carry`.

Template-specific semantic gates apply in addition to the structural schema: `graph-explainer` needs at least two nodes, a connection and a `draw` beat; `metric-grid` needs at least two metrics; `interaction-flow` needs at least two screenshots and an explicit visibility window. `statement` handles claims, headings and conclusions.

## Coordinates and safety

Layer coordinates are relative to the content box inside the selected Style Pack's safe area. Declare `width` and `height` for cards, metrics, screenshots and other bounded objects. Layers with implicit dimensions produce a safe-area warning and require frame review.

For portrait storyboards the runtime and checker use `safeArea.portrait`; otherwise they use `safeArea.landscape`.
Scenes with captions reserve another 120px (landscape) or 160px (portrait) at the bottom of the content box. The caption itself renders in a separate, fixed container. Audio pilot captions use the same bottom band.

## References and timing

- IDs must be unique inside a scene.
- A connection must reference layers in the same scene.
- A beat target must reference a layer or connection in the same scene.
- `count` targets a metric. `draw` targets a connection. Other actions target visible layers according to the capability manifest.
- Beat and caption windows must stay inside the scene.
- Each caption should overlap at least one beat window. A caption with no overlapping beat produces a mapping warning because its meaning may not have a corresponding visual state.
- Long narration should have at least one beat whose target references a layer or connection in the current scene. Important content layers (`node`, `card`, `metric`, `screenshot`, `annotation`) should be reached by beats; decorative `label` layers are not required to animate.
- Screenshot assets resolve relative to the storyboard file and must exist as non-empty files.
- `object` is an asset-backed explanatory subject. It can use `rotate` with `rotationDegrees` for a visible 2D angle change. A `callout` must target an `object` and can enlarge its illustration. Clearly label illustrative objects so they cannot be mistaken for real product footage.
- A `node` may start in `upcoming`, `current`, `completed`, or `resolved`. `set-state` beats change that state from their start frame onward. More than one `current` node at a time is rejected.
- `outro` requires the final beat to finish at least `holdFrames` before `fadeFrames` begins. Captions must end before the fade. Legacy scenes without `outro` retain their previous transition behavior.

Screenshot and object `asset` paths resolve relative to the storyboard and must also be registered in `asset-manifest.json` as `type: "screenshot"` and `type: "image"`, respectively. Relative manifest paths must stay inside the project directory; absolute paths are allowed for explicitly supplied external assets. Duplicate manifest paths are rejected. `visibleFrom` and `visibleUntil` are scene-relative frame numbers and allow deterministic state replacement.

Free-text motion instructions are documentation only. They cannot introduce an action absent from the capability manifest. The checked-in JSON Schema is generated from Zod with `npm run generate:schemas`; edit the TypeScript source, not the generated file.
