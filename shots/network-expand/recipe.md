# network-expand：向外关系展开

复用 FrameLoom 原生 network，并为受控镜头采用主体与分支分区、折线避让。用于原文明确一个主体与 2–5 个对象的关系；该配方为原生实现，不等同于上游多源汇聚。

## 输入与选用

- visual.kind 为 network；anchor 引用一个 node/card，items 引用 2–5 个 node/card。
- anchorId 必须等于 anchor，visual.source 记录关系依据。
- 每个对象恰好一条 anchor → item 连接及唯一 draw beat；inward 关系不兼容。
- 节点标签与正文都应明确关系对象，不能只换图标而没有具体内容。

## 动作阶段

主体先 enter/reveal，落定后对象按 items 顺序入场；draw 在主体落定后开始，并在对应对象入场结束前完成。左侧主体与右侧对象分区，连接避开文字；完成态保留至少 0.8 秒。

## 编排边界

连线表达来源中真实存在的关系，不自动把关联解释为因果。提示顺序不等于时间顺序；需要过程改 sequence，需要多源汇聚改其他已实现配方。超过五个对象拆场，不加密节点后整体缩小。旧版非受控 network 仍走原径向布局。

精确版本为 1.0.0，状态 experimental。数量、文本和时序硬约束见 [manifest.json](manifest.json)，来源与适配记录见 [provenance.json](provenance.json)，已支持组合和验证范围见 [preview.md](preview.md)。返回[配方库](../README.md)。

## 当前画面

冷灰画布、纯白主体与对象卡、细边框和柔和阴影；关系线位于实体卡后方，不透进正文。不沿用大面积米黄纸色。画面与播放复核见[中性视觉复核](../../examples/shot-recipes/neutral-visual-review/README.md)。
