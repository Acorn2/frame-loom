# FrameLoom 公开产品材料快照

来源：仓库根目录 `README.md`，2026-09-24。本文件保留本次样片使用的原文片段，后续 README 修改不覆盖这份输入。

## S1 · 产品定位

FrameLoom 是一个以 Codex 为主要入口、兼容 Claude Code、Kimi Code、OpenCode 等 Coding Agent 的结构化视频生产 Skill。它把 Markdown 或结构化内容转成经过人工审核、可重复渲染的 Remotion 视频。

## S2 · 当前生产流程

当前 `v0.5` 已跑通“风格选择 → 项目初始化 → storyboard → 渲染 → QA”的本地闭环，并提供 `review` / `fast` 两种执行模式和可选、供应商无关的音频 pilot：

```text
style selection → storyboard → validation → Remotion → silent/audio preview → QA report
```

## S3 · 自动预览边界

`fast` 不会把空白占位草稿写成视频，也不代表人工审核通过。

自动检查通过仍需完整播放复核。
