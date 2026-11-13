# 插画讲解生产流程

三套当前 AI 插画风格使用[固定内置制作流程](primary-style-production.md)：手绘白板 `whiteboard`、批注图解 `annotated-reasoning`、情境叙事 `editorial-typography`。后两套使用[图像主导配方](image-led-directions.md)，允许大幅主体和完整场景。旧文字配方及其8%辅助插画限制继续按[文案动画制作](text-led-production.md)服务已有项目。旧 `flat-explainer`、`paper-collage` 和下文对应的六镜头示例保留历史兼容；不用于当前主风格选择。首轮横屏，字体独立。

## 当前内置镜头

| 风格 | 当前制作入口 | 说明 |
| --- | --- | --- |
| `whiteboard` | [whiteboard-board](../shots/whiteboard-board/recipe.md) | 开放白板、小贴纸、逐行文字、Rough.js 双线与同步铅笔 |
| `annotated-reasoning` | [annotated-image](../shots/annotated-image/recipe.md)、`semantic-default` | 主体细节与源图圈注；基础语义镜头可展示真实截图 |
| `editorial-typography` | [scene-narrative](../shots/scene-narrative/recipe.md)、`semantic-default` | 完整插画场景与细节取景；基础语义镜头可展示真实截图 |

当前项目只在所选风格的内置范围内编排，不让用户额外选择镜头集合。字体独立选择，字幕直接显示在画布上。

## 两种输入路线

