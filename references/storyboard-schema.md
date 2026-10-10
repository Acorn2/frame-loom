# Storyboard 2.1 / 2.2 / 2.3 / 2.4 Contract

The machine-readable contract is `schemas/storyboard.schema.json`; runtime checks live in `src/validation/storyboard-validator.ts`. This reference explains the production rules and does not replace either file.

New project input selection is stored separately in `project-input.json` (schema: `schemas/project-input.schema.json`). `document` allows document-derived text/graphics and reference-only palette assets; `document-images` requires at least one actual image or screenshot scene. Projects created before this setting existed retain their previous asset behavior. Web URLs must be captured by the Agent to local files before rendering; neither `asset` nor the manifest path accepts a live webpage as a usable image.

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

## Project-wide font

All supported storyboard versions accept an optional root `font: {id, version}` independent of `style`. Resolve IDs and exact upstream versions from [fonts/font-index.json](../fonts/font-index.json). The registered choices are `source-han-sans-sc`, `source-han-serif-sc`, `lxgw-wenkai`, `smiley-sans`, and `xiaolai`. A storyboard selects one family, not an array or per-scene fonts.

New `init:project` projects record the style's recommendation unless `--font <id>` selects another family. Generated titles, body text, diagram labels, numbers and captions share this family; embedded source-image lettering is unchanged. Sizes, weights and caption colors remain controlled by the style and recipe. Historical boards without `font` retain their original font stacks.

Font files must match their recorded SHA-256 and original OFL license. Missing files, unknown IDs and version mismatches are errors. Font loading completes before mounting scenes that measure text; actual measured title bounds can reject a long title even when approximate preflight passes. Font selection and files enter input/approval fingerprints; 2.4 locks and render receipts record the chosen font. Changing fonts requires a new render and applicable review.

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
  Standalone review rendering and `produce --mode review` both require a
  current `storyboard-approval.json` bound to the script, storyboard and visual
  handoff config. A direct review render accepts only that project's
  `storyboard.json`; public fixtures without approval use `--mode fast`; a draft
  stays in `storyboard.draft.json`.
- The approval fingerprint includes bytes of files listed in
  `asset-manifest.json`, including assets supplied by absolute path outside the
  project. Changing one requires another review before rendering.
- Style ID and version must match `styles/style-index.json` and the selected `style.json`.

## Scene

Every scene requires:

- stable `id`, semantic `title` and source-faithful `narration`; scene IDs use at most 120 ASCII letters, digits, underscores or hyphens, and start with a letter or digit. Narrated scene IDs must also be distinct when case is ignored, and cannot be `voiceover` in any capitalization because TTS uses IDs as audio filenames;
- `durationFrames`;
- explicit `template`, `layers`, `connections`, `beats` and `captions`;
- optional `primaryClaim` and `attentionTarget` for review and a deterministic focus target;
- optional `transitionIn` (`overlap-fade`, `overlap-slide`, `overlap-carry`) with `durationFrames`, legacy `transitionOut`, and `outro` with `holdFrames` and `fadeFrames`.

An overlap declaration uses the shared timeline in every renderer family. The old information fades against the Style Pack background in the first half; the new information fades in during the second half. `overlap-slide` also moves the incoming shot upward 28px. This avoids double titles but briefly exposes the background at the midpoint. Do not add overlaps to TTS shots without retiming the speech and visible handoff; the TTS timing proposal deliberately uses separate shots.

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

## Opt-in 2.3 quality extensions

`visual.networkDirection` defaults to outward; inward requires one edge from each branch to anchorId. `visual.changeMode` defaults to compare; replace requires beforeId/afterId with the same glyph and changes one on-screen object. `visual.mediaFocus` specifies a normalized source-image rectangle (x/y/width/height), local-frame start/duration and a label. Width/height are 0.25–1, the rectangle must fit inside the image, and the animation must finish inside the scene. `visual.shotPattern: "document-conclusion-deal"` is an optional `network` layout: `anchorId` identifies one `node/card` whose `text` is a source excerpt, three other `node/card` layers provide named conclusions, and each conclusion needs an outward connection and its own entry/draw beats. Record the excerpt location in `visual.source`; the shot renders a document-derived diagram, not a website capture. These options are declared in the capability manifest and rejected on unrelated visual kinds. See [quality production](quality-production.md) and the [public fixtures](../examples/quality-production/README.md).

