# 文案优先：批注推演与编辑式排印

[文档导航](README.md) · [固定制作流程](primary-style-production.md)

当前主风格为手绘白板、批注推演 `annotated-reasoning`、编辑式排印 `editorial-typography`。新两套均为已注册的横屏风格与严格镜头，首轮不支持竖屏。全片字体、来源配色、字幕、音频、品牌和生产审核继续使用既有入口。

纯文档初始化启用实际 imagegen 主体策略，按原文生成少量辅助人物或物件、检查透明 PNG 后登记。插画总框面积上限为画布8%，用于限制这两套的辅助素材；它不代表每场必须放满8%。有来源的图像也可走 `document-images`，不得冒充重新生成。真实截图需要完整可读的证据场，选用固定流程中的 `semantic-default`；不要把整个界面缩成角落贴纸。

## 固定制作入口

```bash
npm run init:project -- --slug my-topic --style annotated-reasoning
npm run init:project -- --slug my-topic --style editorial-typography
```

默认字体分别为思源宋体、思源黑体，可独立替换。初始化自动选定 `annotated-manuscript + semantic-default` 或 `editorial-flow + semantic-default`，不要求用户选择镜头。Agent 根据实际内容编排，不强制用完所有配方，也不把示例讲稿填成默认内容。

## 共用文字与素材契约

每场是2.4分镜。`shot.slots.items`唯一覆盖所有图层，第一个文字图层的完整 `label` 是 `scene.title`；文字用 `node`，小插画用 `object + asset + fit: contain`。所有图层有唯一 `reveal`。`elements`显式给出文字或插画框的 x/y/width/height、fontSize、weight、align、color、opacity；坐标基于1920×1080，宽高随横屏尺寸等比缩放。

内容坐标 x≥110、y≥96，右边≤1810、底边≤895；右上品牌预留区禁止内容。字体大小28–112，字重仅 regular/medium/semibold；color只使用 ink/muted/accent/accentAlt，始终服从项目配色。标签或正文过长时缩短、显式换行或拆镜头，不隐藏裁切，也不放入字号不可读的长段落。每个镜头最多36个文字／插画节点、60秒；镜头完毕至少保留配方要求的阅读时间。

图片计划、图层文案、文字位置、阶段、beat及连接都属于可编辑分镜。renderer没有任何示例标题、旁白、固定26秒时长或私有素材路径。未知字段、越界、不匹配的引用及未实现动作均拒绝。

## 批注推演

`annotated-manuscript@1.2.0` 使用同一张讲义，正文落定后逐步累积圈词、旁注与连线。

- `annotations`以正文图层ID为键，声明原文中唯一出现的 `phrase`、underline/circle及accent/accentAlt颜色。对应正文必须有唯一 `highlight`，不能早于文字reveal完成。
- 旁注是独立文字图层。正文到旁注的语义关系写入 `connections`，每条有唯一draw；两端reveal完成后才描线。
- `routes`以连接ID为键，记录2–8个控制点与arrow。3个点绘制一条二次曲线，其余按折线绘制。路径只表达已有关系，不能为装饰新增因果。

同一行想强调两段时，把句子分成相邻的文字节点，每段的phrase仍绑定自身正文。批注只增加，不让所有文字持续跳动。正式示例：[完整26秒分镜](../examples/text-led-video/annotated-reasoning/study-storyboard.json)。

## 编辑式排印

`editorial-flow@1.2.0` 保留已有文字对象，在有限阶段之间改变位置、字号、颜色与可见度。

- `stages`按顺序声明1–6个阶段，`trigger`指向本场唯一focus beat的ID；focus的target必须是本阶段完成后可见的内容节点。阶段窗口不重叠，焦点图层先reveal。
- 每个阶段的 `placements`完整覆盖全部槽位，字段与文字位置相同，禁止从上场或模板猜测隐藏位置。所有阶段都执行文字宽高预检。
- 文字用平滑插值迁移。离开的节点在窗口前段淡出，进入的节点在位置接近完成后淡入，防止半透明词组交叉抢读。已有始终可见的节点保持连续移动。
- `routes`以连接ID为键，绑定0（初始）或1–6的阶段；可以启用arrow或track。连接必须在相应阶段完成、两端可见后draw，并在下一阶段之前完成。旧阶段连线在切换前段淡出，跟踪点只在实际路径绘制时前进。

阶段用于真实的阅读焦点变化，不是固定四页PPT。没有归组、对照或关系变化时使用简单文字镜头；不要为了填满阶段添加原文没有的证据、数字或结论。正式示例：[完整26秒分镜](../examples/text-led-video/editorial-typography/study-storyboard.json)。

## 校验、渲染与兼容

```bash
npm run validate:storyboard -- examples/text-led-video/annotated-reasoning/study-storyboard.json --mode fast
npm run validate:assets -- examples/text-led-video/annotated-reasoning/study-storyboard.json
npm run render:storyboard -- examples/text-led-video/annotated-reasoning/study-storyboard.json /tmp/annotated-study.mp4 --mode fast
```

文字与阶段几何共享于renderer和预检。正式候选仍需要布局实测、事件覆盖、素材来源核验及输出QA；自动QA不代替播放与视觉复核。TTS／外部旁白继续通过音频清单接入，阶段focus与圈注highlight属于普通beat，需要随旁白安排，不支持凭空猜测供应商实测时间。

旧 `flat-explainer`、`paper-collage` 从新风格库入口移至历史兼容；原风格包、生成规范、原镜头、ID和版本保留，已有分镜不自动转成新风格。更换到新风格必须重新编排、校验并渲染，不能给旧素材登记成依据新指南生成。
