# Storyboard 2.1 / 2.2 / 2.3 Contract

The machine-readable contract is `schemas/storyboard.schema.json`; runtime checks live in `src/validation/storyboard-validator.ts`. This reference explains the production rules and does not replace either file.

New project input selection is stored separately in `project-input.json` (schema: `schemas/project-input.schema.json`). `document` allows document-derived text/graphics only; `document-images` requires at least one actual image or screenshot scene. Projects created before this setting existed retain their previous asset behavior. Web URLs must be captured by the Agent to local files before rendering; neither `asset` nor the manifest path accepts a live webpage as a usable image.

## 2.3 内容驱动的画面契约

`init:project` 现在对所有 Style Pack 建立 `schemaVersion: "2.3"` 草稿。保留 `purpose` 表示镜头在叙事中的职责，新增 `visual` 表示观众实际看到的解释方式。Renderer 先由 `visual.kind` 选择构图，再应用 Style Pack 的纸张、字体、配色及动效参数；旧版 2.1/2.2 分镜继续按原路径渲染。

| `visual.kind` | 画面工作 | 必要内容 |
| --- | --- | --- |
| `statement` | 短章节或单句观点 | 标题和 `primaryClaim`；可选逐条入场的 `label` |
| `compare` | 解释两三个主体的差异 | 2–3 个 `node/card`，每个有名称和具体差异说明；不画伪顺序箭头 |
| `sequence` | 解释真实先后关系 | 2–5 个按顺序排列的 `node/card`，相邻主体的显式 `connection` 和 `draw` beat |
| `network` | 解释中心与分支关系 | 3–6 个 `node/card`，`anchorId` 和中心到每个分支的显式连接 |
| `change` | 展示同一对象的前后状态 | 两个有实际状态描述的 `node/card`，`beforeId`、`afterId`，后状态延迟入场 |
| `metric` | 呈现有来源的数值或比较 | 1–4 个数字 `metric`，`visual.source` 指向原文位置；多值有共同 `unit` |
| `media` | 展示用户提供的真实素材 | 恰好一个登记在 manifest 中的 `screenshot/object` |

每个 2.3 scene 需要一句 `primaryClaim`、具体的 `visual.explanation` 及 `visual.representation`。示意图用 `diagram`，真实素材用 `source-media`。分镜不能用未声明的连线、自动排序、装饰图标或无来源的数字冒充解释。主体需要入场 beat，连线需要 `draw` beat；常规入场超过 1.2 秒、转场超过 0.8 秒和阅读时间不足会报警，末动作后少于 0.8 秒稳定画面也会报警。静音版还会提示场景显著长于阅读估算、首主体超过 1.5 秒才出现、相邻主体入场超过 2.5 秒，以及末动作后过长的无变化停留。标题与图解共享阅读窗口，估时取两者较大值；末尾稳定阅读时间已经包含在场景时长内，不重复相加。这些时间均按当前 fps 计算，并在实际画面、音频和全片播放中复核。纯文档静音预览不要求网站截图或底部旁白字幕。

公开样例是 `examples/semantic-visuals/storyboard.json`；六套模板的视频对比使用 `examples/template-families/storyboard.semantic.json`。`npm run preview:semantic -- --output .tmp/semantic-gallery` 可以用同一分镜渲染全部已安装 Style Pack 的完成态，`--portrait` 可检查竖屏。画面能否解释原文仍需人工审阅，自动校验只覆盖结构和时序。

## 2.2 镜头职责版式

新分镜使用 `schemaVersion: "2.2"`，且每个 scene 必须声明 `purpose`：`opening`、`claim`、`process`、`evidence`、`media`、`closing`。Style Pack 中 `retro-zine`、`signal`、`scatterbrain` 及实验性的 `archive-grid`（Clean Editorial）、`signal-noir`（Blueprint）、`studio-frame`（Product Frame）支持这条路径；`retro-windows` 和旧版 2.1 分镜仍走原有坐标版式。2.1 不允许混入 `purpose`。

用户选的是整套视频模板：同一份 2.2 分镜只替换 `style.id/version`，renderer 会按风格与镜头职责选择固定注册的版式。2.2 图层只提供内容，不提供 `x/y/width/height`、旋转、颜色、可见时间窗口或节点状态；这些字段在职责版式中会被拒绝，避免静默忽略。`template` 仍是基础语义标识：`opening`、`claim`、`process`、`closing` 用 `graph-explainer` 并提供 2–5 个 `node/card` 内容层；`evidence` 用 `metric-grid`；`media` 用 `statement`。

| purpose | 当前内容槽位 | 当前限制 |
| --- | --- | --- |
| `opening`、`claim`、`process`、`closing` | 2–5 个 `node/card`，建议 `label` 加简短 `text`；可选一个 `annotation.text` | 按数组顺序展示内容；当前 beat 只可指向主体内容层，使用 enter/reveal/focus/highlight 表达变化 |
| `evidence` | 1–3 个带 `value` 和 `label` 的 `metric` | 数字与口径均可见 |
| `media` | 恰好一个有来源的 `screenshot/object`，可用 `label`、`fit` | `fit: contain` 可保留完整界面 |

职责版式目前执行指向主体图层的 `enter`、`reveal`、`focus`、`highlight`、`count` beat；标题与副标题使用模板默认错时入场。`opening`、`claim`、`process`、`closing` 可以使用顺序内容层和 connection，适合让一段讲稿由一条关系链承载，而不是逐句生成字幕镜头。场景字幕与外部字幕都预留底部区域。文本预检在 2.2 按风格、画幅和镜头槽位估算；超过可读区域必须缩短或拆镜头。旧版 2.2 公开例子保留在 `examples/template-families/storyboard.json`。

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
  The unified `produce --mode review` additionally requires a current
  `storyboard-approval.json` bound to the script, storyboard and visual handoff
  config. A draft stays in `storyboard.draft.json`.
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