## Storyboard 2.4 controlled shots

2.4 显式启用受控配方；2.1–2.3 不接受 `shot`、`shotRecipes`、`videoTemplate`、`dock`、`demote`、`trace`、`tape` 或新换章转场，且保留原版渲染。2.4 不接受旧 `visual.shotPattern`。用户独立选择顶层 `style` 与 `shotRecipes`，每场保留原 `template`、`visual`、内容与时间字段，增加严格的 `shot`：

```json
{
  "schemaVersion": "2.4",
  "style": {"id": "retro-zine", "version": "1.0.0"},
  "shotRecipes": [
    {"id": "paper-title", "version": "1.2.0"},
    {"id": "list-reveal", "version": "1.2.0"}
  ]
}
```

以上为选择字段片段，完整分镜仍需 `project` 与 `scenes`。`shotRecipes` 是不重复的精确版本集合；每场实际 `shot` 必须属于集合，允许重复使用及只使用部分配方，顺序由场景数组定义。所有已选配方都需与风格／画幅兼容，即使本次未使用；渲染锁也绑定这些定义。未选基础配方时不能自动回退。字段可选以兼容已有 2.4 分镜，独立组合初始化会写入它。

顶层可选 `videoTemplate: {id: "retro-zine-explainer", version: "1.2.0"}` 仅是预设组合快捷入口；使用时 `style` 与默认精确版本一致，另外指定的 `shotRecipes` 也须属于其配方集合。独立组合无需此字段。

