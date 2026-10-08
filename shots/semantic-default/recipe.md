# semantic-default：基础语义配方

FrameLoom 原生语义画面的显式配方入口。用于专用配方尚未覆盖的顺序、变化、真实数据、来源媒体、普通观点或基础收尾。

## 输入与选用

slots 为空对象，内容仍使用 visual、layers、connections 与 beats。可用 visual.kind 为 statement、compare、sequence、network、change、metric、media；遵守各自语义、来源与素材契约。保留全部已安装风格与横竖屏。

## 动作与边界

标题按风格的入场曲线在0.6秒内显现；已有跨场入场时由转场负责标题交接。图形节点与连线由显式beats驱动；结论在图解动作完成后入场，并在交接前保留阅读时间。标题、结论中间态与最终完成态纳入生产QA采样。

遵守 manifest 的有界动作、最终阅读与现有 renderer 能力；不允许从名称推导任意新动画。2.4 明确启用本配方，不能把旧 shotPattern 悄悄塞进来。作为选定集合的一员时可以重复用于不同语义场景；用户未选择它时不得自动添加为回退。

不是所有文档都适合专用六镜头，不要为增加镜头种类把真实过程或数据改写成清单。需要素材时保留来源与 manifest；需要未实现的新表达时先报告能力缺口。

精确版本为 1.0.0，状态 experimental。数量、文本和时序硬约束见 [manifest.json](manifest.json)，来源与适配记录见 [provenance.json](provenance.json)，已支持组合和验证范围见 [preview.md](preview.md)。返回[配方库](../README.md)。

## 当前画面

白色或冷灰画布，顺序节点使用圆角方形图标与细连线；Signal使用石墨底色与浅色场景文字。不沿用大面积米黄纸色。画面与播放复核见[中性视觉复核](../../examples/shot-recipes/neutral-visual-review/README.md)。
