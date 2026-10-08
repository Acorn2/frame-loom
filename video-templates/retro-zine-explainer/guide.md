# 纸刊式文档讲解

`retro-zine-explainer@1.1.0`，experimental。默认且唯一风格为 `retro-zine@1.0.0`，当前只适配16:9。先读取原文，再选择内容真正适合的镜头；镜头数量不是质量目标。

| 原文结构 | 首选镜头 | 不适配时 |
| --- | --- | --- |
| 短主张、章节路标 | paper-title | 缩短标题、明确1–4个短语，或拆场 |
| 建立主题后展开正文 | title-to-label | 标签过长则改基础语义画面 |
| 一段原文支持三条结论 | document-conclusions | 不足三条时改清单，不编造结论 |
| 2–4个并列要点 | list-reveal | 更多条目拆场，不添加因果箭头 |
| 2–3个文本状态/选项 | compare-reveal | 需要明确名称和差异说明 |
| 一个主体连到2–5个对象 | network-expand | 必须有真实outward关系与来源 |
| 顺序、变化、真实数据、来源图片或收尾 | semantic-default | 在shot-map中解释基础回退原因 |

每场记录原文位置、主张、语义关系、镜头精确版本、理由、素材、提示点和回退原因。槽位只引用现有layer；标题短语须完整组成scene.title。来源先入场与阅读再dock，主题显影后站稳再demote，随后正文入场。2.4不接受旧shotPattern。

只使用清单里的静态实现与有界动作。不按随机数换镜头，不把辅助动效叠成自由组合。来源图片需用户提供并注册manifest；CSS图解明确diagram，不当作真实产品截图。标题与旁白字幕共用项目规范，禁止双标题和字幕底板。

`init:project -- --slug <topic> --video-template retro-zine-explainer` 初始化2.4草稿；完善后输出单独storyboard.json，再用既有preview:shot/produce/qa命令。实测音频时间提案如冲突，应缩短内容、拆场或换配方，不延长无变化背景填时长。音效/配乐默认关闭。音频和全片观看通过之前不要标记release-ready。

[公开资料文档](../../examples/video-templates/knowledge-notes/README.md)与[演示更新文档](../../examples/video-templates/product-update/README.md)提供选用例子。实际证据和限制见[验证记录](preview.md)。高级路径不含videoTemplate时可组合经验证的风格与镜头；不自动宣称未测试组合受模板支持。