| ID（均为 1.0.0） | visual.kind | slots | 约束 |
| --- | --- | --- | --- |
| paper-title | statement | phrases: 1–4 label IDs; emphasis: optional phrase ID | 短语完整构成标题，按明确短语依次显影 |
| title-to-label | statement | title: label ID; items: 2–4 node/card IDs | title 与标题一致，显影后站稳再 demote，正文其后入场 |
| document-conclusions | network | source: node/card ID; items: 恰好3个 IDs | 原文、visual.source、outward 连线；先入场、阅读、dock，再结论 |
| list-reveal | statement | items: 2–4 node/card IDs | 并列无连线；依次入场，默认无持续漂移 |
| compare-reveal | compare | items: 2–3 node/card IDs | 原生文本对照；名称和差异描述皆有依据 |
| network-expand | network | anchor: node/card ID; items: 2–5 IDs | 原生向外关系；每项恰好一条可执行连接，visual.source 必填 |
| semantic-default | 现有7种 | 空对象 | 明确回退；复用语义校验，仍遵守有界动作和阅读预算 |
| blur-slide | statement | phrases: 1–4 label IDs; subtitle: label ID; emphasis: optional phrase | 主副标题共用收敛进度；短语组成 title，副标题不先于主标题 |
| split-text-stagger | statement | phrases: 1–4 label IDs; emphasis: optional phrase | 中文短语遮罩裂升，title≤18字，仅该变体 |
| card-stack | statement | items: 2–4 node/card IDs | 入场全部完成后，第一张卡的唯一 focus 控制整组展开 |
| concept-matrix | statement | items: 2–4 node/card IDs | 必须显式 variant=bento-light-up 或 wireframe-draw-on |
| platform-hinge-rise | statement | items: 恰好2个 node/card IDs; result: node/card ID | 原文证据落定并阅读后 result 入场，visual.source 必填 |
| source-converge | network | items: 2–4来源 IDs; result: 结果 ID | anchorId=result、inward；每个来源到结果有唯一 draw 连接 |
| diagram-cascade | network | root: node/card ID; items: 2–4子节点 IDs | items父先子后，最多三层，唯一父连接，无循环或孤立 |
| lead-word-assemble | statement | phrases: 2–4 label IDs | 短语按顺序组成 title≤18字，首词≤5字。首词唯一 focus，入场后站稳0.6秒；其余短语从 focus 完成后组句。组件等待字体，测量实际首词宽度与基线，不采用段尾急推。 |
| brace-expand | statement | title: label ID | title 与 scene.title 一致且≤18字；标题与括号从同一 enter/reveal 进度展开。字体加载后测量宽度；预检拒绝超出单行的中文。仅适用于带技术/机制语感的标题。 |
| pill-slot-cycle | statement | prefix: label ID; items: 2–4 label IDs; suffix: optional label ID | 句干和可选后缀先落定，每项落定后至少阅读0.8秒才能替换。最长词实际测量以固定宽度；Agent 检查句干与每项语法通顺，最终停在最后一个实际条目，不生成夸大结语。 |
| word-roll | statement | prefix: label ID; items: 2–4 label IDs; suffix: optional label ID | 与轮换句干同样保留每项0.8秒阅读；最长词实际测量、上下滚动与距离模糊，终态零模糊。内容胶囊不是旁白字幕底板。 |
| text-column-converge | statement | prefix: label ID; items: 2–4 label IDs; result: label ID | visual.source 必填。先轮换并阅读全部词；result 唯一 focus 控制一次合拢，完成后 result 的 enter/reveal 给出原文支持的结论。不自动拼接词语制造结论。 |
| evidence-relay | statement | items: 2–4 node/card IDs; keywords: equal number of label IDs | visual.source 必填，每个摘录 label 标记来源位置；证据与关键词按数组一对一，其入场 start/duration 完全相同。每项至少阅读0.8秒；旧词先退、新词后入。只显示自有原文摘录，不导入假网站。 |
| row-embed | statement | items: 2–4 node/card IDs | 自有条目行落入固定文本结构。可选 treatment="masking-tape"，每项唯一 tape beat 必须在该行落位后；两条胶带拍定前短暂晃动，拍定后停止。移除 live-layout、纹理素材及持续相机漂移。 |
| structure-then-text | statement | items: 2–4 node/card IDs | 每个实际矩形对应唯一 trace beat；全部轮廓闭合后才开始文字 enter/reveal。描线带笔头，文字逐字填入。无真实产品生成暗示，未接入逐字3D变体。 |
| timeline-travel | sequence | items: 2–4 node/card IDs; spacing="ordinal" | visual.kind=sequence、template=graph-explainer、visual.source 必填。layer.value 提供严格递增有效 YYYY-MM-DD 日期。日期等距仅表示顺序，画面说明非时间跨度；逐项行进，每项落定后至少阅读0.8秒。 |
| odometer-roll | metric | metric: metric layer ID | visual.kind=metric、template=metric-grid；layer.value 是精度明确的数字字符串，可含负号、1–3位小数，总数字位≤6。单位和来源必填，标签与正文必填。唯一 count 在入场后滚动，各位落定检查点进入QA；符号、小数点、精度、最终真值不变，无计算完成暗示或自动音效。 |

除基础回退外，所有 layer 都必须有唯一内容槽位，不能重复内容或留下不可见图层；emphasis 只引用已有 phrases 中的短语。当前23种专用场景只支持 `retro-zine@1.0.0 + 16:9`；基础配方保留原有风格与画幅。文本、数量、动作范围见 [shot manifests](../shots/shot-index.json)，机器契约见 [shot schema](../schemas/shot.schema.json)、[recipe schema](../schemas/shot-recipe.schema.json)、[template schema](../schemas/video-template.schema.json)。

