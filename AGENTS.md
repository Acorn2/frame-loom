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
npm run render:storyboard -- examples/article-video/storyboard.json /tmp/frame-loom-preview.mp4
npm run inspect:output -- /tmp/frame-loom-preview.mp4 examples/article-video/storyboard.json
```

`produce --mode review` 要求 `reviewed` 或 `approved` 状态及当前 `storyboard-approval.json` 指纹；`fast` 可推进 `generated`／`validated`。`--output-purpose visual-preview|visual-master|in-project-video` 决定交付用途；`--audio-mode silent|tts|external|auto` 决定音频来源。没有音频时只有审片预览或画面底片；明确要求项目内有声视频不能静默回退。画面底片经自动 QA 和完整视觉复核后由 `approve:visual-handoff` 标记为可交后期；项目内有声讲解视频需要匹配旁白、音频与画面 QA，并由 `approve:delivery` 记录完整播放复核。

## 约束

- Renderer 只能使用 `src/renderer/capability-manifest.ts` 声明的能力。
- `storyboard.draft.json` 不得直接作为生产渲染输入。
- 真实产品界面、字体、音乐和图片必须有来源说明；v0.1 示例只使用 CSS 和文本。
- 系统层不得依赖某一个示例的文案、素材或产品事实。
