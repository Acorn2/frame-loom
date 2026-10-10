<div align="center">

[简体中文](README.md) · [English](README.en.md)

<img src="./library/brand/logo.svg" alt="FrameLoom Logo：文档与播放符号" width="112" height="112">

<h1>FrameLoom</h1>

**用 AI 将文档变成视频**

Document-to-Video Skill for Coding Agents

[![配方库](https://img.shields.io/badge/Library-live%20previews-2855d9)](https://acorn2.github.io/frame-loom/)
[![CI](https://github.com/Acorn2/frame-loom/actions/workflows/ci.yml/badge.svg)](https://github.com/Acorn2/frame-loom/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-24%2B-339933)](package.json)
[![GitHub stars](https://img.shields.io/github/stars/Acorn2/frame-loom)](https://github.com/Acorn2/frame-loom/stargazers)

**6 套视频风格 · 40 个场景配方 · 5 套中文字体 · 静音预览 / 干净底片 / 有声视频**

[在线预览](https://acorn2.github.io/frame-loom/) · [快速开始](#快速开始) · [使用指南](references/usage-guide.md) · [参与开发](CONTRIBUTING.md)

</div>

**FrameLoom** 是以 Codex 为主要入口、兼容 Claude Code 等 Coding Agent 的本地视频生产 Skill。提供文章、讲稿或产品说明后，Agent 负责理解内容、编写讲稿和分镜，Remotion 负责校验与渲染。你可以先看静音预览，再决定导出供剪辑软件使用的干净画面底片，或接入 TTS／已有旁白制作项目内有声视频。

**提供截图时，视频会优先参考截图中的配色，而不是完全使用所选视频风格的默认色。** 风格保留构图、装饰与动效；背景、文字、卡片和强调色参考主体截图。详见[截图配色说明](#提供截图时视频如何配色)。

适合知识讲解、产品说明、报告摘要和数据解释。当前为 **v0.5 公开测试阶段**。Agent 生成的观点与事实需要创作者核对；自动 QA 后，底片交接和有声成片仍需要人工完整播放复核。

**[浏览风格与镜头配方 →](https://acorn2.github.io/frame-loom/)** 先选风格、复制制作指令，再回到本地 Agent 提供文档；默认根据文档推荐镜头组合，也可手动限定。网页只展示公开样例，不上传文档或执行视频生产。

```text
文档 / 文档＋图片 → Agent 编写讲稿与分镜 → 校验与 Remotion 渲染 → 预览 / 底片 / 有声视频 → QA 与人工复核
```

## 效果展示

下面是实际 Remotion 渲染的六套风格。它们使用[同一份公开分镜](examples/template-families/storyboard.semantic.json)，每套 7 个镜头、50.8 秒；截图与链接中的视频均为静音审片示例。

| 墨白杂志 · Editorial Ink | 暗场信号 · Signal | 手绘便签 · Sketch Notes |
| --- | --- | --- |
| ![墨白杂志开篇画面](examples/template-families/previews/retro-zine-semantic-opening.png) | ![暗场信号开篇画面](examples/template-families/previews/signal-semantic-opening.png) | ![手绘便签开篇画面](examples/template-families/previews/scatterbrain-semantic-opening.png) |
| [观看静音样片](examples/template-families/previews/retro-zine-semantic.mp4) | [观看静音样片](examples/template-families/previews/signal-semantic.mp4) | [观看静音样片](examples/template-families/previews/scatterbrain-semantic.mp4) |

| 瑞士蓝 · Swiss Blue | 工程蓝图 · Blueprint | 产品演示 · Product Frame |
| --- | --- | --- |
| ![瑞士蓝开篇画面](examples/template-families/previews/archive-grid-semantic-opening.png) | ![工程蓝图开篇画面](examples/template-families/previews/signal-noir-semantic-opening.png) | ![产品演示开篇画面](examples/template-families/previews/studio-frame-semantic-opening.png) |
| [观看静音样片](examples/template-families/previews/archive-grid-semantic.mp4) | [观看静音样片](examples/template-families/previews/signal-noir-semantic.mp4) | [观看静音样片](examples/template-families/previews/studio-frame-semantic.mp4) |

更完整的案例与输入见[纯文档试点](examples/creator-production-pilot/README.md)、[资料笔记](examples/video-templates/knowledge-notes/README.md)和[演示产品更新](examples/video-templates/product-update/README.md)。公开样片用于选型，使用你的文档时会另建项目并编排专属内容。

## 快速开始

### 1. 安装项目

准备 **Node.js 24+**（推荐 24 LTS）及 **FFmpeg / ffprobe**，然后执行：

```bash
git clone https://github.com/Acorn2/frame-loom.git
cd frame-loom
npm ci
```

在该仓库打开 Coding Agent：

- **Codex**：直接说“使用 frame-loom Skill”，仓库内的 [Skill 入口](.agents/skills/frame-loom/SKILL.md)会加载共享流程。
- **Claude Code**：在仓库根目录运行 `claude --plugin-dir .`，使用项目内的[插件清单](.claude-plugin/plugin.json)。
- **其他 Coding Agent**：让 Agent 先读取根目录 [SKILL.md](SKILL.md)，所有命令从仓库根目录运行。

首次渲染可能下载 Remotion 使用的浏览器。遇到环境问题，可按[贡献说明](CONTRIBUTING.md)检查 Node.js、FFmpeg 与命令输出。

### 2. 给 Agent 一篇文档

在 **Agent 对话框**中输入下面的指令，将占位路径换成现有 Markdown 或纯文本文档的绝对路径。下面以墨白杂志风格为例，镜头由 Agent 根据文档推荐：

```text
请使用 frame-loom Skill，将 <文档绝对路径> 制作成 16:9 横屏静音审片预览。
视频风格：retro-zine
请根据原文推荐兼容的镜头组合并逐场编排，说明来源、画面表达与选择理由；不按分类凑齐。
简要展示组合后直接继续制作，不增加确认步骤。
使用 fast 模式，保留原文，完成讲稿、Storyboard 2.4、校验、渲染和 QA。
完成后告诉我实际项目路径、preview-silent.mp4 路径、视频时长和 QA 结果。
```

你不需要先写 JSON、创建项目目录或配置配音。Agent 会按 `YYYYMMDD-内容主题` 建立新项目；成功后返回 `preview-silent.mp4` 的实际路径、代表帧、时长和 QA 结论。这个带审片标记的视频仅供检查画面。之后可在同一项目继续制作底片或有声版。

需要手动限定时，列出“可用镜头配方：<ID列表>”，Agent 只在集合内编排。自动推荐与渲染前内容检查见[镜头编排](references/shot-planning.md)。有图片时附上本地路径；需要截图时提供准确网址。要先审分镜，把“fast 模式”改为“使用 review 模式，先给我审核讲稿、分镜和时间安排；我确认后再渲染”。

### 可选：先从网页挑选效果

打开[在线配方库](https://acorn2.github.io/frame-loom/)，选择 **视频风格 → 制作设置**，默认由 Agent 根据文档选镜头；也可到镜头页手动限定集合，复制制作指令并粘贴到本地 Agent 对话框，再附上文档。只使用本项目制作视频，无需启动配方库的本地网页服务；文档和视频生产仍在本地进行。

### 提供截图时，视频如何配色？

提供主体产品截图，或提供准确网址让 Agent 截图后，**全片优先参考截图中的背景、标题／正文、卡片表面与强调色**，不只是替换按钮颜色。截图里的暖色或有色背景可以保留；真实截图本身不会被重新染色，内嵌字体也保持原貌。所选视频风格继续负责构图、装饰和动效，全片字体仍独立选择。

默认“自动判断”会识别截图用途：主体产品截图用于配色，引用或竞品截图不会自动替代主体颜色。没有配色参考时沿用风格与配方默认色。你也可以明确选择“跟随产品素材”，或选择“使用风格配色”保留默认色；**仅指定一个视频风格，不会取消截图配色参考**。素材配色目前支持六套当前风格与40个当前横屏场景，其他组合会说明限制。

附上素材时可直接告诉 Agent：

```text
产品截图：<截图绝对路径>（也可提供准确网址，让 Agent 截图）
请参考截图中的背景、文字、卡片和强调色确定全片配色。
保留我选择的视频风格的构图与动效，不给真实截图染色。
```

Agent 会记录取色来源，在渲染前后对照截图检查实际画面。公开配方库样片展示的是默认配色，不代表加入你的截图后的最终颜色。详细流程见[项目配色](references/project-palette.md)。

## 包含哪些能力

| 内容 | 当前可用能力 |
| --- | --- |
| 视频风格 | 6 套 Style Pack，分别组织默认配色、构图与基础动效；[查看风格](#六套视频风格) |
| 截图配色 | 优先参考主体截图的背景、文字、卡片与强调色，独立于风格、字体和镜头；[了解规则](#提供截图时视频如何配色) |
| 场景配方 | 40 个独立场景，覆盖标题、要点、对照、关系、流程与数据表达；[查看配方](shots/README.md) |
| 附属效果 | 9 个宿主动作、5 个换章配方；宿主动作依附指定镜头，不能作为独立场景 |
| 全片字体 | 思源黑体、思源宋体、霞鹜文楷、得意黑、小赖字体；独立单选，配有 30 组横屏风格×字体参考样片 |
| 预设组合 | `retro-zine-explainer` 提供可选的横屏知识讲解组合；[选用说明](video-templates/retro-zine-explainer/guide.md) |
| 输出路线 | 静音审片预览、干净画面底片、讲稿交接、TTS 或外部配音的项目内有声视频 |
| 本地生产 | Storyboard 契约、素材来源校验、渲染记录、QA 报告与审核指纹；[共享流程](SKILL.md) |
| 配方库网页 | 浏览真实样片、选择组合和复制制作指令，可本地运行或由 GitHub Pages 托管 |

当前运行时：40 个场景配方、9 个宿主动作、5 个换章配方；筛选清单接入 48/48。

横屏 16:9 的 40 个场景配方支持全部六套当前风格；竖屏 9:16 支持 `semantic-default`、`type-and-filter`、`ai-stream-response` 和 `unit-dot-regroup` 四项配方。场景配方与预设组合仍为 experimental，实际选用以[能力清单](src/renderer/capability-manifest.ts)为准。

## 六套视频风格

| 风格 | ID | 适合的内容 |
| --- | --- | --- |
| [墨白杂志 / Editorial Ink](styles/retro-zine/preview.md) | `retro-zine` | 观点文章、知识解释、故事 |
| [暗场信号 / Signal](styles/signal/preview.md) | `signal` | 核心观点、转折、重点说明 |
| [手绘便签 / Sketch Notes](styles/scatterbrain/preview.md) | `scatterbrain` | 学习笔记、方法拆解、灵感整理 |
| [瑞士蓝 / Swiss Blue](styles/archive-grid/preview.md) | `archive-grid` | 报告、分析、结构化方法论 |
| [工程蓝图 / Blueprint](styles/signal-noir/preview.md) | `signal-noir` | 系统、机制、技术流程 |
| [产品演示 / Product Frame](styles/studio-frame/preview.md) | `studio-frame` | 产品说明、教程、工作流 |

风格与字体独立选择；选定镜头集合后，Agent 可以重复、重排或只使用其中一部分，不会自动加入未选镜头。字体来源与固定版本见[字体清单](fonts/README.md)，手动初始化示例见[使用指南](references/usage-guide.md#风格--多镜头配方24)。

## 选择交付结果

| 你想得到什么 | 交付物与完成条件 |
| --- | --- |
| 先检查画面 | `preview-silent.mp4`：静音审片预览，带审片标记 |
| 在剪辑软件里继续制作 | `visual-master-vNNN.mp4`：无音轨、无旁白字幕和审片标记，附讲稿与逐镜时间表；完整视觉复核后完成画面交接 |
| 先录音，再回流制作 | `output/script-handoff/`：讲稿与分镜，第一阶段不生成 MP4 |
| 在 FrameLoom 内完成有声视频 | `pilot-audio.mp4`：接入 TTS 或匹配的外部旁白；自动 QA 后仍需完整播放复核 |

`fast` 直接推进当前阶段，`review` 在渲染前增加讲稿与分镜审核；两种模式都能选择上述输出。自动 QA 通过不等于成片已经人工验收。底片在外部剪辑完成的视频由外部流程验收。

TTS 支持豆包、OpenAI、ElevenLabs、阿里百炼和 MiniMax；只配置实际使用的一家，也可提供已有旁白与 SRT/VTT。配置样例默认关闭，密钥通过环境变量读取。音频缺失或不匹配时会说明缺口，不把静音或 mock 语音作为有声交付。步骤见[使用指南](references/usage-guide.md#6-接入音频制作项目内有声视频)与[音频接入说明](references/audio-integration.md)。

TTS 配置按服务校验语速、格式与声音控制；`list:tts-profiles` 展示配置状态及缺失项。可用 `preview:tts` 显式试听短句，再生成整片；支持的朗读指令、发音词典、前后场上下文与最终采样率见[配置说明](references/audio-integration.md#validated-voice-controls)。

### 配置 TTS

只选一家，按表中的[逐家配置步骤](references/tts-setup.md)取得凭据、复制样例并启用：

| 服务 | 仓库配置样例 | 需要设置的环境变量 | 预设模型 / 音色 |
| --- | --- | --- | --- |
| [豆包](references/tts-setup.md#豆包) | [doubao.json](examples/tts-profiles/doubao.json) | `VOLC_TTS_API_KEY`、`VOLC_TTS_RESOURCE_ID`、`VOLC_TTS_SPEAKER` | v3 / 从音色环境变量读取 |
| [OpenAI](references/tts-setup.md#openai) | [openai.json](examples/tts-profiles/openai.json) | `OPENAI_API_KEY` | `gpt-4o-mini-tts` / `alloy` |
| [ElevenLabs](references/tts-setup.md#elevenlabs) | [elevenlabs.json](examples/tts-profiles/elevenlabs.json) | `ELEVENLABS_API_KEY` | `eleven_multilingual_v2` / `JBFqnCBsd6RMkjVDRZzb` |
| [阿里百炼](references/tts-setup.md#阿里百炼) | [aliyun.json](examples/tts-profiles/aliyun.json) | `DASHSCOPE_API_KEY`（北京地域） | `qwen3-tts-flash` / `Cherry` |
| [MiniMax](references/tts-setup.md#minimax) | [minimax.json](examples/tts-profiles/minimax.json) | `MINIMAX_API_KEY` | `speech-2.8-hd` / `male-qn-qingse` |

以 MiniMax 首次配置为例，在仓库根目录执行，`projects/my-video` 替换成你的已有项目路径：

```bash
cp -n examples/tts-profiles/minimax.json projects/my-video/audio/tts-config.json
```

编辑目标 JSON，把 `"enabled": false` 改为 `"enabled": true`；若目标文件已存在，`cp -n` 会保留它，请先核对实际服务。然后在运行 FrameLoom 的同一终端设置凭据并检查：

```bash
export MINIMAX_API_KEY='<你的 MiniMax API Key>'
npm run list:tts-profiles -- projects/my-video
```

`ready` 只表示本地参数和环境变量齐全。确认需要在线试听后再运行（会调用服务商，可能收费）：

```bash
npm run preview:tts -- projects/my-video --tts-config projects/my-video/audio/tts-config.json --text "你好，请确认音色与语速。"
```

试听输出到 `audio/previews/`。完整配置 JSON、Windows 写法、各家参数限制、多个配置切换和整片制作命令见 [TTS 配置指南](references/tts-setup.md)。网页预设不会配置密钥；FrameLoom 不自动读取 `.env`，也不把真实 Key 写入 JSON。

## 仓库结构

```text
frame-loom/
├── SKILL.md                 # Coding Agent 共享生产流程
├── .agents/skills/          # Codex 自动发现入口
├── .claude-plugin/          # Claude Code 插件元数据
├── src/                     # Remotion、分镜类型、校验与 renderer
├── schemas/                 # 对外 JSON Schema 契约
├── shots/                   # 场景、宿主动作与换章配方及来源
├── video-templates/         # 可选的预设组合
├── styles/                  # 视频风格包
├── fonts/ & public/fonts/   # 字体清单、文件与原始许可
├── library/                 # 配方库网页、字体示例与产品图标
├── examples/                # 公开文档、分镜与示例画面
├── scripts/                 # 校验、初始化、渲染与 QA 入口
├── references/              # 使用指南与生产契约
└── projects/                # 本地用户项目，不提交到 Git
```

## 文档与参与开发

- [使用指南](references/usage-guide.md)：制作路线、字体选择、CLI、配音配置与交付审核。
- [TTS 配置指南](references/tts-setup.md)：五家服务的凭据入口、可复制配置、环境变量、检查、试听与排错。
- [Skill 流程](SKILL.md)与[Storyboard 契约](references/storyboard-schema.md)：Agent 编排与渲染输入约束。
- [质量生产说明](references/quality-production.md)：实测音频时间、字幕调整与镜头质量。
- [配方库本地运行与 Pages 发布](library/README.md)：需要本地浏览或维护配方库时，查看服务启动、预览生成及静态站点部署说明。
- [贡献说明](CONTRIBUTING.md)、[变更记录](CHANGELOG.md)与[安全反馈](SECURITY.md)。

本地修改可先运行 `npm run check:docs`、`npm run validate:shots`、`npm run typecheck`、`npm run lint` 和 `npm test`。Runtime 改动还需渲染对应示例并复核实际画面；完整开发检查见贡献说明。

## 致谢与许可

- [Remotion](https://www.remotion.dev/)：提供基于 React 的确定性视频渲染能力。
- [video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft)：镜头配方的方法参考，以及本 README 的展示结构参考；具体来源、适配范围和许可记录见各配方的 `provenance.json` 与[接入台账](shots/shortlist-coverage.json)。
- 项目内使用的开源中文字体：原始版权与 SIL OFL 1.1 许可保留在[字体目录](fonts/README.md)。

FrameLoom 自有代码采用 [MIT](LICENSE)。Remotion 使用独立的[官方许可](https://www.remotion.dev/license)，字体、图片、配乐和 TTS 输出按各自来源条款使用；本项目的 MIT 不替代这些许可。

## 作者

由 **Hresh赫什** 维护，持续实践用 AI 把想法做成产品。项目进展与其他实践见[个人网站](https://hreshhao.com/)。欢迎通过 [Issue](https://github.com/Acorn2/frame-loom/issues)反馈使用问题，或按贡献说明提交改进。

## 布局可靠性

新建2.4项目默认使用内容优先布局；旧分镜保留原画面。正式渲染检查实际文字、节点和图片显示区域，完成态的遮挡/裁切会阻止候选发布，主体过小和重复构图进入复核。详见[布局与检查契约](references/content-layout.md)。自动QA不替代完整播放和来源截图内部可读性检查。
