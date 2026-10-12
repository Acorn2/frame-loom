# 开放白板逐笔讲解

`whiteboard-board` 只支持 whiteboard 横屏，推荐小赖字体，允许独立选其他受控字体。开放布局取代固定插画卡片：小贴纸、文字、清单、矩形、椭圆与显式箭头按一支笔的顺序逐项完成。

`slots.items` 必须唯一引用所有图层，首项必须是完整的 scene.title；`elements` 必须逐项绑定。贴纸为 object，其余为 node；图层的 label 与可选 text 都实际显示。文字内容仍在 layers，坐标、字号、对齐和媒介在严格 elements 契约内，不执行 scenes.js。

元素坐标以1920×1080设计画布计，x/y/width/height 必填；正文限于 x=56..1864、y=56..915，右上 x>1600、y<150 留给品牌层，不放正文。贴纸完整 contain，caption 在底部直接显示，无底板。text 的 fontSize=28..140，sticker 的 labelSize=28..56；rectangle、ellipse、checkbox 可选 none/blue/yellow/green/red 及 solid/hachure 填充。color 是 ink/muted/accent/negative 角色，不接受任意代码、字体或隐藏字段。

所有元素有唯一 reveal。线条轮廓、填充和内部文字在同一阶段依次完成；文字逐行按实际字体宽度擦出，铅笔沿同一位置移动。贴纸先擦出再写标签。阶段不重叠，保留自然书写时间。关系在 connections 声明，routes 绑定同ID，points 是2..8个画布内点，唯一draw在来源出现后、目标书写前或完成后执行。目标必须在接续讲解中出现，不能用任意箭头制造因果。结尾留至少1.2秒完整阅读。

公开展示使用[原创观察分镜](../../examples/whiteboard-original/storyboard.json)，人物贴纸经过实际 imagegen 生成与登记，文字为 FrameLoom 原创。[上游同内容参考分镜](../../examples/whiteboard-reference/storyboard.json)仅用于方法回归，按 MIT 保留来源，不作为网页主展示；自己的纯文档项目需按[素材流程](../../references/illustrated-production.md)实际生成并登记。
