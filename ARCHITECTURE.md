# Architecture

FrameLoom 把语义决策与确定性渲染分开。Agent 读取来源、拆分主张、选择画面工作并写入 JSON；CLI 不从文档自动推断事实或关系。

## 数据流

`project-input.json` 确定纯文档或文档加图片；原文、`shot-map.md` 和可选的 `asset-manifest.json` 提供可追溯输入。`storyboard.draft.json` 经生产流程转为可渲染的 `storyboard.json`。`src/schemas/storyboard.ts` 定义 2.3 结构，`src/validation/` 校验语义关系、时长、Style Pack 能力与素材路径。`src/renderer/render-scene.tsx` 根据 `scene.visual` 选择语义渲染器；没有 `visual` 的历史分镜继续走旧模板。Style Pack 只提供外观和动效参数，不决定文案中的关系。

`scripts/produce.mjs` 串联校验、音频选择、渲染和 QA；`scripts/preview-semantic-visuals.mjs` 用同一公开分镜渲染各 Style Pack 的完成态，供回归审阅。渲染后的 MP4、抽帧和报告保存在项目输出目录。

正式 MP4 先写入输出目录内的隔离临时目录，完成媒体检查并生成对应指纹记录后再替换目标文件。失败的渲染不会发布残缺视频；显式覆盖时保留旧视频和记录，发布失败可回退。下次运行会识别已结束进程留下的临时目录，恢复被中断替换的旧文件；遇到无法判定的外部改动则停止，保留回退文件供人工核对。QA 抽帧和分页也先在临时目录生成，再写入审片目录，索引最后发布。

`src/timeline/overlap-handoff.ts` 统一旧模板、镜头职责模板与语义模板的重叠透明度；`attention.ts` 和 `motion-progress.ts` 根据分镜 beat 与 Style Pack 参数控制主体入场及注意力。音频轨在 composition 中按项目时长淡入淡出，QA 对成片尾部采样并记录静音警告。这些规则不选择素材或虚构画面内容。

## 边界

- 示意图必须以 `diagram` 表示；真实媒体必须有本地素材和 manifest 来源。
- 数字来自文档或用户素材，`visual.source` 记录位置；代码只校验存在，不替创作者核实内容。
- 静音预览按屏显信息估算初始时长；实际旁白以测得的音频时间为准。
- 自动抽帧检查覆盖动作中途、完成态和切镜前；正常速度全片播放仍由人审阅。
- 2.3 长片的逐镜完成态和交接前帧为必选审片证据；接触表每页最多 48 帧，索引记录页与帧号、时间范围。QA 检查每场覆盖和分页数量。

## 语音资产、派生时间与交付

原稿仍以 scene.narration 为准。服务合成的逐段语音与哈希存于用户项目 `.cache/tts/`，与镜头起点分离；采用的片段、混音与字幕继续存入 `audio/` 并参与生产指纹。失败时保留成功缓存，但不发布不完整音频包。时间提案只写新分镜文件，采用后必须重新校验；review 重新批准。手工字幕按讲稿哈希、文字顺序及实测语音范围核对。

Renderer 为最终有声候选文件生成 profile 与视频指纹记录；QA 和批准检查同一文件，批准后不重渲。代表片段复用正式音频加载器和原时间轴，只做带标记的审片输出。

语义扩展通过 2.3 的可选字段显式启用，能力清单、schema、validator 和 renderer 同步；不重解释旧字段。图像聚焦根据实际图像尺寸计算原图归一化区域，并等待尺寸就绪后渲染。
