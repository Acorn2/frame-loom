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

[看实际效果](#效果展示) · [做第一条视频](#快速开始) · [浏览风格](https://acorn2.github.io/frame-loom/) · [安装与排错](references/installation.md)

</div>

**FrameLoom** 让 Coding Agent 把文章、讲稿或产品说明编排成视频：Agent 理解内容、写讲稿和分镜，Remotion 在本机渲染图解与动画。你可以先看静音预览，继续导出供剪辑软件使用的干净画面，或接入配音制作有声视频。

## 效果展示

**真实案例：把儿童自然博物馆的宣传文案和网站截图，做成一条 65 秒有声视频。** Agent 编排讲稿与镜头，使用真实模型截图、生命阶段图解和访问条件对照；生成文字统一字体，配色来自产品首页。

![FrameLoom 真实案例：网站模型截图、生命阶段图解、观察问题与访问条件对照](examples/nature-museum-case/previews/highlights.gif)

[观看完整有声待审样片](examples/nature-museum-case/previews/nature-museum-narrated.mp4) · [案例与素材来源](examples/nature-museum-case/README.md) · [图解动画示例](examples/template-families/README.md) · [在线浏览六套风格](https://acorn2.github.io/frame-loom/)

完整样片为 19 场，带真实 TTS 旁白；动图为实际视频片段，没有声音。旋转与缩放镜头展示操作后的截图。案例经过制作与画面迭代，完整听看和素材公开使用仍待复核；使用自己的文档时，Agent 会重新编排。

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

六套风格使用同一份分镜，便于比较。下面展示图解完成态；可点击观看实际静音样片。

| 墨白杂志 · Editorial Ink | 暗场信号 · Signal | 手绘便签 · Sketch Notes |
| --- | --- | --- |
| ![墨白杂志关系图解](examples/template-families/previews/retro-zine-semantic-process.png) | ![暗场信号关系图解](examples/template-families/previews/signal-semantic-process.png) | ![手绘便签关系图解](examples/template-families/previews/scatterbrain-semantic-process.png) |
| [观看样片](examples/template-families/previews/retro-zine-semantic.mp4) | [观看样片](examples/template-families/previews/signal-semantic.mp4) | [观看样片](examples/template-families/previews/scatterbrain-semantic.mp4) |

| 瑞士蓝 · Swiss Blue | 工程蓝图 · Blueprint | 产品演示 · Product Frame |
| --- | --- | --- |
| ![瑞士蓝关系图解](examples/template-families/previews/archive-grid-semantic-process.png) | ![工程蓝图关系图解](examples/template-families/previews/signal-noir-semantic-process.png) | ![产品演示关系图解](examples/template-families/previews/studio-frame-semantic-process.png) |
| [观看样片](examples/template-families/previews/archive-grid-semantic.mp4) | [观看样片](examples/template-families/previews/signal-noir-semantic.mp4) | [观看样片](examples/template-families/previews/studio-frame-semantic.mp4) |

在[在线配方库](https://acorn2.github.io/frame-loom/)选择风格，复制制作指令，再交给本地 Agent 和你的文档。Agent 默认根据内容推荐镜头；也可手动限定。网页只展示公开样例，视频生产在本地进行。

## 预览满意后，继续完成视频

| 想得到什么 | 下一步与输出 |
| --- | --- |
| 加旁白，得到有声视频 | 配置[豆包、OpenAI、ElevenLabs、阿里百炼或 MiniMax](references/tts-setup.md)中的一家，或提供匹配的外部配音；输出 `output/pilot-audio.mp4` |
| 交给剪辑软件继续制作 | 要求导出干净画面底片；输出 `output/visual-master-vNNN.mp4`，无音轨、旁白字幕和审片标记，附讲稿与逐镜时间表 |
| 先录音，再制作画面 | 要求先交付讲稿和分镜；输出 `output/script-handoff/`，之后接回录音制作 |

例如，已配置好 TTS 后，在同一个项目中继续说：

```text
请在刚才的项目中继续制作有声版，使用已配置的真实 TTS。
如果有多个可用配置，先让我选择；按实测配音时长调整画面，完成渲染与 QA。
```

配置细节、外部配音和审核步骤见[使用指南](references/usage-guide.md)。有声视频与底片交接需要你完整播放复核；自动 QA 通过不等于事实、发音和视觉效果均已人工验收。

## 常见问题

**需要会写代码或分镜 JSON 吗？** 不需要手写。你需要安装本地工具、能使用 Coding Agent，并检查它生成的内容；CLI 和 JSON 是 Agent 的工作入口。

**必须配置配音吗？是否收费？** 第一条静音预览无需配音。使用 TTS 时只配置一家服务；Agent 和 TTS 的费用取决于各自服务，本地渲染不调用生成式视频 API。

**支持竖屏吗？** 16:9 横屏支持全部六套风格与 40 个场景配方；9:16 竖屏目前支持基础语义、操作筛选、结果生成和单位点阵重组四项配方。字体可独立选择，详见[字体清单](fonts/README.md)。

**文档会上传到配方库网站吗？** 网站不接收文档。渲染在本机进行；你选择的 Agent 或 TTS 服务可能接收文档内容或旁白，按其配置与服务条款使用。

**遇到错误或效果不满意怎么办？** 先看[安装与排错](references/installation.md#常见安装问题)。仍有问题时提交[安装或运行问题](https://github.com/Acorn2/frame-loom/issues/new?template=setup-problem.yml)或[视频效果反馈](https://github.com/Acorn2/frame-loom/issues/new?template=video-feedback.yml)。

## 深入使用与参与开发

- [使用指南](references/usage-guide.md)：选风格、字体、素材、配音、导出和审核。
- [TTS 配置](references/tts-setup.md)与[截图配色](references/project-palette.md)：按需加载的操作说明。
- [共享 Skill](SKILL.md)、[镜头配方](shots/README.md)与[Storyboard 契约](references/storyboard-schema.md)：Agent 与开发者入口。
- [贡献说明](CONTRIBUTING.md)、[变更记录](CHANGELOG.md)与[安全反馈](SECURITY.md)。

<details>
<summary>开发者：当前镜头能力摘要</summary>

当前运行时：40 个场景配方、9 个宿主动作、5 个换章配方；筛选清单接入 48/48。

当前场景配方与预设组合为 experimental；兼容范围以[能力清单](src/renderer/capability-manifest.ts)为准。可选预设见[知识讲解组合](video-templates/retro-zine-explainer/guide.md)，本地网页维护见[配方库指南](library/README.md)。

</details>

## 致谢与许可

- [Remotion](https://www.remotion.dev/)提供基于 React 的确定性视频渲染能力。
- [video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft)提供镜头配方方法与展示结构参考；来源及适配许可见各配方 `provenance.json` 与[接入台账](shots/shortlist-coverage.json)。
- 项目字体保留原始版权与 SIL OFL 1.1 许可，见[字体目录](fonts/README.md)。

FrameLoom 自有代码采用 [MIT](LICENSE)。Remotion 使用独立的[官方许可](https://www.remotion.dev/license)；字体、图片、配乐和 TTS 输出按各自来源条款使用，本项目的 MIT 不替代这些许可。

由 **Hresh赫什** 维护，持续实践用 AI 把想法做成产品。其他产品与实践见[个人网站](https://hreshhao.com/)。
