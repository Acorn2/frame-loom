# 操作筛选与详情

## 意图与选用

输入搜索词，候选条目收敛到唯一结果，点击后展示详情。用于讲解搜索、检索或选取过程；输入必须描述有来源的操作。这里绘制的是示意界面，不能作为真实产品操作录屏。

## 输入边界

`slots.query` 引用一个 label，2–4 个 `slots.items` 引用带标题和正文的 card，`selectedId` 指向唯一匹配项，`slots.detail` 引用结果详情 card。搜索词必须在唯一候选项的标题或正文中出现。每个图层只能引用一次，不接受额外连线、素材或坐标。

## 动作顺序与时间

候选项同步 enter/reveal → 至少0.6秒阅读 → query enter/reveal 逐字输入（每字符至少0.1秒）→ 至少0.6秒阅读 → selectedId focus 筛选并归位 → 至少0.6秒阅读 → selectedId highlight 点击确认 → detail enter/reveal → 至少1.2秒完整详情阅读。所有阶段由 beats 显式给定；完成态不继续漂移。

## 横屏与竖屏

16:9 使用双列候选网格，9:16 使用单列列表；匹配项分别移入各自布局的首槽。详情使用完整内容区，底部始终保留字幕安全区。六套当前风格及独立全片字体均支持，字体加载后运行文本预检。当前素材配色只支持横屏。

## 声音与易错点

声音不自动生成；使用项目旁白，不复制上游键盘音效。打完立刻筛选、目标悬浮而不归位、先出现详情再点击都会破坏操作因果。超出文本槽位应缩短或拆镜头，不能靠缩小到不可读字号解决。

运行输入见[横屏示例](../../examples/shot-recipes/type-and-filter/storyboard.json)与[竖屏示例](../../examples/shot-recipes/type-and-filter/portrait.json)。方法来源、固定上游版本及许可证见[来源记录](provenance.json)。当前状态 experimental。
