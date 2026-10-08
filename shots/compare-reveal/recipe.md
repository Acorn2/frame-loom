# compare-reveal：文本对照

复用 FrameLoom 原生 compare 构图，用于 2–3 个可据原文比较的选项、状态或方案。该配方为原生实现，不将其宣称为 Shotcraft 搬运。

## 输入与选用

- visual.kind 为 compare；items 引用 2–3 个有 label/text 的 node/card。
- 文案要明确名称与差异，按同一比较维度组织，不凭外观捏造优劣。
- 文本对照不代替真实截图前后对比；图解须标为 diagram，实测数值另走 metric。

## 动作阶段

各项唯一 enter/reveal，按槽位顺序呈现。已出现项保持可读，新入场或 focus 的项取得视觉强调。提示间隔至少 0.6 秒；最终比较态保留至少 0.8 秒。不新增组件自带字幕或隐藏标题动画。

## 编排边界

只可使用原生实现支持的显式 beats；超过三项拆场。文字、颜色、圆形图标和背景由 Style Pack 与项目内容决定，配方负责比较结构。不存在真实差异时改用并列清单，不为满足配方生成事实。

精确版本为 1.0.0，状态 experimental。数量、文本和时序硬约束见 [manifest.json](manifest.json)，来源与适配记录见 [provenance.json](provenance.json)，已支持组合和验证范围见 [preview.md](preview.md)。返回[配方库](../README.md)。

## 当前画面

冷灰画布、纯白对照卡、圆角方形图标和轻阴影，焦点用强调色图标标记。不沿用大面积米黄纸色。画面与播放复核见[中性视觉复核](../../examples/shot-recipes/neutral-visual-review/README.md)。
