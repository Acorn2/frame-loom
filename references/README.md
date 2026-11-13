# FrameLoom 文档导航

[简体中文首页](../README.md) · [English home](../README.en.md)

第一次使用从 README 的快速开始进入；本文按任务索引详细指南。所有本地命令从仓库根目录运行。当前功能以代码、受控清单和使用指南为准；带日期的实施与审查记录只说明当时的验证范围。

## 安装与首次使用

| 你要做什么 | 文档 |
| --- | --- |
| 安装工具、试跑样片、更新或排错 | [中文安装指南](installation.md) · [English installation guide](installation.en.md) |
| 让 Agent 制作第一条视频 | [中文快速开始](../README.md#快速开始) · [English quick start](../README.en.md#quick-start) |
| 比较实际效果并复制制作指令 | [在线配方库](https://acorn2.github.io/frame-loom/) · [本地配方库指南](../library/README.md) |

## 制作与交付

- [编辑讲解、机制图解与产品实演](direction-recipes.md)：正式配方、来源与图表、真实截图取景、兼容边界与用途样片。

| 你要做什么 | 文档 |
| --- | --- |
| 选静音预览、画面底片、TTS 或外部配音路线 | [使用指南](usage-guide.md) |
| 编排逐场计划、导出讲稿与审阅表 | [内容编排与审阅](usage-guide.md#逐场计划讲稿与审阅表) |
| 在新会话接手已有制作 | [项目状态与文档交接](usage-guide.md#接手已有项目) |
| 按时间码反馈、确认修改镜头并生成新版 | [审片与返工](usage-guide.md#边看边提意见按镜头复核新版) |
| 复用角色、品牌和固定结尾制作多期 | [系列制作](usage-guide.md#基于系列新建一期) |
| 切换成片系统标签的中英文 | [系统标签语言](usage-guide.md#成片系统标签语言) |
| 使用手绘白板、批注图解或情境叙事 | [主风格固定制作流程](primary-style-production.md) |
| 规划、生成和登记辅助插画 | [插画生产](illustrated-production.md) |
| 编排圈注、旁注、文字重排和阶段关系 | [文案动画制作](text-led-production.md) |
| 为六套图文动效风格推荐或限定镜头 | [镜头编排](shot-planning.md) · [配方目录](../shots/README.md) |
| 选择全片字体 | [字体目录与来源](../fonts/README.md) |
| 从产品截图采样完整配色 | [项目配色](project-palette.md) |
| 配置一家 TTS 服务、检查或试听 | [TTS 配置指南](tts-setup.md) |
| 根据语音证据安排字幕、白板和分场缓存 | [语音同步与增量渲染](speech-driven-production.md) |
| 设置品牌名、Logo 和同源封面 | [品牌配置](branding.md) |
| 控制审片图片体积、归档修订或检查空间 | [产物与空间管理](artifact-storage.md) |
| 检查布局、节奏和交付条件 | [内容布局](content-layout.md) · [质量生产](quality-production.md) · [审片清单](review-checklist.md) |

## Agent 与开发者参考

| 入口 | 用途 |
| --- | --- |
| [共享 Skill](../SKILL.md) | Codex、Claude Code 和其他 Coding Agent 的生产流程 |
| [生产管线](production-pipeline.md) | 项目文件、阶段、恢复和交付 |
| [风格选择](style-selection.md) | 渐进加载风格定义与兼容能力 |
| [Storyboard 契约](storyboard-schema.md) | 当前 2.4 和历史 2.1–2.3 输入规范 |
| [音频接入](audio-integration.md) | 服务参数、音频清单、字幕和音频 QA |
| [能力清单](../src/renderer/capability-manifest.ts) | Renderer 已声明的运行能力 |
| [架构](../ARCHITECTURE.md) · [技术栈](../TECH-STACK.md) · [MVP](../MVP.md) | 数据流、实现选择与验收边界 |

## 参与开发与版本维护

- [贡献指南](../CONTRIBUTING.md)：问题反馈、改动范围、本地验证和 PR 说明。
- [安全反馈](../SECURITY.md)：漏洞报告方式、敏感信息与维护范围。
- [变更记录](../CHANGELOG.md)：未发布变更；`Unreleased` 不代表已有 Release。
- [v0.5 Release 草稿](release-notes-v0.5.md)：发布文案与发布前核对，实际版本以已发布 tag 为准。
- [历史发布检查](release-readiness.md)：带日期的实测证据与当时的缺口，不代表当前远端状态。

## 历史实施与回归记录

以下文档保留原始数量、版本与验证结果，用于追溯；新项目请使用上面的当前指南。

- [墨白杂志正式配方接入](editorial-integration-20261112.md)：编辑讲解、正式样片与旧项目兼容验证。
- [四项工作流端到端验收](workflow-e2e-20261112.md)，含新会话交接、时码反馈、局部确认及整片重生成。

- [模板重构](video-template-refactor-status.md)、[动效重做](shot-motion-redesign.md)、[视觉改造](shot-visual-redesign.md)、[P2 接入](p2-recipe-implementation.md)。
- [风格组合复核](style-shot-compatibility.md)、[横竖屏镜头扩展](shot-expansion-20261009.md)、[配色实施](project-palette-implementation.md)、[样片恢复](library-preview-recovery.md)。
- [同分镜六风格样片](../examples/template-families/README.md)、[原创白板](../examples/whiteboard-original/README.md)、[当前文案动画](../examples/text-led-video/README.md)。
- [历史插画风格](../examples/illustrated-video/README.md)、[上游白板对照](../examples/whiteboard-reference/README.md)：保留素材与署名，用于兼容和方法回归。

- [批注图解与情境叙事](image-led-directions.md)：当前图像主导配方、素材规范版本、正式样片与兼容边界。