选定路线、初始化项目和详细规划素材前，先完成[路线能力检查](production-pipeline.md#route-capability-check)。纯文档插画路线须确认原生生图工具可用；指定网页须确认截图工具与页面可访问。缺少已选路线的工具时提前报告缺口，不通过改变输入模式、风格或生成主体策略绕过。

- **纯文档**：从原文提炼主张、关系和情境，默认先规划有用的人物、物件或隐喻并调用 Agent 环境的原生 AI 生图，编排至少一个实际使用生成主体的镜头；Whiteboard 默认使用开放白板，批注图解使用大幅主体与源图圈注，情境叙事使用完整场景与连贯人物，历史 Flat／像素讲解笔记沿用原构图。新初始化自动启用 `illustrationPolicy: generated-subjects-v1`。按规范生成透明主体或完整场景，文字、关系和数字交给 renderer。在固定内置范围内按原文安排画面；既有项目的历史手动集合仍按其原契约校验，不批量迁移。不是每一屏都需要新图片；同一角色可以跨镜头复用。简单文档、列表等节点可明确选择原生 `node + glyph`，不记录为生图产物。
- **文档＋截图**：使用原始图片或真实截图；不自动生图。`object` 槽位使用真实来源，局部取景必须保留关键证据，不能用虚构界面代替证据。生成素材的登记命令会拒绝这条路线。

图片来源与 `visual.kind` 的区分见[共享内容规则](../SKILL.md#content-first-video-logic-for-new-projects)。纯文档生成插画属于 `visual.representation: diagram`，放入当前配方支持的 `object`／贴纸槽位，不因含图片就改成 `media` 场景或 `document-images`。原生图解节点不能替代项目至少实际使用一个生成主体的要求。

## 素材计划 → 实际生成 → 登记

1. 保留原始文档，建立主张与镜头映射。选择风格和全片字体，按内置镜头范围编排；不要用装饰图填满不需要插画的场景。
2. 按 illustration-plan.json 的 guideVersion 读取规范：声明 `2.0` 时为 `styles/<style>/illustration.v2.json`，未声明时为原 `styles/<style>/illustration.json`，按具体主张填写项目 `illustration-plan.json`。每项记录 `id`、`assets/<id>.png`、主体描述 `subject`、用途 `purpose`、原文位置或有理由的视觉转译 `sourceClaim`；需要连续角色时使用项目内参考图 `references`。图片中不要放正文、字幕、数值、箭头、商标或完整页面。
3. `npm run prepare:illustrations -- projects/<project>` 生成提示词。此命令**只准备提示词，不执行生图**。空计划报错；不能把提示词文件当作素材生成完成。
4. Agent 对每项**实际调用原生 imagegen**；透明主体设置透明背景，`guideVersion: "2.0"` 的情境叙事使用完整场景背景。参考图需先查看，再传入工具。若当前环境没有生图能力或调用失败，说明缺少的素材并停止依赖该素材的步骤；不能静默改用纯文字、网络图片或程序图冒充 AI 结果。
5. 查看每张结果：媒介符合所选风格、主体完整、无多余文字、无伪造截图、背景符合当前规范（透明主体或完整场景）。同一角色的外貌和服饰一致。通过工具修改不合格图，不用裁图掩盖失败。
6. 对实际查看合格的图片执行：

   ```bash
   npm run register:illustration -- projects/<project> organizer /absolute/generated/organizer.png --reviewer Codex
   ```

   程序检查 PNG 解码、尺寸；旧规范与透明主体检查实际 alpha，新版完整场景检查可见图像内容；复制到计划位置，登记来源、用途、生成工具、风格、计划／提示词／图片 SHA-256 及复核人。已有 ID 或路径不覆盖，修改稿使用新 ID。alpha 检查不代替视觉审核。
7. 分镜引用登记路径，运行 `validate:assets`。启用 `generated-subjects-v1` 时，空清单、仅登记但未在画面槽位使用、始终透明的主体均不能通过；未声明该策略的旧项目保留原行为。计划、规范或参考图变化使登记失效；图片字节变化也报错。确实修改素材或计划时，重新生成并登记相应版本。生成素材不作为产品配色采样证据。
8. 沿用现有渲染、音频、字幕、QA 和交付审核。正式 renderer 只读本地素材，不在线生图；计划、规范、参考图及素材绑定生产与审核指纹。先检查代表镜头，再复核全片。

## 示例与边界

当前样片主题为“好问题，从观察开始”。Whiteboard 保留原18秒样片 `examples/whiteboard-original/storyboard.json`；批注图解和情境叙事分别使用 `examples/shot-recipes/annotated-image/storyboard.json`、`examples/shot-recipes/scene-narrative/storyboard.json`，同一30秒完整旁白文本及字幕。两套来源 PNG、提示词与字节指纹在各自示例内登记，属于已确认素材复用，不伪造新生图记录。均为静音预览，不声称真实 TTS 有声交付。

新初始化为后两套写入 `guideVersion: "2.0"`，分别读取 `illustration.v2.json`；不声明版本的旧计划仍读取原 `illustration.json`，原指纹不变。情境叙事保持人物、服装、道具与环境连贯，参考图按场景传入；不得生成替代真实产品界面的图片。

当前样例见[原创白板](../examples/whiteboard-original/README.md)与[两套图像主导样片](../examples/illustration-directions/README.md)；[文案动画](../examples/text-led-video/README.md)作为旧项目兼容示例保留。

参考上游 [whiteboard-video](https://github.com/trustfuture/simon-skills/tree/3ad0a25127c17da48a0e869c9efbf4136c40848b/skills/whiteboard-video) 的讲稿、素材与编排方法；FrameLoom 保留自身的静态 renderer、严格分镜与本地生产机制，移植了上游 render.html 的绘制方法，并新增 Rough.js 4.6.6，保留 MIT 声明；没有引入其 TTS、发布操作或可执行 scenes.js。

同内容视觉对照见[Whiteboard 参考样例](../examples/whiteboard-reference/README.md)，使用上游公开贴纸，并非本次新生图。

## 历史插画风格兼容

旧 `flat-explainer`、`paper-collage` 和白板六镜头示例用于已有项目与方法回归；它们不决定当前三套主风格的新项目镜头范围。

### 两套历史视觉结构

彩色手绘与像素笔记共用语义槽位，使用独立的实际布局与图形语言。彩色手绘采用大幅情境、有机舞台、环绕说明、横向对照／流程和曲线连接；图片连续淡入、上移与缩放，完成后静止阅读。像素笔记采用紧凑主体、浅灰笔记线、阶梯模块、纵向对照／流程和直角连接；素材按实际区域比例分块显现，文字直接落定，重点轻闪一次。模块与装饰不添加输入未提供的事实，不强制游戏场景。

文字与图片区域、关系端点由共享布局函数提供给 renderer 和预检，密集的四步骤、四组成与三指标也需校验。素材仍按当前生图规范登记；仅更改布局不伪造新生图记录。三套同文案主样片与六镜头能力示例见[插画示例](../examples/illustrated-video/README.md)，封面必须取自对应实际视频。

### 历史六镜头契约

| ID | 槽位与用途 |
| --- | --- |
| `illustrated-hero` | `subject` 图片＋一个 `items` 文字节点；情境与主张 |
| `illustrated-compare` | 两个 `items`；图片或明确的原生图解，名称和差异描述，无因果箭头 |
| `illustrated-process` | 2–4 个 `items`；图片或原生图解，按真实步骤揭示，显式相邻连接 |
| `illustrated-explain` | `subject` 图片＋2–3 个文字节点；原文支持的主体关系 |
| `illustrated-breakdown` | `subject` 图片＋2–4 个图片／原生图解；有来源的组成拆解 |
| `illustrated-metric` | `subject` 图片＋1–3 个数字；原文位置、数值、共同 `visual.unit` 与显式 count |

图片用 `type: object`、`asset`、`fit: contain`；原生图解用 `type: node`、显式 `glyph`。两者都是可编排主体，不能自动互换。所有图层需要唯一 `reveal`，连线的唯一 `draw` 必须晚于两端入场完成；数字先 reveal 后 count。编译器拒绝隐藏坐标、未实现字段、错误关系和不足的完成态阅读时间。

Whiteboard 默认使用[开放白板](../shots/whiteboard-board/recipe.md)：小贴纸擦出、文字逐行书写、Rough.js 双线与单支铅笔同步，允许清单、矩形、椭圆与明确关系；不声称反推 PNG 的真实笔顺。彩色手绘使用粗黑轮廓、柔和色彩与平滑缩放；像素主体使用精致方块、阶梯边缘与像素明暗，人物有表情、日常物件有细节；画布保持干净，中文使用项目所选正常字体。素材按块显现，关系箭头逐步展开，重点轻闪一次。无需城堡、关卡、地图或冒险叙事。字幕仍直接显示在画布上，不添加底板。

### 历史示例与素材

`examples/illustrated-video/<style>/` 包含原文、素材计划、实际 imagegen 产物、来源登记、六个独立镜头和组合分镜。`storyboard.json` 的六镜头能力示例保持42秒、静音。

彩色手绘示例使用 `*-v2.png`；像素讲解笔记使用 `*-pixel.png`，均包含人物、散页和文件夹三项实际 imagegen 素材，并有素材计划、提示词与来源登记。旧剪纸图片和 `*.cut-paper-v2.json` 仅保留作历史比对，不是本节历史生产输入。
