# FrameLoom 项目规则

## 定位

FrameLoom 是以 Codex 为主要入口、兼容其他 Coding Agent 的本地、确定性视频生产 Skill。当前版本支持讲稿交接、静音审片预览、供外部剪辑的干净画面底片，以及 TTS／外部旁白合成的项目内有声视频。

## 目录职责

- `src/`：Remotion composition、类型、校验和 renderer。
- `schemas/`：对外可读的 JSON Schema 契约。
- `styles/`：可渐进加载的 Style Pack，不放用户私有素材。
- `scripts/`：本地校验和渲染入口。
- `examples/`：公开、可替换、无私有凭据的示例生产层。
- `projects/`：用户视频生产目录，不提交输出视频。新生产项目使用 `YYYYMMDD-内容主题` 命名；同日同名用 `-02`、`-03`，旧目录不批量改名，`template-` 预设示例不适用。
- `.agents/skills/frame-loom/`：Codex 自动发现入口；根目录 `SKILL.md` 是共享生产流程。
- `.claude-plugin/`：Claude Code 插件元数据，复用根目录 `SKILL.md`。

## 验证入口

```bash
npm run typecheck
npm run lint
npm run test:storyboard
npm run validate:storyboard -- examples/article-video/storyboard.json
npm run render:storyboard -- examples/article-video/storyboard.json /tmp/frame-loom-preview.mp4 --mode fast
npm run inspect:output -- /tmp/frame-loom-preview.mp4 examples/article-video/storyboard.json
```

`produce --mode review` 要求 `reviewed` 或 `approved` 状态及当前 `storyboard-approval.json` 指纹；`fast` 可推进 `generated`／`validated`。`--output-purpose visual-preview|visual-master|in-project-video` 决定交付用途；`--audio-mode silent|tts|external|auto` 决定音频来源。没有音频时只有审片预览或画面底片；明确要求项目内有声视频不能静默回退。画面底片经自动 QA 和完整视觉复核后由 `approve:visual-handoff` 标记为可交后期；项目内有声讲解视频需要匹配旁白、音频与画面 QA，并由 `approve:delivery` 记录完整播放复核。

## 约束

- Renderer 只能使用 `src/renderer/capability-manifest.ts` 声明的能力。
- 所有视频模板的旁白字幕与场景字幕都直接显示在画布上，不得添加实色或半透明的字幕底板、胶囊或背景色。字幕使用 Style Pack 独立的 `captionInk`，与正文 `ink` 区分：浅色画布使用深色字幕，深色画布使用白色字幕，并保证文字对比度和安全区。
- 底部旁白字幕按短句单行展示，不把整场讲稿一次铺满画面。TTS 项目的每场旁白起点要贴合镜头起点，旁白结束到换镜的空档不得超过 0.5 秒；需要更长的视觉停留时，拆成独立镜头。
- 所有模板的底部旁白字幕在每条字幕首尾省略逗号、句号、顿号、分号、冒号等停顿标点；同一条字幕内部需要区分分句时保留标点，句末问号和感叹号按语气保留。只处理显示与导出的字幕，不改讲稿或 TTS 朗读文本。
- `storyboard.draft.json` 不得直接作为生产渲染输入。
- 真实产品界面、字体、音乐和图片必须有来源说明；v0.1 示例只使用 CSS 和文本。
- 系统层不得依赖某一个示例的文案、素材或产品事实。
