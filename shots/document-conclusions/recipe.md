# document-conclusions：原文驻留与三条结论

用于一段明确原文支持恰好三条结论的证据段落。参考 Shotcraft 的 doc-park-left-pill-deal：保留来源留在左侧与右侧逐条展开的表达关系，以可读摘录与信息行适配 FrameLoom。

## 输入与选用

- visual.kind 为 network，anchorId 指向 source，visual.source 记录原文位置。
- source 为有 label/text 的 node/card；items 恰好三个 node/card。
- 每条 items 都有一条 source → item 连接、唯一入场 beat 和 draw beat。不得补写原文没有的结论。
- 原文不足三条结论时，选择集合内的 list-reveal 等配方；超过三条则拆场。

## 动作阶段

来源 enter/reveal 后至少停留 0.3 秒，再由显式 dock 从中部停靠左侧。首条结论在 dock 完成后入场，其余按 items 顺序跟随；连接在主体入场结束前完成。三条均停留在完成态，原文不会被淡出。

## 适配差异

取消上游来源自动滚动、裁去大半原文、药丸占位事实和自带逐词字幕。摘录、结论与旁白字幕分别承担依据、判断、朗读职责；没有字幕底板。时间不由组件内部固定帧数控制，TTS 重排需保留来源阅读、停靠与最终阅读预算。

精确版本为 1.0.0，状态 experimental。数量、文本和时序硬约束见 [manifest.json](manifest.json)，来源与适配记录见 [provenance.json](provenance.json)，已支持组合和验证范围见 [preview.md](preview.md)。返回[配方库](../README.md)。

## 运动制作方案（本次重做）

原文先居中阅读，再停靠左侧；三条圆端结论逐条发出，来源持续驻留。

## 关键参数与节拍

dock 用 inOutCubic；结论 scale=.94→1 与 y=14→0；三条从原文连接出来。

所有阶段读取显式 beat；参数随画布缩放，持续时间按 fps 和阅读预算校验，不强套上游示例固定时长。动作完成后保持静止；采样、暂停、倒放与随机 seek 不依赖播放历史。

## 声音建议

dock 完成与每次发牌各有可选纸触 cue。 此处仅说明事件点，运行时默认静音，不引入上游音效、私有媒体或自动播放音轨。

## 容易做错的地方

恰好三条；不能让原文变装饰或偷偷自动滚动；统一字幕，不复制上游独立字幕。

## 版本与验证边界

当前版本 1.2.0。场景旧版1.0.0与1.1.0仍按各自renderer解析，新建项目选当前版本。实际公开预览使用本项目renderer、自有文本与六套横屏风格；真实TTS与竖屏须另行验收，不能由静音样片推断。

## 1.2.0 画面与材质

浅灰工作台、白色原文卡与柔和纵深阴影，保留原文驻留。风格保留配色家族，场景独立定义背景与构图；辅助动作继承宿主。深色背景使用白色标题和字幕，白卡上的正文仍为深色。网页和生产共用同一renderer，当前支持六套风格 + 16:9，状态仍experimental。

当前关键帧与正常速度播放记录见[视觉复核](../../examples/shot-recipes/visual-review/README.md)。
