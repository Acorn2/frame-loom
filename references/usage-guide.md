# FrameLoom 使用指南

首次安装与排错见[安装指南](installation.md)，自带样片和文档试跑见[项目首页](../README.md#快速开始)。本文保留制作路线、手动 CLI、字体与音频配置，以及审核交付的详细步骤；所有命令从仓库根目录运行。

FrameLoom 是一个以 Codex 为主要入口、兼容 Claude Code、Kimi Code、OpenCode 等 Coding Agent 的结构化视频生产 Skill。Agent 负责从文档提炼内容并编写分镜，Remotion 负责校验、渲染和 QA。

当前为 **v0.5 公开测试阶段**，已跑通“文档 → 分镜 → 渲染 → QA”的本地闭环。`fast` / `review` 控制分镜审核；交付用途可选审片预览、供外部剪辑的干净画面底片或项目内有声视频。音频可来自内置 TTS 或用户提供的录音。

从**已有文档**（文章、讲稿或产品说明）开始即可。首次体验默认使用纯文档、横屏和静音预览；有本地图片或指定网页截图时可选择“文档＋图片”。主张提炼、画面路线和内容缺口由 Agent 判断，仍需创作者审阅；CLI 不会自动理解一篇文章。

```text
source document + video style + selected shot recipes → claims and shot planning → Storyboard 2.4 → validation → preview / visual master / narrated video → QA report
```

**静音 MP4 有两种不同用途。**`preview-silent.mp4` 是带审片标记的画面预览；纯文档静音预览不会为了填充时间自动增加底部旁白字幕。`visual-master-vNNN.mp4` 是无音轨、无旁白字幕和审片标记的干净画面底片，可供创作者在剪辑软件里配音、叠加出镜画面和字幕。底片经完整视觉检查后可以完成 FrameLoom 的**画面交付**；外部剪辑完成的视频由外部流程验收。若要在 FrameLoom 内完成有声讲解视频，则必须接入匹配的旁白，完成音频与画面 QA，再完整播放人工复核。

当前已知限制及实测时间提案、字幕修订、镜头扩展用法见[质量生产说明](quality-production.md)。发布状态与验证缺口见[发布检查记录](release-readiness.md)。

历史 Storyboard 2.3 可选用文档镜头试点 `document-conclusion-deal`：保留来源摘录，并随旁白逐条呈现三条有连接的结论；使用方式和输入约束见[分镜契约](storyboard-schema.md#opt-in-23-quality-extensions)。

较长的 2.3 视频会按每页最多 48 帧生成审片接触表，`review-frames.json.pages` 可定位每页的帧号与时间范围。渲染会先在隔离目录完成媒体检查，失败后可根据 `run.json` 从 `render` 或 `qa` 阶段恢复；人工全片播放仍是交付前提。

## 选择风格、镜头配方、模式和交付目标

用户只需给出材料和想得到的结果，**不需要知道项目 ID、填写 JSON 或运行 CLI**。先决定交付什么，再决定是否要在渲染前审核分镜；输入是纯文档还是文档＋图片，不影响下面的选择。

**先选视频风格与全片字体，再选多个兼容的镜头配方。**风格决定默认配色、形状与基础入场方式，并为基础图解提供各自的标题构图和流程布局。提供主体截图时，背景、文字、卡片和强调色优先参考截图，风格保留构图、装饰与动效。全片字体独立单选，统一应用于标题、正文、图解和旁白字幕；专用配方负责证据驻留、标题降格、要点展开等具体镜头动作。你可以指定集合，也可以让 Agent 根据原文推荐并说明逐场选择。可用组合见[镜头配方库](../shots/README.md)，`retro-zine-explainer` 仅是预设组合的快捷入口。风格／配方选择与 `fast`／`review`、音频来源、交付目标互不绑定。

### 截图配色与风格配色

**有主体截图时，优先参考截图配色，不完全依赖视频风格默认色。** 你可以提供本地截图，或提供准确网址让 Agent 截图。背景、标题／正文、卡片表面和强调色分别参考来源，不仅取按钮颜色；来源中的暖色或有色背景可保留，真实截图不重新染色。选择 `retro-zine` 等风格只确定画面语言，不强制使用其默认色。

| 配色选择 | 实际行为 |
| --- | --- |
| 自动判断（默认，`--color-mode auto`） | 主体产品截图用于全片配色；引用、竞品截图不自动决定主体颜色。没有配色参考时沿用风格与配方默认色 |
| 跟随产品素材（`--color-mode source`） | 必须使用有效截图来源及完整取色记录，缺少来源时说明缺口，不静默回退 |
| 使用风格配色（`--color-mode style`） | 明确保留风格与配方默认色；画面中的真实截图仍保持原貌 |

素材配色目前支持六套当前风格与40个当前横屏场景。Agent 会记录取色与推导理由，并在实际镜头中检查颜色及文字可读性；公开样片仍展示默认色。操作与校验细节见[项目配色](project-palette.md)。

### 初始化与审核模式

**默认值要分清：**直接运行 `init:project` 且省略 `--style`，代码默认使用 `retro-zine`；通过 Skill 未指定组合时，Agent 应查可用能力后推荐风格和配方集合。CLI 用 `--style <id> --font <font-id> --shots <id,id,...>` 初始化独立组合；只传 `--style` 的旧 2.3 入口仍保留。`review` 审核组合与逐场编排，`fast` 按已说明的选择继续。

| 分镜模式 | 渲染前的停点 | 适合什么时候使用 |
| --- | --- | --- |
| `fast` | Agent 写好讲稿和分镜后自动校验、继续执行；中途不等分镜批准 | 首次试效果，或已经确定制作方向、希望连续完成当前阶段 |
| `review` | Agent 先展示讲稿、分镜、时间安排和画面预留区；你确认后记录当前版本的审核指纹，才能交讲稿或渲染 | 要先核对观点、镜头、字幕或后期叠加位置，再进入生产 |

`fast` 和 `review` **都能**制作下表中的任一种结果。`review` 不是音频开关；它只增加分镜审核停点。两者都要通过自动校验；底片交后期和项目内有声视频还各有一次**完整播放人工复核**。修改已批准的讲稿、分镜、素材、模板或画面预留配置后，需要展示变更并重新批准。

| 这一步要拿到什么 | 音频与阶段 | 主要文件 | `run.json` 的 `deliveryStatus` |
| --- | --- | --- | --- |
| 静音审片预览 | 不用音频，一阶段 | `output/preview-silent.mp4` | `preview-only`；仅供检查画面 |
| 供后期剪辑的干净画面底片 | 不用音频，一阶段；可在外部完成最终视频 | `output/visual-master-vNNN.mp4`、讲稿、逐镜时间表 | 自动 QA 后 `visual-handoff-pending`；全片视觉复核后 `visual-handoff-ready` |
| 使用真实 TTS 的项目内有声视频 | 配置可用时可一阶段完成渲染 | `output/pilot-audio.mp4` | 自动 QA 后 `manual-review-pending`；全片复核后 `release-ready` |
| 先交讲稿，再等外部配音回流 | 两阶段；第一阶段**不生成 MP4** | 先交 `output/script-handoff/`，音频回来后再交 `output/pilot-audio.mp4` | 先 `script-ready`，再 `manual-review-pending` |
| 先交画面底片，之后让外部配音回流 | 两阶段；第一阶段**确实生成静音 MP4** | 先交底片，再另出 `output/pilot-audio.mp4` | 先 `visual-handoff-pending`／`visual-handoff-ready`，再 `manual-review-pending` |
| 开始时已有匹配的外部录音 | 可直接一阶段合成，无需虚构等音频的阶段 | `output/pilot-audio.mp4` | 自动 QA 后 `manual-review-pending` |

下面的 `<文档绝对路径>`、`<音频绝对路径>` 和可选的 `<字幕绝对路径>` 换成真实路径即可。每个新场景可从新项目开始，由 Agent 自动创建目录；同一条两阶段路线的第二阶段必须回到**刚才那个项目**。独立测试“讲稿先行”时，应在尚未渲染视频的新项目开始，不能对已经有 MP4 生产记录的项目补跑讲稿交接。

### 先看画面：静音审片预览

首次尝试可用上文的指定风格与配方输入；若要和 `review` 比较同一组合，`fast` 使用：

```text
请使用 frame-loom Skill，读取 <文档绝对路径>，用 fast 模式制作静音视频预览。
视频风格：retro-zine；镜头配方：请根据文档推荐兼容集合。
```

`review` 使用：

```text
请使用 frame-loom Skill，读取 <文档绝对路径>，制作静音视频预览。
使用 review 模式，先给我审核讲稿、分镜和时间安排；我确认后再渲染。
视频风格：retro-zine；镜头配方：请根据文档推荐兼容集合。
```

预期：`review` 在你确认前**没有 MP4**；确认后与 `fast` 一样得到 `preview-silent.mp4` 和代表帧。它带审片标记，不能当作交给后期的干净底片；只有接入实际旁白或明确提供字幕素材时才制作旁白字幕。审过预览后，可以在**同一项目**提出“导出干净画面底片”或“接入音频做有声版”，无需重新提供文档。

### 交画面给后期：干净静音底片

```text
请使用 frame-loom Skill，读取 <文档绝对路径>，用 fast 模式制作供后期剪辑的干净静音画面底片。
我会在外部自己配音，并在右上角叠加出镜画面、底部加字幕；请为这些位置留白，交付讲稿和逐镜时间表。
视频风格：retro-zine；镜头配方：请根据文档推荐兼容集合。
```

`review` 的输入：

```text
请使用 frame-loom Skill，读取 <文档绝对路径>，制作供后期剪辑的干净静音画面底片。
使用 review 模式，先给我审核讲稿、分镜、时间安排和留白区域；我确认后再导出。
我会在外部自己配音，并在右上角叠加出镜画面、底部加字幕；请为这些位置留白，交付讲稿和逐镜时间表。
视频风格：retro-zine；镜头配方：请根据文档推荐兼容集合。
```

底片无音轨、无逐句旁白字幕和审片标记，但保留必要的标题、图解和步骤文字。请完整查看底片，确认留白和可读性后再标记为 `visual-handoff-ready`。若后期在剪辑软件里配音和叠加人像，FrameLoom 到此就完成**画面交接**，无需把音频交回项目。

### 用 TTS 在项目内制作有声视频

```text
请使用 frame-loom Skill，读取 <文档绝对路径>，用 fast 模式制作项目内有声视频。
使用已配置的真实 TTS；如果有多个可用配置，先列出名称、服务和音色让我选一个。
视频风格：retro-zine；镜头配方：请根据文档推荐兼容集合。
```

`review` 的输入：

```text
请使用 frame-loom Skill，读取 <文档绝对路径>，使用已配置的真实 TTS 制作项目内有声视频。
使用 review 模式，先给我审核讲稿、分镜和时间安排；我确认后再合成。
如果有多个可用配置，先列出名称、服务和音色让我选一个。
视频风格：retro-zine；镜头配方：请根据文档推荐兼容集合。
```

只有一个可用的真实 TTS 配置时，Agent 应告知实际选用项；多个配置必须选定其中一个，不能替你猜。尚无真实配置时，应说明缺口，不能把静音预览或 `mock` 语音冒充可交付有声视频。真实 TTS 生成后要按实测音频时长检查分镜；若因此修改已批准内容，`review` 必须再次确认。通过自动 QA 得到的是**有声待审版**，完整播放复核后才可标记 `release-ready`；`mock` TTS 只用于测试管线。

### 用外部配音：选讲稿先行或画面先行

**讲稿先行**适合先按稳定讲稿录音，再让音频返回 FrameLoom。第一阶段请求：

```text
请使用 frame-loom Skill，读取 <文档绝对路径>，用 fast 模式先交视频讲稿和分镜。
我会据此录制配音，收到音频前不要渲染 MP4。
视频风格：retro-zine；镜头配方：请根据文档推荐兼容集合。
```

`review` 的第一阶段输入：

```text
请使用 frame-loom Skill，读取 <文档绝对路径>，用 review 模式先准备视频讲稿和分镜。
先给我审核讲稿和分镜；我确认后再交给我录音。收到音频前不要渲染 MP4。
视频风格：retro-zine；镜头配方：请根据文档推荐兼容集合。
```

第一阶段应得到按镜头编号的讲稿和 `script-ready`，**不会得到静音预览**。配音完成后，在原项目的对话中继续，沿用第一阶段选定的模板：

```text
这是上一阶段讲稿对应的配音：<音频绝对路径>。
请在同一个 FrameLoom 项目里核对讲稿版本，按实际声音时长调整画面并制作有声待审视频。
```

如果已有对应的 SRT/VTT 字幕文件，在请求末尾附上其绝对路径。

**画面先行、音频再回流**适合先确定镜头和时间线。第一阶段可以沿用上面的 `fast` 或 `review` 底片输入，并补一句“我之后会把配音交回这个项目合成有声版”；此时**已有静音 MP4**。录音回来后，在同一项目发送上述配音请求。若录音时长与底片不同，先确定保持 `picture-locked` 画面让配音适应，还是按 `audio-adjustable` 方案调整分镜并另出新版；已交出的底片不应被覆盖。`review` 模式下，因音频而修改已批准时间线时还需重新审核。

**已经录好音**时，可以直接开始，不必先制作静音文件或等待第二次交接：

```text
请使用 frame-loom Skill，读取 <文档绝对路径> 和已有配音 <音频绝对路径>，用 fast 模式制作项目内有声视频。
请先核对配音与讲稿是否匹配，按实测时长安排画面，完成后交给我审片。
视频风格：retro-zine；镜头配方：请根据文档推荐兼容集合。
```

`review` 的输入：

```text
请使用 frame-loom Skill，读取 <文档绝对路径> 和已有配音 <音频绝对路径>，制作项目内有声视频。
使用 review 模式，先核对配音与讲稿是否匹配，并给我审核讲稿、分镜和时间安排；我确认后再合成。
视频风格：retro-zine；镜头配方：请根据文档推荐兼容集合。
```

外部音频须能读取、来源和使用权清楚，并与已交讲稿相符；可提供 SRT/VTT 字幕。两条外部配音路线完成自动 QA 后都处于 `manual-review-pending`，需要完整播放并确认声音、字幕和画面后才能标记 `release-ready`。

下面是[公开纯文档试点](../examples/creator-production-pilot/README.md)的实际渲染帧，用于展示一种画面效果；运行上面的提示词会依据**你的文档**另建项目并生成专属 MP4。

![纯文档试点的流程镜头](../examples/creator-production-pilot/previews/process.png)

## 风格 + 多镜头配方（2.4）

主入口是独立组合，使用配方不必先选预设模板。风格控制外观，配方集合限定可选镜头，Agent 再按内容决定每场使用哪个配方。要直接开始制作，可复制开头的 Agent 指令；下面是手动运行 CLI 的步骤。

### 查询组合并初始化项目

在仓库根目录执行，首次使用先安装项目依赖：

```bash
cd "<仓库绝对路径>"
npm ci
npm run list:styles
npm run list:shots -- --style retro-zine --canvas landscape
npm run init:project -- --slug my-explainer --style retro-zine --shots paper-title,document-conclusions,list-reveal,concept-matrix,compare-reveal,semantic-default --canvas landscape --input-mode document
```

`--slug` 换成简短的英文主题，不带日期。命令打印 `PROJECT INITIALIZED` 和实际项目绝对路径，目录格式为 `projects/YYYYMMDD-my-explainer`，同日同名会加序号。后续命令使用这个实际路径；继续同一条视频时无需重新初始化。

草稿中的 `shotRecipes` 固定可用集合，逐场 `shot` 填实际选用项；允许重复、调整顺序和只用其中一部分，不能悄悄添加集合外镜头。初始化只创建待编排文件，不读取文档、不渲染视频。具体说明及适配上游的方法见[配方库](../shots/README.md)。当前全部 40 个场景配方支持六套风格的 16:9 横屏；竖屏可选基础语义配方及操作筛选、结果生成和单位点阵重组；不支持的组合会明确报错。`--shots` 只接收场景配方 ID，辅助动作和跨场转场不能填入这个参数。

### 让 Agent 完成原文到分镜的编排

初始化后，在 Agent 对话框输入下面的指令，把两个路径替换为真实绝对路径：

```text
请使用 frame-loom Skill，在已初始化的 <项目绝对路径> 中继续制作。
读取 <文档绝对路径>，完整保留原文及来源路径，沿用项目已有风格和 shotRecipes 集合。
完成讲稿、shot-map 和 Storyboard 2.4；根据内容选择、重复和排列镜头，不必全部使用。
将编排完成的分镜保存为 storyboard.json，fast 模式使用 generated 状态，并通过校验。
先完成编排与校验，渲染由我在终端执行。
```

原始文章不能直接传给 `produce`；它需要已经编排的项目。`storyboard.draft.json` 也不能直接传给渲染命令。若只有**编排完成且有效**的草稿，`produce --mode fast` 可以生成 `storyboard.json` 后继续；已有 `storyboard.json` 时则以它为输入，不会自动采用后来修改的草稿。

### 校验并制作视频

把变量值换成初始化命令打印的实际项目路径，再在同一个终端执行：

```bash
video_project="<项目绝对路径>"
npm run validate:storyboard -- "$video_project/storyboard.json" --mode fast
npm run produce -- "$video_project" --mode fast --audio-mode silent --output-purpose visual-preview
```

成功后查看项目内的 `output/preview-silent.mp4`、`output/preview-silent-review/qa-report.json` 和 `run.json`。`produce` 包含校验、渲染和 QA，无需再手动重复渲染。它是静音审片预览；若要交给剪辑软件配音，可改为制作干净画面底片：

```bash
npm run produce -- "$video_project" --mode fast --audio-mode silent --output-purpose visual-master
```

若要在项目内制作有声视频，先按下文[音频配置步骤](#6-接入音频制作项目内有声视频)启用真实 TTS 配置，再运行：

```bash
npm run list:tts-profiles -- "$video_project"
npm run produce -- "$video_project" --mode fast --audio-mode tts --output-purpose in-project-video --tts-config "$video_project/audio/tts-config.json"
```

`--tts-config` 指向实际启用的配置文件，不能使用默认关闭的 `.example.json`。如果实测语音时长与分镜不匹配，命令会报错；让 Agent 根据[质量生产说明](quality-production.md)生成时间提案、检查镜头动作和阅读窗口，再采用提案重新校验、制作。成功后的有声输出是 `output/pilot-audio.mp4`，自动 QA 后仍需完整播放复核。外部录音和 `review` 模式的命令见下文；`review` 需要先审过分镜并记录当前版本的审核指纹，不能只替换命令中的模式就直接渲染。

镜头配方当前使用白色、冷灰或石墨底色，封面和样片由同一 renderer 生成；风格提供强调色；新项目的全片字体独立选择。P1 视觉优化记录见[P1复核](../examples/shot-recipes/p1-visual-review/README.md)；新增 P2 的输入条件、动效阶段与实际检查见[P2施工清单](p2-recipe-implementation.md)。

### 预设组合快捷入口

首套视频模板 **`retro-zine-explainer@1.2.0`** 为 experimental：默认 `retro-zine@1.0.0`，仅适配 16:9 横屏。包含纸面标题、标题降格、原文与三条结论、并列清单、原生文本对照及向外关系展开；另有 `semantic-default` 保留其他语义图解和收尾。模板选用与素材条件见 [guide](../video-templates/retro-zine-explainer/guide.md)，实际帧和验证缺口见 [preview](../video-templates/retro-zine-explainer/preview.md)。

```text
请使用 frame-loom Skill，读取 <文档路径>，用 fast 模式制作静音预览。
视频模板：retro-zine-explainer
```

```bash
npm run list:video-templates
npm run init:project -- --slug my-explainer --video-template retro-zine-explainer
npm run validate:shots
npm run migrate:storyboard -- <old-2.3.json> <new-2.4.json>
```

Agent 按原文选择镜头，逐场显式填写精确 `shot` 与 layer 槽位；模板不会强制每篇文章使用全部镜头。指定模板与 `style` 必须匹配，未支持画幅或镜头会报错。仍说“视频模板：retro-zine”时按历史风格选择理解，不自动改成新镜头序列。`init:project --style` 的 2.3 入口继续保留。

2.4 的 dock、demote 和逐项入场全部进入 beats；实测音频提案保留动作范围、阶段顺序与阅读窗口。渲染记录绑定所选模板、配方、风格、代码与解析计划，派生证据存于 `<video.mp4>.production/production-lock.json` 和 `resolved-shot-plan.json`，更改输入或实现后须重新渲染。QA 覆盖每个动作中途与结束，不以自动通过代替完整播放复核。迁移只输出新文件和报告，不继承审核状态；2.1/2.2 继续保留原路径，转为语义镜头需人工编排。

公开示例：[资料笔记](../examples/video-templates/knowledge-notes/README.md)、[演示产品更新](../examples/video-templates/product-update/README.md)，以及 [单镜 fixture](../examples/shot-recipes)。两份原始文档均为自有演示材料，不代表第三方产品事实。阶段完成情况、实际验证与剩余缺口见[实施记录](video-template-refactor-status.md)。

当前运行时：40 个场景配方、9 个宿主动作、5 个换章配方；筛选清单接入 48/48。

场景配方包括原筛选清单34个上游方法适配、3个新增上游方法适配和3个原生配方。P2 新增了资料卡堆、列表压弹、中枢翻面、滚动刹停、真实曲线、粒子柱图、成员网格、环形注释、循环节点、前后对照、文档书写、代码揭示和字形描画。具体适配变体见[台账](../shots/shortlist-coverage.json)。`npm run list:shots -- --auxiliary` 查询辅助动作，`--transitions` 查询换章配方，均不计成独立正文镜头。

P2 支持六套当前风格的 16:9 横屏，保持 experimental。数据类需要真实记录和单位；前后对照需要两份有来源、同尺寸同视角素材；代码需要原文；字形描画需要输入 SVG 几何。辅助效果在场景 `shot.effects` 中绑定指定宿主与目标，使用显式 `highlight` 阶段；换章在 `transitionIn` 中声明并避开字幕。不能仅凭一句需求让 renderer 编造这些输入。网页仍在三个独立页面选风格、勾选场景、导出制作指令。

原先接入的27份配方已重做动效和视觉：21个上游场景与4个宿主动作使用 `1.2.0`，两个换章配方保持 `1.0.0`，3个原生场景保留。风格提供配色与推荐字体，项目可独立选择全片字体；各镜头分别采用纸面、深色柔光、灰白空间、浅色矩阵或仪表等构图与材质；网页样片与实际生产共用 renderer。旧分镜的 `1.0.0`、`1.1.0` 按精确版本继续使用原渲染器，`--shots` 新建项目取当前版本。桌面每次只自动播放一张最充分可见的卡片；手机、省流量和减少动态效果模式保留静态封面，详情可切换矩阵线框与卡堆胶带。范围见[视觉实施矩阵](shot-visual-redesign.md)，实测见[复核记录](../examples/shot-recipes/visual-review/README.md)。

## 全片字体选择

视频风格与字体独立选择，一次选择一个字体家族。风格页提供五套字体的真实字形与六套风格 × 五套字体的横屏组合样片。墨白杂志推荐思源宋体、手绘便签推荐霞鹜文楷，其余风格推荐思源黑体；手动选字体后切换风格保留该选择，“使用当前风格推荐字体”恢复跟随推荐。字体与其他公开选择跨页保存，并进入 Agent 制作指令。

```bash
npm run validate:fonts
npm run preview:fonts
npm run init:project -- --slug font-demo --style scatterbrain --font source-han-sans-sc --shots paper-title,concept-matrix
```

`--font` 支持 `source-han-sans-sc`、`source-han-serif-sc`、`lxgw-wenkai`、`smiley-sans`、`xiaolai`；新建项目省略时选择当前风格推荐字体。初始化写入独立的 `font: {id, version}`，实际字体文件加载完成后才挂载镜头并测量文字；缺失、损坏、未知字体或版本不匹配会报错。字体与许可进入生产／审核指纹，换字体后需要重新渲染和复核。字号、字重、字幕颜色及安全区仍按原规则；素材截图中的原有文字保持原貌。

风格卡片与镜头库原样片保留其原始字体；风格页的字体组合样片才展示当前风格与所选字体的实际效果。组合样片是横屏静音示例，点击封面后才加载视频；竖屏、真实旁白和长文排版需在实际项目中检查。字体卡片使用仅含固定示例文字的小型字体文件，进入视野或选中时才加载；实际视频制作仍使用完整字体。`preview:fonts` 输出在被忽略的 `library/font-previews/`，普通静态构建对缺失或过期组合样片显示明确状态。

字体采用 SIL OFL 1.1，保留独立的版权及许可文件，不随项目改成 MIT；来源与文件说明见 [项目字体](../fonts/README.md)。字体文件约 88.8 MiB，无需安装到操作系统，也不使用远程字体 CDN。

## 六套视频风格

六套风格通过标题构图、中文字体、节点形状、流程布局和入场方式形成不同的画面语言。Style Pack 提供配色、默认字体与基础动效，显式选择的全片字体覆盖默认字体，基础语义 renderer 根据风格组织画面；文字、数字、连接和素材仍由分镜提供。

六套风格均支持横屏 `landscape`（1920×1080）和竖屏 `portrait`（1080×1920）。六套风格的 16:9 横屏均有 40 个可用场景配方；竖屏组合支持 `type-and-filter`、`ai-stream-response`、`unit-dot-regroup` 和 `semantic-default`，这一基础配方覆盖观点、对照、顺序、关联、变化、数据和素材七种语义画面，可在同一视频中重复使用。风格支持某种画幅不代表所有专用配方都已适配，实际选择以页面和 catalog 的兼容清单为准。

展示名称已更新，命令行 ID 保持不变：墨白杂志仍使用 `retro-zine`，瑞士蓝使用 `archive-grid`，手绘便签使用 `scatterbrain`。已有分镜更换风格或采用更新后的实现时，需要重新校验布局并渲染。

| 风格（`--style` ID） | 适合的文档 | 构图与动效 | 状态 |
| --- | --- | --- | --- |
| [墨白杂志 / Editorial Ink](../styles/retro-zine/preview.md) · `retro-zine` | 观点文章、知识解释、故事 | 中性白底、中文宋体、杂志分栏与朱红印章；横向揭示 | stable |
| [暗场信号 / Signal](../styles/signal/preview.md) · `signal` | 核心观点、转折、重点说明 | 石墨暗场、淡紫焦点与中央构图；克制缩放 | experimental |
| [手绘便签 / Sketch Notes](../styles/scatterbrain/preview.md) · `scatterbrain` | 学习笔记、方法拆解、灵感整理 | 白色点阵、黄色便签、中文楷体与蓝色批注；错落贴入 | stable |
| [瑞士蓝 / Swiss Blue](../styles/archive-grid/preview.md) · `archive-grid` | 报告、分析、结构化方法论 | 克莱因蓝、直角色块与强字号对比；网格裁切揭示 | experimental |
| [工程蓝图 / Blueprint](../styles/signal-noir/preview.md) · `signal-noir` | 系统、机制、技术流程 | 石墨蓝灰网格、等宽标注与琥珀路由；模块按连接展开 | experimental |
| [产品演示 / Product Frame](../styles/studio-frame/preview.md) · `studio-frame` | 产品说明、教程、工作流 | 冷灰工作台、窗口层次与绿色状态；说明和来源素材分区 | experimental |

以下截图和视频均由 Remotion 根据[同一份 2.3 语义分镜](../examples/template-families/storyboard.semantic.json)重新渲染：每套 7 个镜头、50.8 秒，均为无旁白、无配乐的静音审片预览。截图取自第一个“开篇”镜头；视频包含开场、对比、网络、顺序、变化、媒体和收尾。媒体镜头使用[仓库内演示插画](../examples/template-families/assets/product-workflow.svg)，来源见[素材清单](../examples/template-families/asset-manifest.semantic.json)。

| 墨白杂志 · Editorial Ink | 暗场信号 · Signal | 手绘便签 · Sketch Notes |
| --- | --- | --- |
| ![Editorial Ink 开篇](../examples/template-families/previews/retro-zine-semantic-opening.png) | ![Signal 开篇](../examples/template-families/previews/signal-semantic-opening.png) | ![Sketch Notes 开篇](../examples/template-families/previews/scatterbrain-semantic-opening.png) |
| [观看静音视频](../examples/template-families/previews/retro-zine-semantic.mp4) | [观看静音视频](../examples/template-families/previews/signal-semantic.mp4) | [观看静音视频](../examples/template-families/previews/scatterbrain-semantic.mp4) |

| 瑞士蓝 · Swiss Blue | 工程蓝图 · Blueprint | 产品演示 · Product Frame |
| --- | --- | --- |
| ![Swiss Blue 开篇](../examples/template-families/previews/archive-grid-semantic-opening.png) | ![Blueprint 开篇](../examples/template-families/previews/signal-noir-semantic-opening.png) | ![Product Frame 开篇](../examples/template-families/previews/studio-frame-semantic-opening.png) |
| [观看静音视频](../examples/template-families/previews/archive-grid-semantic.mp4) | [观看静音视频](../examples/template-families/previews/signal-noir-semantic.mp4) | [观看静音视频](../examples/template-families/previews/studio-frame-semantic.mp4) |

同一顺序图解的六种布局，按行从左到右为墨白杂志、瑞士蓝、手绘便签、暗场信号、工程蓝图、产品演示：

![六套风格的实际流程布局](../designs/style-language-redesign/sequence-comparison.png)

新项目内置思源黑体、思源宋体、霞鹜文楷、得意黑和小赖字体，使用固定版本的本地字体文件；字体来源、许可和 SHA-256 见 [字体清单](../fonts/font-index.json)。未指定 `font` 的历史分镜继续使用原有系统字体栈，不同系统的字形可能略有差异。画布以白色、冷灰或石墨色为主，黄色用于便签等内容形状；字幕直接显示在画布上，按深浅背景使用独立文字颜色。

六套风格已检查同内容的横竖屏代表帧与公开静音样片，具体范围及证据见[风格实施记录](../designs/style-language-redesign/README.md)。`experimental` 表示仍需更多文档与完整播放复核。静音样片供选型和审片参考，项目内有声讲解视频需要匹配旁白与交付检查。旧 `retro-windows` 已标记为 deprecated，仅保留对已有 Storyboard 2.1 项目的兼容。

## 进阶：选择素材、风格与命令行

需要 Node.js 24+，推荐 Node.js 24 LTS；两条 GitHub Actions 工作流也使用 Node.js 24。首次在仓库根目录运行 `npm ci`。Skill 负责读文档、拆主张、设计画面路线和编写分镜；命令行负责校验、渲染与 QA。`init:project` 只生成占位草稿，不能直接出片。

### 1. 让 Agent 加载 Skill

- **Codex**：在本仓库开启新会话，直接说明“使用 `frame-loom` Skill”；Codex 从 [Skill 入口](../.agents/skills/frame-loom/SKILL.md)读取根目录的[共享流程](../SKILL.md)。
- **Claude Code**：从仓库根目录运行 `claude --plugin-dir .`，通过 `/frame-loom:frame-loom` 调用 Skill。[插件清单](../.claude-plugin/plugin.json)注册仓库内的 Skill 入口，再读取根目录的共享流程。
- **其他 Coding Agent**：让 Agent 先读取根目录 [`SKILL.md`](../SKILL.md)，命令均从仓库根目录执行。

### 2. 按需选择输入方式并比较模板

`document` 是纯文档，画面使用有原文依据的文字和图解；`document-images` 是文档＋图片，可附本地图片或给 Codex 明确的网址去截图。网址本身不能直接用于渲染，须先保存真实截图。首次预览未指定图片时，Agent 直接选择 `document`，不要求用户先回答输入模式。输入方式与音频路线无关；项目初始化时用 `--input-mode` 记录实际选择。

Skill 会先判断文档适合的画面路线，再选择可用模板并记录理由；首次 `fast + silent` 不必为常规模板选择中断。如果想自己选，可让 Agent 推荐至多三套并说明取舍，再用命令核对代码 ID 和画幅支持。`preview:styles` 是轻量视觉画廊；`preview:templates` 默认比较全部六套风格，使用同一份 2.3 语义分镜生成实际 Remotion 帧，去掉 `--stills-only` 还会生成各 50.8 秒的静音视频和自动 QA。默认写入新的 `projects/template-family-gallery-*` 目录，也可用 `--output` 指定新目录；已有目录不会被覆盖。

```bash
npm run list:styles
npm run list:styles -- --content knowledge --canvas portrait
npm run preview:styles -- /tmp/frame-loom-style-gallery.html
# 六套风格的横屏代表帧
npm run preview:templates -- --stills-only --output .tmp/style-gallery-landscape
# 六套风格的竖屏代表帧
npm run preview:templates -- --portrait --stills-only --output .tmp/style-gallery-portrait
# 六套完整静音样片与自动 QA，使用新的默认输出目录
npm run preview:templates
```

新的“风格＋镜头配方”项目使用上面的 `--style ... --shots ...` 入口，生成 Storyboard 2.4。下面仅传 `--style` 的示例保留旧 2.3 语义分镜入口，可用表格中的 **代码 ID** 指定风格；例如选择 Blueprint：

```bash
npm run init:project -- --slug knowledge-explainer --style signal-noir --canvas landscape --input-mode document

# 已选择文档＋图片时，例如使用 Product Frame
npm run init:project -- --slug product-walkthrough --style studio-frame --canvas landscape --input-mode document-images
```

`--slug` 只写简短的英文内容主题。命令用本地创建日期生成 `projects/YYYYMMDD-<slug>`；同一天同名的新项目依次加 `-02`、`-03`，并打印实际路径。日期固定为创建日，不随修改或重渲染改变。继续同一视频制作时沿用原目录；明确开始另一版独立制作时再建新项目。模板、`fast`／`review` 和音频模式写在项目文件里，不放进目录名。旧项目目录保持原名，避免使 `run.json` 和 QA 文件里的路径失效；`template-` 开头的预设示例不受这条生产目录规则约束。

`--style` 会把候选模板写入项目 `storyboard.draft.json` 的 `style.id`；不写时默认 `retro-zine`。`--input-mode` 写入 `project-input.json`，供素材校验；`--canvas` 可选 `landscape` 或 `portrait`。若想看所选模板的动作，把 `--stills-only` 去掉并将 `--styles` 设为该 ID，例如 `npm run preview:templates -- --styles signal-noir`；竖屏代表帧可用 `npm run preview:templates -- --styles signal-noir --portrait --stills-only`。这些仍是**通用示例预览**，不是你的文档成片。

### 3. Agent 负责的项目文件

首次使用按开头的自然语言示例即可，不必执行这里的命令。若手动初始化，请将原文完整复制到 `source/source.md`，同时记录原始路径。Agent 应填写 `route-card.md`、`content-gaps.md`、`shot-map.md`、`script.md` 和 `storyboard.draft.json`，核对关键主张的原文位置与镜头工作。图片模式还需填写 `visual-sources.md`，把真实图片登记到 `asset-manifest.json` 并放入对应的 `media` 镜头。**初始化草稿的 20 秒和占位文字不能直接拿来出片。**

### 4. 生成与检查预览

```bash
# 自动预览：Agent 完成有效草稿后运行
npm run produce -- projects/my-video --mode fast --audio-mode silent --output-purpose visual-preview
npm run produce -- projects/my-video-with-images --mode fast --audio-mode silent --output-purpose visual-preview

# review：Agent 写出 reviewed 的 storyboard.json，创作者确认后记录审核指纹，再渲染
npm run approve:storyboard -- projects/my-video projects/my-video/storyboard-review.json
npm run produce -- projects/my-video --mode review --audio-mode silent --output-purpose visual-preview
```

`projects/my-video` 是命令示例中的占位目录；实际操作要替换成 `init:project` 打印的带日期目录。独立测试不同路线时分别让 Agent 建新项目；继续同一条路线时沿用原项目。`fast` 可将有效草稿推进到 `generated`／`validated`，不代表人工审核通过。`review` 需要状态为 `reviewed` 或 `approved` 的 `storyboard.json`，以及**创作者确实审过后**由 Agent 写出的审核记录，例如 `storyboard-review.json`：

```json
{"reviewer": "项目负责人", "notes": "已核对讲稿、逐镜内容、时间安排和预留区域。"}
```

运行 `approve:storyboard` 后会生成 `storyboard-approval.json`，绑定当前讲稿、分镜、素材、模板和画面预留配置的指纹。这个批准步骤同样适用于 `review` 的底片、讲稿先行和有声视频；批准前不能运行相应的 `produce` 或 `prepare:script-handoff`。静音审片产物见 `projects/my-video/output/preview-silent.mp4`、`run.json`、`output/preview-silent-review/qa-report.json` 和代表帧。这个 MP4 只供审片。若想在已有项目里换模板，告诉 Agent 新的代码 ID，让它保留原文与镜头职责、检查新布局并重新校验和渲染；已有输出默认不会被覆盖。

### 5. 导出干净画面底片，或先交讲稿

若要自己在剪辑软件中配音、叠加出镜画面与字幕，把项目里的 `visual-handoff.json` 设为实际预留比例：`facecamRightFraction` 留出画面右侧整列，`subtitleBottomFraction` 留出底部横带；均设为 `0` 表示不预留。右侧最多 `0.35`，底部最多 `0.25`。渲染器会等比缩小镜头内容，保证标题、卡片等落在预留区之外；请根据最终画幅完整检查可读性。`timelinePolicy` 可填 `picture-locked`（后期按画面配音）或 `audio-adjustable`（录音回流后允许另出新版）。

```bash
npm run produce -- projects/my-video --mode fast --audio-mode silent --output-purpose visual-master
# review 项目先完成上节的分镜批准，再运行：
npm run produce -- projects/my-video --mode review --audio-mode silent --output-purpose visual-master
```

产物是独立版本的 `output/visual-master-vNNN.mp4`，同名 `-review/handoff/` 下有逐镜 `narration-script.md`、`shot-timing.json` 和 `visual-handoff.json`。底片无音轨、无逐句旁白字幕和 `SILENT PREVIEW` 标记；画面标题和必要图解文字保留。自动 QA 后状态为 `visual-handoff-pending`。创作者完整查看、确认预留区域与文字可读后，填写 `reviewer`、`notes`，并将 `fullPlaybackPassed`、`visualHierarchyPassed`、`textReadabilityPassed`、`overlaySafeAreaPassed`、`assetRightsPassed` 设为 `true`，再运行：

```bash
npm run approve:visual-handoff -- projects/my-video projects/my-video/output/visual-review.json
```

状态变为 `visual-handoff-ready`，表示 **FrameLoom 的画面交接完成**。这不代表用户在外部剪辑软件制作的最终视频已在本项目验收。现有连续录屏输入和出镜画面合成不属于此底片能力。

若先交讲稿给外部录音，第一阶段不渲染 MP4：

```bash
npm run prepare:script-handoff -- projects/my-video --mode fast
# review 项目先完成分镜批准，再运行：
npm run prepare:script-handoff -- projects/my-video --mode review
```

上面两条是不同模式的示例，**一次只运行一条**，而且应在没有 MP4 生产记录的新项目中进行。命令检查 `script.md` 与每个 `scene.narration` 的文字对应关系，写入 `output/script-handoff/`，状态为 `script-ready`。录音回来后复用同一项目，用下面的 `external` 路线完成视频；命令会拒绝与已交讲稿不同的版本。画面先行且音频要回到 FrameLoom 时，旧底片文件会保留；若 `timelinePolicy=picture-locked` 而确实要按录音修改分镜，Agent 应先明确选择新版本，再在有声制作命令中加 `--retime-from-master`。

风格与镜头配方组合采用 Storyboard 2.4；旧的仅风格初始化保留 2.3：每屏先确定是对照、顺序、关联、前后变化、数据还是来源素材，再由风格模板决定外观；字段及约束见 [Storyboard 契约](storyboard-schema.md)。[语义画面示例](../examples/semantic-visuals) 可用 `npm run preview:semantic -- --output .tmp/semantic-gallery` 在全部已安装模板上生成完成态画廊。仓库仍保留 [文章讲解](../examples/article-video)、[数据讲解](../examples/data-explainer)和[同分镜模板对比](../examples/template-families)等旧版示例。

完成分镜后可先运行 `npm run preview:shot -- <storyboard.json> <scene-id> <new-output.mp4>`，检查实际镜头的短片、入场中途、完成态和切镜前画面，再渲染全片。命令不会覆盖现有输出，也不接受草稿文件直接渲染。

### 6. 接入音频，制作项目内有声视频

可以从文档直接开始，也可以在审片预览、底片或讲稿交接之后继续。`produce` 会在渲染有声 MP4 后运行 QA；音频就绪后须按实测时长调整分镜，重新校验并渲染。明确指定 `--output-purpose in-project-video` 时，没有有效旁白不会回退为静音文件；只有配乐或音效也不能通过讲解视频交付门禁。

**内置 TTS**：根据 `scene.narration` 生成旁白和字幕。目前支持豆包、OpenAI、ElevenLabs、阿里百炼 Qwen3-TTS-Flash 和 MiniMax。五份[配置样例](../examples/tts-profiles)默认关闭；新项目初始化时会复制到项目的 `audio/` 目录。

第一次接入时，按 [TTS 配置指南](tts-setup.md)操作：每家都有凭据入口、完整启用 JSON、环境变量和参数示例。可直接跳到[豆包](tts-setup.md#豆包)、[OpenAI](tts-setup.md#openai)、[ElevenLabs](tts-setup.md#elevenlabs)、[阿里百炼](tts-setup.md#阿里百炼)或 [MiniMax](tts-setup.md#minimax)。以下步骤以已有项目 `projects/my-video` 为例，请替换成实际目录。

先在所选服务的官方控制台取得凭据；**只需要配置实际使用的那一家**：

| 服务 | 去哪里获取 | 本项目读取的环境变量 | 新项目中的样例文件 |
| --- | --- | --- | --- |
| 豆包语音 | 在[火山引擎豆包语音 API Key 控制台](https://console.volcengine.com/speech/new/setting/apikeys?projectName=default)创建或复制 API Key；按[API Key 使用说明](https://docs.volcengine.com/docs/DoubaoVoice/APIKeyUsage?lang=zh)核对鉴权方式，并从[大模型音色列表](https://www.volcengine.com/docs/6561/1257544)、[V3 接口文档](https://www.volcengine.com/docs/6561/1598757)和控制台确认已开通的音色及对应 Resource ID。 | `VOLC_TTS_API_KEY`、`VOLC_TTS_RESOURCE_ID`、`VOLC_TTS_SPEAKER` | `audio/tts-config.example.json` |
| OpenAI | 登录 [OpenAI API Keys 页面](https://platform.openai.com/api-keys)，创建并复制 Secret key。 | `OPENAI_API_KEY` | `audio/tts-config.openai.example.json` |
| ElevenLabs | 登录 [ElevenLabs API Keys 页面](https://elevenlabs.io/app/developers/api-keys)，创建 Key；若使用受限 Key，开启 Text to Speech 权限。 | `ELEVENLABS_API_KEY` | `audio/tts-config.elevenlabs.example.json` |
| 阿里百炼 | 按[阿里云百炼获取 API Key 指南](https://help.aliyun.com/zh/model-studio/get-api-key/)进入 [API Key 控制台](https://bailian.console.aliyun.com/cn-beijing/model/settings/api-key)，选择**华北 2（北京）**地域并创建 Key。 | `DASHSCOPE_API_KEY` | `audio/tts-config.aliyun.example.json` |
| MiniMax | 按 [MiniMax 同步语音合成文档](https://platform.minimaxi.com/docs/api-reference/speech-t2a-http)的鉴权说明，从开放平台账号管理的 API Keys 获取 Key，并确认语音额度及音色权限。 | `MINIMAX_API_KEY` | `audio/tts-config.minimax.example.json` |

在仓库根目录，复制所选样例为该视频项目的实际配置文件。例如选择 OpenAI：

```bash
cp -n projects/my-video/audio/tts-config.openai.example.json projects/my-video/audio/tts-config.json
```

如果是初始化功能加入前创建的旧项目，可从仓库样例复制，例如 `cp -n examples/tts-profiles/openai.json projects/my-video/audio/tts-config.json`；选择其他服务时将 `openai` 换成 `doubao`、`elevenlabs`、`aliyun` 或 `minimax`。`cp -n` 保留已有目标文件，已有配置请先核对再编辑，或按[多配置步骤](tts-setup.md#多个配置与切换服务)另存一份。编辑 `projects/my-video/audio/tts-config.json`，将 `"enabled": false` 改为 `"enabled": true`。`apiKeyEnv`、`resourceIdEnv` 和 `voiceTypeEnv` 填的是**环境变量名**，不要替换成真实密钥。豆包样例从 `VOLC_TTS_SPEAKER` 读取音色，并要求它与 `VOLC_TTS_RESOURCE_ID` 对应；其他四份样例已有初始模型和音色，需要时可在该文件中改 `model`、`voiceType`。旧项目中写死的 `voiceType` 仍可继续使用。

在**运行 FrameLoom 命令的同一个终端**设置环境变量。macOS/Linux 用 `export`，下列命令只执行所选服务对应的行，将尖括号占位值换成自己的凭据：

```bash
export VOLC_TTS_API_KEY='<豆包 API Key>'
export VOLC_TTS_RESOURCE_ID='<豆包音色对应的 Resource ID>'
export VOLC_TTS_SPEAKER='<已开通的豆包音色 ID>'
export OPENAI_API_KEY='<OpenAI Secret key>'
export ELEVENLABS_API_KEY='<ElevenLabs API Key>'
export DASHSCOPE_API_KEY='<北京地域的百炼 API Key>'
export MINIMAX_API_KEY='<MiniMax API Key>'
```

Windows PowerShell 对应写法如 `$env:OPENAI_API_KEY = '<OpenAI Secret key>'`，其他服务替换变量名即可。这些变量只对当前终端会话有效；如果从 IDE、Agent 或另一个终端启动命令，也要确保那个进程能读到相同的环境变量。FrameLoom **不会自动读取 `.env` 文件**；不要把真实 Key 写入 `tts-config.json`、样例文件或提交到 Git。豆包 API Key 方式不需要另外填写 App ID 和 Access Token。旧项目如已使用 `DOUBAO_TTS_*` 环境变量，可继续按其现有 `apiKeyEnv`、`resourceIdEnv` 配置使用。阿里样例使用北京接入域名，北京 Key 不能与其他地域域名混用；改用新加坡时还需把配置文件里的 `endpoint` 主机改为 `dashscope-intl.aliyuncs.com`，并使用新加坡地域的 Key。

运行 `npm run list:tts-profiles -- projects/my-video` 可查看各配置的状态和不含密钥的诊断：`ready` 表示本地参数有效且所需环境变量已设置，`needs-environment` 表示缺少变量，`disabled` 为关闭，`invalid` 为无效配置，`test-only` 仅供测试。该命令不验证在线 Key、余额或音色权限；一个坏配置不会中断其他配置的展示。仅一个 `ready` 配置时可默认选用，多个时通过 `--tts-config` 指定；真实配置缺失时不自动退回 mock。内置 TTS 只向对应服务商的官方 HTTPS 域名发送凭据，不接受自定义代理地址或跳转；需要代理时先在外部生成音频，再走外部配音路线。

MiniMax 样例默认使用 `speech-2.8-hd`、中文系统音色 `male-qn-qingse` 和中国站接入地址 `https://api.minimax.cn/v1/t2a_v2`。国际站需显式改为 `https://api.minimax.io/v1/t2a_v2`，并使用对应平台的 Key。可配置语速、音量、半音值 `pitchSemitones`、情绪、语言和发音提示；参数范围与模型限制见[MiniMax 接入说明](audio-integration.md#minimax-setup)。每场少于 10000 字符，当前接入非流式 MP3/WAV。

首次使用或调整音色时，可显式合成一小段试听，默认输出到项目 `audio/previews/`，不覆盖整片音频包：

```bash
npm run preview:tts -- projects/my-video --tts-config projects/my-video/audio/tts-config.json --text "你好，请确认这段配音的音色与语速。"
```

试听会请求服务商并可能产生费用；本地检查和自动测试不会证明真实账号与音色可用。试听应在审核前进行，音频目录仍参与生产指纹。常用参数包括 `speedRatio`、支持模型的 `instructions`、ElevenLabs 的 `voiceSettings`／发音词典／可选前后场上下文，以及最终旁白的 `outputSampleRate`。字段按服务校验，不支持的非默认设置会报错；完整支持范围及示例见[音频接入说明](audio-integration.md#validated-voice-controls)。

```bash
npm run produce -- projects/my-video --mode fast --audio-mode tts --output-purpose in-project-video --tts-config projects/my-video/audio/tts-config.json
```

**外部音频**：提供本地制作的音频、需要的 SRT/VTT 字幕和 `audio-config.json`，记录素材来源与使用权限，再运行：

```bash
npm run produce -- projects/my-video --mode fast --audio-mode external --output-purpose in-project-video --audio-config projects/my-video/audio/audio-config.json
```

人工审过分镜的项目先运行 `approve:storyboard`，再将上述命令中的 `--mode fast` 改为 `--mode review`。两条音频路线都会输出 `output/pilot-audio.mp4`。`run.status=completed` 仅表示本次命令结束；有声输出在人工复核前是 `manual-review-pending`。

创作者完整播放音频视频，检查声音与画面对齐、字幕可读性和素材权限后，将人工复核结果写入 `output/manual-review.json`，例如：

```json
{
  "reviewer": "项目负责人",
  "notes": "完整播放后记录发音、节奏、字幕和素材核查结果。",
  "fullPlaybackPassed": true,
  "visualHierarchyPassed": true,
  "textReadabilityPassed": true,
  "transitionTimingPassed": true,
  "audioQualityPassed": true,
  "captionReadabilityPassed": true,
  "assetRightsPassed": true
}
```

确认记录真实、各项均通过后运行 `npm run approve:delivery -- projects/my-video projects/my-video/output/manual-review.json`。有声候选文件已保留声音和字幕并移除审片标记，文件名暂沿用 `pilot-audio.mp4`。命令会再次核对音频流、自动 QA、渲染记录以及输入和视频指纹，然后标记 `deliveryStatus=release-ready`；静音 MP4 和用于测试的 mock TTS 不能通过。音频路线不绑定内置 TTS 服务；外部音频也可通过下列独立命令先测量时间轴和响度，再渲染：

```bash
npm run inspect:audio -- projects/my-video/storyboard.json projects/my-video/audio/audio-config.json
npm run render:storyboard -- projects/my-video/storyboard.json projects/my-video/output/pilot-audio.mp4 --mode fast --audio-config projects/my-video/audio/audio-config.json --output-purpose in-project-video
npm run qa:storyboard -- projects/my-video/storyboard.json projects/my-video/output/pilot-audio.mp4 --mode fast --audio-config projects/my-video/audio/audio-config.json --output-purpose in-project-video
```

## 模板契约与能力

以下是分镜使用的底层场景组件，并非让用户再选一次的视频模板：

- `statement`：主张、标题和结论
- `graph-explainer`：节点关系和连线演进
- `metric-grid`：指标比较和数据摘要
- `interaction-flow`：真实产品截图的状态切换

新项目中，所有已安装 Style Pack（包括兼容保留的 `retro-windows`）都接入 Storyboard 2.3 的语义构图和逐步入场逻辑；历史 2.1/2.2 分镜继续按原版式渲染。模板只展示分镜提供的内容，不替用户确认事实来源或视频完成状态。详细内容槽位及限制见 [`references/storyboard-schema.md`](storyboard-schema.md)。

视频质量契约支持场景主结论与焦点目标、节点的当前/完成状态、带来源声明的观察对象和局部放大框、显式重叠转场与结尾停留。QA 报告记录场景时间线、稳定停留帧数和焦点数量，并抽取关键动作与交接代表帧。旧 storyboard 未使用新字段时保留原有时长与转场行为；新字段与示例见 [`references/storyboard-schema.md`](storyboard-schema.md)。

各模板的重叠镜头统一采用旧信息先退、新信息后入的淡入交接，Style Pack 的入场曲线用于主体动效，已看过的主体降低视觉权重。配乐仍需创作者提供来源与许可；启用后默认首尾淡入淡出，成片 QA 会提示超过两秒的片尾静音。静态背景和硬切仍可用于需要稳定阅读或明确换题的镜头。

维护者可以运行 `npm run test:audio-pilot`，使用临时生成的测试音频和字幕验证完整的 audio pilot 渲染与 QA 闭环；测试不会把音频文件写入仓库。

维护者可以运行 `npm run test:visual-regression`，用三个历史示例检查 `retro-zine`、`retro-windows`、`scatterbrain`、四类底层场景及横屏／竖屏覆盖；六套当前模板可用上文的 `preview:templates -- --styles ...` 生成代表帧或静音短视频。输出 contact sheet 供人工复核，不使用像素快照替代完整播放。

## 工作边界

FrameLoom 适合知识讲解、产品说明、报告摘要、数据解释和文档汇报。它不承诺剧情片、真人表演、复杂 3D 或主要依赖生成式镜头的宣传片。AI 负责内容判断和 storyboard 草稿，程序负责时间轴、布局、动作和渲染；`review` 模式使用审核后的 `storyboard.json`，`fast` 模式可生成自动预览。

音频扩展说明见 [`references/audio-integration.md`](audio-integration.md)。

## 许可证

FrameLoom 自有代码采用 [MIT](../LICENSE)。Remotion 是独立许可的依赖；使用前请按安装版本核对 [Remotion 官方许可](https://www.remotion.dev/license)，其免费使用存在适用条件，不能由本项目的 MIT 推断所有使用场景均免费。字体、图片、配乐和 TTS 输出仍按各自来源条款使用。

参与开发见 [CONTRIBUTING.md](../CONTRIBUTING.md)，变更见 [CHANGELOG.md](../CHANGELOG.md)，漏洞反馈见 [SECURITY.md](../SECURITY.md)。
