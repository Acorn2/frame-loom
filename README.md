# FrameLoom / 帧织

FrameLoom 是一个面向 Codex、Claude Code、Kimi Code、OpenCode 等 Coding Agent 的结构化视频生产 Skill。它把 Markdown 或结构化内容转成经过人工审核、可重复渲染的 Remotion 视频。

当前 `v0.5` 已跑通“风格选择 → 项目初始化 → 审核后渲染 → QA”的本地闭环，并提供可选、供应商无关的音频 pilot：

```text
style selection → storyboard review → validation → Remotion → silent/audio preview → QA report
```

## 快速开始

需要 Node.js 20+。

```bash
npm install
npm run typecheck
npm test
npm run list:styles
npm run preview:styles -- /tmp/frame-loom-style-gallery.html
npm run init:project -- my-video --style retro-zine --canvas landscape
npm run validate:storyboard -- examples/article-video/storyboard.json
npm run validate:assets -- examples/article-video/storyboard.json
npm run check:safe-area -- examples/article-video/storyboard.json
npm run render:storyboard -- examples/article-video/storyboard.json /tmp/frame-loom-preview.mp4
npm run qa:storyboard -- examples/article-video/storyboard.json /tmp/frame-loom-preview.mp4 /tmp/frame-loom-review
```

`preview:styles` 生成自包含 HTML 候选画廊，不会提前渲染全片。`init:project` 和 `render:storyboard` 默认拒绝覆盖已有目标；确认路径后可用 `--force` 覆盖视频。`qa:storyboard` 会检查契约、素材、安全区和输出元数据，并生成代表帧、`contact-sheet.png` 与 `qa-report.json`。自动检查通过仍需完整播放复核。

内置示例：

- `examples/article-video/`：横屏 `retro-zine`
- `examples/product-demo/`：横屏 `retro-windows`
- `examples/data-explainer/`：竖屏 `scatterbrain`

当前 production-safe 模板包括：

- `statement`：主张、标题和结论
- `graph-explainer`：节点关系和连线演进
- `metric-grid`：指标比较和数据摘要
- `interaction-flow`：真实产品截图的状态切换

三套 Style Pack（`retro-zine`、`retro-windows`、`scatterbrain`）均通过同一契约加载。详细阶段规则见 `references/`。

可选音频不绑定 TTS 服务。准备本地音频、SRT/VTT 和 `audio-config.json` 后，先测量时间轴和响度再渲染：

```bash
npm run inspect:audio -- projects/my-video/storyboard.json projects/my-video/audio/audio-config.json
npm run render:storyboard -- projects/my-video/storyboard.json projects/my-video/output/pilot-audio.mp4 --audio-config projects/my-video/audio/audio-config.json
npm run qa:storyboard -- projects/my-video/storyboard.json projects/my-video/output/pilot-audio.mp4 --audio-config projects/my-video/audio/audio-config.json
```

维护者可以运行 `npm run test:audio-pilot`，使用临时生成的测试音频和字幕验证完整的 audio pilot 渲染与 QA 闭环；测试不会把音频文件写入仓库。

维护者可以运行 `npm run test:visual-regression`，渲染三个公开示例并检查三套 Style Pack、四类模板、横屏/竖屏和代表帧覆盖。首版输出 contact sheet 供人工复核，不使用像素快照替代完整播放。

## 工作边界

FrameLoom 适合知识讲解、产品流程、报告摘要、数据解释和文档汇报。它不承诺剧情片、真人表演、复杂 3D 或主要依赖生成式镜头的宣传片。AI 负责内容判断和 storyboard 草稿，程序负责时间轴、布局、动作和渲染；审核后的 `storyboard.json` 才能进入渲染。

扩展说明见 [`docs/style-pack-development.md`](docs/style-pack-development.md)、[`docs/template-development.md`](docs/template-development.md) 和 [`references/audio-integration.md`](references/audio-integration.md)。项目路线见 [`docs/frame-loom-development-plan.md`](docs/frame-loom-development-plan.md)。

## 许可证

MIT。Remotion 的使用和商业条款请在部署前按所安装版本核对官方许可说明。
