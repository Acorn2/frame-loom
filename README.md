<div align="center">

[简体中文](README.md) · [English](README.en.md)

<img src="./library/brand/logo.svg" alt="FrameLoom：文档与播放符号" width="112" height="112">

<h1>FrameLoom</h1>

**给 Agent 一篇文档，做成带图解和动画的视频**

A document-to-video Skill for Codex, Claude Code, and other coding agents

[![配方库](https://img.shields.io/badge/Library-live%20previews-2855d9)](https://acorn2.github.io/frame-loom/)
[![CI](https://github.com/Acorn2/frame-loom/actions/workflows/ci.yml/badge.svg)](https://github.com/Acorn2/frame-loom/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-24%2B-339933)](package.json)

[看实际效果](#效果展示) · [做第一条视频](#快速开始) · [浏览风格](https://acorn2.github.io/frame-loom/) · [安装与排错](references/installation.md) · [作者的其他产品](#作者的其他产品)

</div>

**FrameLoom** 让 Coding Agent 把文章、讲稿或产品说明编排成视频：Agent 理解内容、写讲稿和分镜，Remotion 在本机渲染图解与动画。你可以先看静音预览，继续导出供剪辑软件使用的干净画面，或接入配音制作有声视频。

## 效果展示

**真实案例：把儿童自然博物馆宣传文稿，做成带旁白的白板视频。** 输入一份文稿，生成插画、逐行书写和四阶段图解；下方用 10 秒无声动图展示效果。

![FrameLoom 真实案例：开放白板、四阶段图解、自然主题插画与片尾网站入口](examples/nature-museum-case/previews/highlights.gif)

[观看完整案例 · 68 秒 · 含旁白](examples/nature-museum-case/previews/nature-museum-narrated.mp4) · [案例与素材来源](examples/nature-museum-case/README.md) · [图解动画示例](examples/template-families/README.md) · [在线浏览风格与镜头](https://acorn2.github.io/frame-loom/)

完整视频包含 7 场白板动画，使用霞鹜文楷与自然语速旁白，片尾展示 `https://naturemuseum.top/`。插画用于概念示意，不是产品界面或实际三维模型。自动 QA 已通过，完整播放与素材公开使用仍待复核。

## 适合用来做什么

| 你的材料 | 可以制作的内容 |
| --- | --- |
| 文章、学习笔记、讲稿 | 观点讲解、知识解释、方法拆解 |
| 产品说明、真实产品截图 | 功能介绍、操作步骤、工作流演示 |
| 报告、带来源的数据 | 要点摘要、对照分析、流程与数据图解 |

适合已经在使用 Codex、Claude Code 等 Coding Agent、希望把文字材料做成讲解视频的创作者。当前为 **v0.5 公开测试阶段**；以文字、图解和真实素材为主，不承诺真人表演、剧情片或复杂 3D 镜头。

## 快速开始

### 1. 安装并打开 Agent

准备 **Git、Node.js 24+、FFmpeg / ffprobe**。推荐 Node.js 24 LTS；还没装齐时，先按[安装指南](references/installation.md)操作并检查版本。

```bash
git clone --depth 1 https://github.com/Acorn2/frame-loom.git
cd frame-loom
npm ci
```

在 Coding Agent 中打开整个 `frame-loom` 仓库：

| Agent | 如何使用 |
| --- | --- |
| Codex | 在仓库中开启会话，直接说“使用 frame-loom Skill” |
| Claude Code | 在仓库根目录运行 `claude --plugin-dir .`，再输入 `/frame-loom:frame-loom` |
| 其他 Coding Agent | 让它先读取仓库根目录的 [SKILL.md](SKILL.md)，从这里运行所有命令 |

第一条静音预览无需配置 TTS 或 API Key。首次渲染可能下载浏览器；Agent 的使用权限与费用按你选择的服务准备。

<details>
<summary>想先确认环境？直接渲染自带样片，无需 Agent</summary>

在终端执行：

```bash
npm run render:storyboard -- examples/creator-production-pilot/storyboard.json .tmp/quick-start/preview-silent.mp4 --mode fast
npm run inspect:output -- .tmp/quick-start/preview-silent.mp4 examples/creator-production-pilot/storyboard.json
```

看到 `OUTPUT OK` 后，用本机播放器打开 `.tmp/quick-start/preview-silent.mp4`。预期为 1920×1080、30 fps、20 秒的静音视频。输出目录会自动创建；再次试跑时换一个文件名。此路线使用现成分镜，体验文档编排请继续下一步。

</details>

### 2. 用自带文档做第一条视频

无需先准备自己的材料。在 **Agent 对话框**粘贴：

```text
请使用 frame-loom Skill，读取 examples/creator-production-pilot/source/source.md，
用墨白杂志风格（retro-zine）制作 16:9 横屏静音预览。
使用 fast 模式，根据文档推荐镜头并直接继续制作。
完成后告诉我视频的实际路径、时长和检查结果，并打开视频供我观看。
```

Agent 会新建 `projects/YYYYMMDD-内容主题/`，保留原文、编写讲稿与分镜，完成渲染与 QA。**成功结果是该项目中的 `output/preview-silent.mp4`，以及实际时长和检查结果。** 视频带审片标记且没有声音；新文档的内容与时长由实际编排决定。

你不需要手写 JSON、创建项目目录或逐个选择镜头。观看后可直接告诉 Agent 哪一幕需要修改，沿用同一个项目继续调整。

### 3. 换成自己的材料

将下面的占位路径换成已有 Markdown 或纯文本文档的实际路径，也可以直接附上文件：

```text
请使用 frame-loom Skill，把 <文档路径> 做成横屏静音预览。
根据内容推荐风格和镜头，使用 fast 模式直接继续制作。
完成后告诉我视频路径、时长和检查结果。
```

有产品截图时一并附上，或提供准确网址让 Agent 截图。主体产品截图默认用于参考全片配色，风格负责构图与动效；也可以明确说“使用风格默认配色”。需要先审稿时，改为“使用 review 模式，先给我审核讲稿和分镜，我确认后再渲染”。

## 选一种喜欢的风格

当前九套视频风格按画面构建方式分为两类：

- **AI 插画风格**：手绘白板、批注推演、编辑式排印。纯文档制作时，Agent 调用 AI 生成人物、物件或情境插画，再编排文字、图解与动画；提供真实截图时直接使用截图，不自动生图。三套使用各自的[固定内置镜头流程](references/primary-style-production.md)。
- **图文动效风格**：墨白杂志、暗场信号、手绘便签、瑞士蓝、工程蓝图、产品演示。以文字排版、图形、图表与界面素材构成画面，通过镜头动效逐步呈现，也可使用真实图片和截图；镜头可由 Agent 推荐或手动限定。

这两类描述画面构建方式，知识讲解、产品介绍、教程或故事属于内容用途。

### 三套 AI 插画风格

三套 AI 插画风格使用同一份“好问题，从观察开始”的文案，均为18秒横屏静音样片。下面展示实际视频的完成态，点击封面或“观看样片”即可查看动画；文案、图解为主体，插画辅助表达。

| 手绘白板 · Whiteboard | 批注推演 · Annotated Reasoning | 编辑式排印 · Editorial Typography |
| --- | --- | --- |
| [![手绘白板样片：好问题，从观察开始](examples/template-families/previews/whiteboard-original.png)](examples/template-families/previews/whiteboard-original.mp4) | [![批注推演样片：好问题，从观察开始](examples/template-families/previews/annotated-reasoning-text-led.png)](examples/template-families/previews/annotated-reasoning-text-led.mp4) | [![编辑式排印样片：好问题，从观察开始](examples/template-families/previews/editorial-typography-text-led.png)](examples/template-families/previews/editorial-typography-text-led.mp4) |
| 逐行书写 · 同步铅笔 · 小赖字体 | 圈词旁注 · 关系累积 · 思源宋体 | 关键词重排 · 关系展开 · 思源黑体 |
| [观看样片](examples/template-families/previews/whiteboard-original.mp4) | [观看样片](examples/template-families/previews/annotated-reasoning-text-led.mp4) | [观看样片](examples/template-families/previews/editorial-typography-text-led.mp4) |

三套均支持横屏，用户选风格即可，不需要再选镜头集合。批注推演与编辑式排印以正文、数字和关系为主体，辅助插画的声明框总面积最多占画布 8%。全片字体可独立选择，详见[字体清单](fonts/README.md)；素材准备见[插画生产流程](references/illustrated-production.md)，分镜编排见[文案动画制作](references/text-led-production.md)。

### 六套图文动效风格

下面六套图文动效风格使用同一份分镜，便于比较；展示图解完成态，可点击观看实际静音样片。

| 墨白杂志 · Editorial Ink | 暗场信号 · Signal | 手绘便签 · Sketch Notes |
| --- | --- | --- |
| ![墨白杂志关系图解](examples/template-families/previews/retro-zine-semantic-process.png) | ![暗场信号关系图解](examples/template-families/previews/signal-semantic-process.png) | ![手绘便签关系图解](examples/template-families/previews/scatterbrain-semantic-process.png) |
| [观看样片](examples/template-families/previews/retro-zine-semantic.mp4) | [观看样片](examples/template-families/previews/signal-semantic.mp4) | [观看样片](examples/template-families/previews/scatterbrain-semantic.mp4) |

| 瑞士蓝 · Swiss Blue | 工程蓝图 · Blueprint | 产品演示 · Product Frame |
| --- | --- | --- |
| ![瑞士蓝关系图解](examples/template-families/previews/archive-grid-semantic-process.png) | ![工程蓝图关系图解](examples/template-families/previews/signal-noir-semantic-process.png) | ![产品演示关系图解](examples/template-families/previews/studio-frame-semantic-process.png) |
| [观看样片](examples/template-families/previews/archive-grid-semantic.mp4) | [观看样片](examples/template-families/previews/signal-noir-semantic.mp4) | [观看样片](examples/template-families/previews/studio-frame-semantic.mp4) |

在[在线配方库](https://acorn2.github.io/frame-loom/)选择风格，复制制作指令，再交给本地 Agent 和你的文档。Agent 默认根据内容推荐镜头；也可手动限定。网页只展示公开样例，视频生产在本地进行。

当前版本的配方库提供右上角中文／英文切换，界面与制作指令随语言切换，保留制作选择。现有样片和原始配方文档保留中文并明确标注；界面语言不改变视频成品语言或字体。在线站点需发布当前版本后获得这些更新。

## 预览满意后，继续完成视频

| 想得到什么 | 下一步与输出 |
| --- | --- |
| 加旁白，得到有声视频 | 配置[豆包 TTS（通过火山引擎提供）、OpenAI、ElevenLabs、阿里百炼或 MiniMax](references/tts-setup.md)中的一家，或提供匹配的外部配音；输出 `output/pilot-audio.mp4` |
| 交给剪辑软件继续制作 | 要求导出干净画面底片；输出 `output/visual-master-vNNN.mp4`，无音轨、旁白字幕和审片标记，附讲稿与逐镜时间表 |
| 先录音，再制作画面 | 要求先交付讲稿和分镜；输出 `output/script-handoff/`，之后接回录音制作 |

例如，已配置好 TTS 后，在同一个项目中继续说：

```text
请在刚才的项目中继续制作有声版，使用已配置的真实 TTS。
如果有多个可用配置，先让我选择；按实测配音时长调整画面，完成渲染与 QA。
```

配置细节、外部配音和审核步骤见[使用指南](references/usage-guide.md)。有声视频与底片交接需要你完整播放复核；自动 QA 通过不等于事实、发音和视觉效果均已人工验收。

需要进一步调整时，可以让 Agent 按[实测语音时间](references/speech-driven-production.md)安排字幕与镜头。三套 AI 插画风格还支持右上角品牌名或本地 Logo，视频与同源封面共用配置，详见[品牌设置](references/branding.md)。

## 常见问题

**需要会写代码或分镜 JSON 吗？** 不需要手写。你需要安装本地工具、能使用 Coding Agent，并检查它生成的内容；CLI 和 JSON 是 Agent 的工作入口。

**必须配置配音吗？是否收费？** 第一条静音预览无需配音。使用 TTS 时只配置一家服务；Agent 和 TTS 的费用取决于各自服务，本地渲染不调用生成式视频 API。

**支持竖屏吗？** 六套图文动效风格支持 16:9 横屏和 9:16 竖屏：横屏每套有 43 个场景配方，竖屏支持基础语义、操作筛选、结果生成和单位点阵重组四项配方。三套 AI 插画风格目前只支持横屏，并按各自内置流程编排；完整兼容范围见[镜头配方库](shots/README.md)。

**文档会上传到配方库网站吗？** 网站不接收文档。渲染在本机进行；你选择的 Agent 或 TTS 服务可能接收文档内容或旁白，按其配置与服务条款使用。

**遇到错误或效果不满意怎么办？** 先看[安装与排错](references/installation.md#常见安装问题)。仍有问题时提交[安装或运行问题](https://github.com/Acorn2/frame-loom/issues/new?template=setup-problem.yml)或[视频效果反馈](https://github.com/Acorn2/frame-loom/issues/new?template=video-feedback.yml)。

## 深入使用与参与开发

- [文档导航](references/README.md)：按安装、制作、技术参考与维护查找文档。
- [使用指南](references/usage-guide.md)：选风格、字体、素材、配音、导出和审核。
- [TTS 配置](references/tts-setup.md)与[截图配色](references/project-palette.md)：按需加载的操作说明。
- [共享 Skill](SKILL.md)、[镜头配方](shots/README.md)与[Storyboard 契约](references/storyboard-schema.md)：Agent 与开发者入口。
- [贡献说明](CONTRIBUTING.md)、[变更记录](CHANGELOG.md)与[安全反馈](SECURITY.md)。

<details>
<summary>开发者：当前镜头能力摘要</summary>

当前运行时：52 个场景配方、9 个宿主动作、5 个换章配方；筛选清单接入 48/48。

注册总数包含历史兼容能力，具体风格可用范围与新项目的固定流程分别约束选用。当前场景配方与预设组合为 experimental；兼容范围以[能力清单](src/renderer/capability-manifest.ts)为准。可选预设见[知识讲解组合](video-templates/retro-zine-explainer/guide.md)，本地网页维护见[配方库指南](library/README.md)。

</details>

## 作者的其他产品

FrameLoom 由 **[Hresh赫什](https://hreshhao.com/)** 维护。我是一名用 AI 把想法做成产品的独立开发者，持续实践产品、效率工具与产品冷启动。除了 FrameLoom，我也在做这些产品：

| 产品 | 用来做什么 |
| --- | --- |
| [儿童 3D 自然博物馆](https://hreshhao.com/products/nature-museum/) | 和孩子一起旋转观察 3D 模型、听自然故事、讨论观察到的细节；也是上方视频案例的主题产品。 |
| [收链 / LinkBox](https://hreshhao.com/products/linkbox/) | iOS 本地链接收纳工具：通过分享面板先保存，再用标签、搜索与去重慢慢整理。 |
| [TabNest](https://hreshhao.com/products/tabnest/) | 把 Chrome 新标签页变成浏览器工作台，管理标签、书签与可恢复的工作会话。 |
| [ReadCover / 阅读掩护](https://hreshhao.com/products/readcover/) | 支持 TXT / EPUB 的本地阅读工具，提供 Word 风格界面、失焦保护与老板键。 |
| [通辽宇宙知识库](https://hreshhao.com/products/tongliao-universe/) | 将小约翰可汗视频中的人物、国家、历史、梗与配乐串成可回查的内容档案。 |

[查看完整产品作品集 →](https://hreshhao.com/products/) · [打开产品工作台 →](https://hreshhao.com/workbench/)

作品集还收录了读镜 / READFRAME、亲友记 / KinKeep、组局记等项目；各产品的介绍、当前状态与访问入口以网站为准。

## 致谢与许可

- [Remotion](https://www.remotion.dev/)提供基于 React 的确定性视频渲染能力。
- [video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft)提供镜头配方方法与展示结构参考；来源及适配许可见各配方 `provenance.json` 与[接入台账](shots/shortlist-coverage.json)。
- [whiteboard-video](https://github.com/trustfuture/simon-skills/tree/3ad0a25127c17da48a0e869c9efbf4136c40848b/skills/whiteboard-video)提供白板绘制与生产方法参考，保留[原始 MIT 署名](references/licenses/simon-whiteboard-MIT.txt)。
- 项目字体保留原始版权与 SIL OFL 1.1 许可，见[字体目录](fonts/README.md)。

FrameLoom 自有代码采用 [MIT](LICENSE)。Remotion 使用独立的[官方许可](https://www.remotion.dev/license)；字体、图片、配乐和 TTS 输出按各自来源条款使用，本项目的 MIT 不替代这些许可。