C01 [marker-underline](../shots/marker-underline/recipe.md) 是受控宿主动作，不是场景或集合 ID。paper-title／blur-slide／split-text-stagger 可将 `slots.emphasis` 指向标题短语，并为该 layer 设置落定后的 highlight beat；动作计入完成态和QA，manifest及来源独立进入生产锁。不接受自由效果数组或自动挑选重点词。

`dock` 用于来源文档停靠，`demote` 用于标题连续降格。均为 layer beat，不接受任意 CSS、文件路径或可执行函数。最短/最长窗口与阶段约束由配方编译器检查，最终完成态到转场前至少留0.8秒。JSON Schema 的版本条件与 Zod 运行时一起拒绝新旧混用。缺少 ID/版本、引用、来源、关系或预算时停止，不自动回退。

`migrate:storyboard` 目前只显式迁移2.3；2.1/2.2 的关系无法从坐标可靠推导，需 Agent 先人工重新编排为2.3。迁移源文件不覆盖，输出 `<new.json>` 与 `<new.json>.migration.json`，清除批准状态；必要的停靠可能引发预算冲突，此时返回错误供重新编排。


C02 `trace` 只在 structure-then-text 上描实际轮廓；C03需 row-embed/card-stack 显式 `treatment: "masking-tape"` 和逐卡 `tape` 阶段；C08需 concept-matrix 的 `revealMode: "card-flip"` 与数量相同的 `slots.fronts` / `slots.items`，不能遗漏正面阅读或来源。

跨场 C10/C13 使用 `transitionIn: {type: "overlap-blinds"|"overlap-push-stack", durationFrames: <0.2–0.8秒>, chapterBoundary: true}`。只支持2.4、retro-zine@1.0.0、16:9；前后章节标题不同，不能用于首场或与旧退出叠加。正文动作从交接结束后开始，场景及外部字幕不能覆盖重叠窗口，有声换章必须提供字幕时间轴。定义与来源进入生产锁，交接中途/结束进入必选QA。契约见 [宿主动作schema](../schemas/auxiliary-recipe.schema.json)、[换章schema](../schemas/chapter-transition.schema.json)。

## P2 数据与宿主契约

37个场景入口中，13个为P2增量。`shot` 的额外输入均为严格字段：research-stack.authors、scroll-brake.focusId、chart-live.samples、particle-sand-fill.grainUnit、member-grid.flagged、code-reveal.mode/tokens、letterspace-materialize.glyphs；内容仍只在真实 layer 槽位保存。字段细节见 [配方目录](../shots/README.md)。缺失数据、失配 token、无来源关系、错误真实图片尺寸会在预检拒绝。

五个新增宿主效果采用 `effects: [{id, target}]`，每场最多一种，绑定实际目标及唯一 highlight beat。冻结位于 focus 内部且保留运动连续性；扫描只在文档正文落定后开始；轮廓微颤不影响正文；重排不新增或丢失成员。

三个新增换章是 overlap-line-carry / overlap-ink / overlap-barn-door，0.6–2.4秒、chapterBoundary=true，只有2.4与已验证横屏风格可用。线条承接额外需要 carryKey，并校验前后 code 图层相同 semanticRole 和 label，每片最多一次。所有新转场进入共享时间线、字幕边界校验、生产锁和必选QA帧。

## Optional project palette (2.4)

`palette` is an explicit optional project input; absence preserves default colors. See [project colors](project-palette.md) and [palette schema](../schemas/project-palette.schema.json). Asset `usage` distinguishes palette references from visible media; input `colorMode` records intent and `colorFallbackReason` records an automatic fallback. Current landscape shots only; historical versions reject this extension. New initialization selects `palettePolicy: source-roles-v1` and requires palette 1.1 when colors are adopted: eight roles including ink, muted and captionInk, with per-role sampling/derivation evidence for asset palettes. Background, ink and accent require direct pixel samples. Source warm/colored backgrounds are supported; legacy palette 1.0 is unchanged. Adopted/derived colors, verified evidence and source bytes enter the production lock and review fingerprints.
