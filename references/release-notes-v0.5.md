# FrameLoom v0.5.0 发布说明草稿

本文是待维护者核对的 GitHub Release 文案，不表示版本已发布。实际 tag、提交和公开站点应在发布前确认。

## 可用于 Release 的正文

FrameLoom 是一个将文档制作成图解与动画视频的 Coding Agent Skill。给 Codex、Claude Code 或其他 Agent 一篇文章、讲稿或产品说明，由 Agent 编排内容，Remotion 在本机渲染。

本次公开测试版提供：

- 六套视频风格、40 个横屏场景配方和五套中文字体；Agent 根据文档推荐镜头，也可手动限定。
- 静音审片预览、供剪辑软件使用的干净画面底片、讲稿交接，以及 TTS 或外部旁白的有声视频。
- 主体产品截图配色、素材来源记录、分镜校验、渲染记录与自动 QA。
- 自带样片与文档试跑、双语安装和排错指南，以及 Codex / Claude Code 的共享 Skill 入口。

从[中文 README](../README.md#快速开始)或 [English README](../README.en.md#quick-start)开始。安装需要 Git、Node.js 24+ 和 FFmpeg / ffprobe；现成静音样片无需 Agent 或 TTS Key。

### 安装这个版本

以下命令属于发布正文草稿，只有 `v0.5.0` tag 实际发布后才可使用：

```bash
git clone --depth 1 --branch v0.5.0 https://github.com/Acorn2/frame-loom.git frame-loom-v0.5.0
cd frame-loom-v0.5.0
npm ci
npm run render:storyboard -- examples/creator-production-pilot/storyboard.json .tmp/quick-start/preview-silent.mp4 --mode fast
npm run inspect:output -- .tmp/quick-start/preview-silent.mp4 examples/creator-production-pilot/storyboard.json
```

预期输出为 20 秒、1920×1080、30 fps 的静音视频。固定 tag 的检出可能显示 detached HEAD 提示，这是正常的；制作项目不需要切换分支。更新时安装到新目录，保留旧版项目和本机配置，详见[版本选择与更新](installation.md#选择版本与更新)。

当前仍是公开测试版。以文字、图解与真实素材为主，竖屏支持范围小于横屏。生成事实、发音和成片效果需要创作者复核；自动 QA 不替代完整播放。Remotion、字体及音频服务使用各自许可与条款，详见 README。

## 发布前核对

- 确认 tag 和发布提交，使用最终公开源码重新完成安装与首次样片渲染。独立本地副本的检查不能替代发布后的真实克隆。
- 核对 `package.json`、锁文件与 `.claude-plugin/plugin.json` 的版本一致，tag 指向该已验收提交；记录提交 SHA。发布后实际运行上面的固定 tag 安装命令，再开放这个版本入口。
- 确认该提交的 CI 与 Pages 部署成功；在线 catalog 应为六套风格、40 个场景和五家 TTS 预设，再检查实际样片与复制指令。
- 在实际 Claude Code 中验证插件加载和 `/frame-loom:frame-loom` 调用；目录与 manifest 的静态检查不能替代此步骤。
- 确认公开素材与许可，以及支持系统的真实验证范围。Windows 未完成安装与渲染验收时，保留指南中的说明。

GitHub Release 网页中的链接应按实际发布 tag 指向仓库文件，并检查它们可访问。以上操作需要维护者在授权范围内执行；本草稿不自动提交、打 tag、推送或发布。
