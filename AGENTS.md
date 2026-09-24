# FrameLoom 项目规则

## 定位

FrameLoom 是以 Codex 为主要入口、兼容其他 Coding Agent 的本地、确定性视频生产 Skill。当前版本优先完成 `storyboard.json → validate → silent MP4` 的垂直闭环。

## 目录职责

- `src/`：Remotion composition、类型、校验和 renderer。
- `schemas/`：对外可读的 JSON Schema 契约。
- `styles/`：可渐进加载的 Style Pack，不放用户私有素材。
- `scripts/`：本地校验和渲染入口。
- `examples/`：公开、可替换、无私有凭据的示例生产层。
- `projects/`：用户视频生产目录，不提交输出视频。
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

默认 review 渲染只接受 `reviewed` 或 `approved` 状态的 storyboard；只有 `produce --mode fast` 显式允许自动校验通过的 `generated` 或 `validated` 状态。默认不生成音频，静音 MP4 只能作为视觉预览。

## 约束

- Renderer 只能使用 `src/renderer/capability-manifest.ts` 声明的能力。
- `storyboard.draft.json` 不得直接作为生产渲染输入。
- 真实产品界面、字体、音乐和图片必须有来源说明；v0.1 示例只使用 CSS 和文本。
- 系统层不得依赖某一个示例的文案、素材或产品事实。
