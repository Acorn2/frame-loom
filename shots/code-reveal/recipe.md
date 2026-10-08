# 代码逐行揭示

代码/配置逐行或逐字符揭示。适用于原文包含实际代码或配置示例。

输入要求：原代码不被篡改；选择一种揭示方式，不照搬双屏对照；长代码拆镜。全部图层通过 slots 绑定真实内容，来源写入 visual.source。

同一个代码载体显示行号无关的完整原文；按 lines 或 characters 模式推进。颜色由预先提供的 tokens 决定，输入缩进、换行、字符串全部保留，不执行代码。

关键参数：slots.code 的 text 是原文；tokens 所有 text 拼接必须逐字符等于原文。token.kind 仅 plain/keyword/string/number/comment。实际文字矩形会拒绝过长代码，要求拆镜头。

时间预算：入场 → 显式变化或聚焦 → 完成态独立阅读。动作由 beats 给定，秒数按 FPS 换算；入场 0.2–2.8 秒，变化最多 10 秒，完成态至少 1.2 秒。具体可运行分镜见 [公开示例](../../examples/shot-recipes/code-reveal/storyboard.json)。

参数与限制由 [manifest](manifest.json) 与严格 shot schema 共同定义。适配六套当前风格、16:9；示例为自写示意，不作为真实数据。声音不自动生成，制作时用项目统一旁白，不复制上游音效。不得用无来源卡片、统计、关系或素材填空；不接受未经显示的额外图层和动作。
