# Architecture

FrameLoom 把语义决策与确定性渲染分开。Agent 读取来源、拆分主张、选择画面工作并写入 JSON；CLI 不从文档自动推断事实或关系。

## 数据流

`project-input.json` 确定纯文档或文档加图片；原文、`shot-map.md` 和可选的 `asset-manifest.json` 提供可追溯输入。`storyboard.draft.json` 经生产流程转为可渲染的 `storyboard.json`。`src/schemas/storyboard.ts` 定义 2.3 结构，`src/validation/` 校验语义关系、时长、Style Pack 能力与素材路径。`src/renderer/render-scene.tsx` 根据 `scene.visual` 选择语义渲染器；没有 `visual` 的历史分镜继续走旧模板。Style Pack 只提供外观和动效参数，不决定文案中的关系。

`scripts/produce.mjs` 串联校验、音频选择、渲染和 QA；`scripts/preview-semantic-visuals.mjs` 用同一公开分镜渲染各 Style Pack 的完成态，供回归审阅。渲染后的 MP4、抽帧和报告保存在项目输出目录。

## 边界

- 示意图必须以 `diagram` 表示；真实媒体必须有本地素材和 manifest 来源。
- 数字来自文档或用户素材，`visual.source` 记录位置；代码只校验存在，不替创作者核实内容。
- 静音预览按屏显信息估算初始时长；实际旁白以测得的音频时间为准。
- 自动抽帧检查覆盖动作中途、完成态和切镜前；正常速度全片播放仍由人审阅。
