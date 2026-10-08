# 镜头配方库

FrameLoom 的制作选择分为两层：**视频风格决定外观，镜头配方决定信息怎样出现、变化与停留**。用户可以选一套风格和多个配方，Agent 按原文决定每场使用哪个、是否重复及顺序。`video-templates/` 是预设组合的快捷入口，不是使用配方库的前提。

```text
请读取 <文档路径>，先编排讲稿和分镜。
视频风格：retro-zine
可用镜头配方：paper-title、document-conclusions、list-reveal、compare-reveal
只从这些配方中选择；内容不适合时说明缺口，再调整集合。
```

```bash
npm run list:shots -- --style retro-zine --canvas landscape
npm run init:project -- --slug my-topic --style retro-zine --shots paper-title,document-conclusions,list-reveal,compare-reveal
```

初始化生成带 `style` 和 `shotRecipes` 的 2.4 草稿、制作简报和镜头映射表，不生成视频、不预编造场景。Agent 读取原文后填写场景；最终分镜仍由现有 `produce` 流程校验、音频适配、渲染和 QA。未知配方、重复 ID、风格或画幅不兼容会在创建目录前报错。

## 当前配方

| 配方 | 表达任务 | 输入边界 | 方法来源 |
| --- | --- | --- | --- |
| [paper-title](paper-title/recipe.md) | 一句主张或章节路标按短语显影，强调一个关键词 | 1–4 个标题短语；可选单重点 | Shotcraft paper-title-card |
| [title-to-label](title-to-label/recipe.md) | 主题先建立，再连续缩为章节标签，正文随后出现 | 短标题与 2–4 个正文块 | Shotcraft title-demote-to-label |
| [document-conclusions](document-conclusions/recipe.md) | 来源原文驻留，三条结论逐一展开 | 一段原文、恰好三条有依据结论及连接 | Shotcraft doc-park-left-pill-deal |
| [list-reveal](list-reveal/recipe.md) | 并列要点逐项呈现 | 2–4 个条目，不添加因果连线 | Shotcraft list-reveal |
| [blur-slide](blur-slide/recipe.md) | 标题与副标题柔和入场 | 明确的中文标题短语＋独立副标题 | A01 blur-slide |
| [split-text-stagger](split-text-stagger/recipe.md) | 标题短语遮罩裂升 | 标题≤18字；先接 SplitTextStagger 变体 | A05 type-assembly-moves |
| [card-stack](card-stack/recipe.md) | 卡堆整体展开为可读个体 | 2–4张真实内容卡；唯一 focus 展开阶段 | A13 card-stack |
| [concept-matrix](concept-matrix/recipe.md) | 低密度概念矩阵建立 | 2–4项；BentoLightUp／WireframeDrawOn 两个变体 | A15 wall-reveal-moves |
| [platform-hinge-rise](platform-hinge-rise/recipe.md) | 两组证据翻起后给出归纳 | 恰好两组证据＋有原文依据的结论 | A16 platform-hinge-rise |
| [source-converge](source-converge/recipe.md) | 多个来源汇聚到一个结果 | 2–4来源＋结果；inward 关系、来源阅读窗口 | B01 bezier-source-converge-merge |
| [diagram-cascade](diagram-cascade/recipe.md) | 原文层级逐层建立 | 根＋2–4子节点，最多三层、唯一父连接 | B16 canvas-materialize-moves |
| [lead-word-assemble](lead-word-assemble/recipe.md) | 关键词先行，再组成主张 | phrases: 2–4 label IDs | A04 lead-word-zoom-assemble |
| [brace-expand](brace-expand/recipe.md) | 括号拉开主题 | title: label ID | A06 brace-expand |
| [pill-slot-cycle](pill-slot-cycle/recipe.md) | 同一句干下轮换要点 | prefix: label ID; items: 2–4 label IDs; suffix: optional label ID | A07 pill-slot-cycle |
| [word-roll](word-roll/recipe.md) | 固定句干下轮换对象 | prefix: label ID; items: 2–4 label IDs; suffix: optional label ID | A08 vertical-word-roll-blur-cycle |
| [text-column-converge](text-column-converge/recipe.md) | 多个短词收束成一句 | prefix: label ID; items: 2–4 label IDs; result: label ID | A09 text-column-converge |
| [evidence-relay](evidence-relay/recipe.md) | 证据摘录与关键词同步更换 | items: 2–4 node/card IDs; keywords: equal number of label IDs | A10 word-relay-filmstrip |
| [row-embed](row-embed/recipe.md) | 内容行落入结构 | items: 2–4 node/card IDs | A14 row-embed |
| [structure-then-text](structure-then-text/recipe.md) | 先建立结构，再填入内容 | items: 2–4 node/card IDs | A17 assemble-then-type-flyin |
| [timeline-travel](timeline-travel/recipe.md) | 沿真实时间线逐项行进 | items: 2–4 node/card IDs; spacing="ordinal" | B05 timeline-travel |
| [odometer-roll](odometer-roll/recipe.md) | 真实指标逐位落定 | metric: metric layer ID | B08 odometer-digit-roll |
| [compare-reveal](compare-reveal/recipe.md) | 展示两个或三个有依据选项的差异 | 2–3 个明确命名的对照项 | FrameLoom 原生语义组件 |
| [network-expand](network-expand/recipe.md) | 一个主体向外展开真实关系 | 1 个主体、2–5 个对象及向外连接 | FrameLoom 原生语义组件 |
| [semantic-default](semantic-default/recipe.md) | 顺序、变化、数据、来源图片或基础收尾 | 遵守既有语义契约 | FrameLoom 原生语义组件 |

36 个专用场景镜头支持六套当前风格与 16:9；`semantic-default` 保留全部已安装风格及横竖屏。`list:shots` 根据实际 manifest 筛选能力，不把参数读自 Style Pack 当作已经完成所有风格适配。所有配方目前为 experimental。

## 编排契约

`storyboard.shotRecipes` 保存用户选定的精确版本集合；`scenes[].shot` 保存每场实际配方及内容槽位。集合不规定顺序，也不强制全部使用。槽位引用本场 layer ID，内容只存一份。未选 `semantic-default` 时不自动补基础回退，Agent 应说明哪条原文无法被现有集合表达。

每个配方都有 manifest、选用说明和 provenance；程序只执行静态注册的组件。新增配方先核对上游说明、TSX、依赖与许可证，再定义输入、阶段、文本和时间边界，并同步 schema／catalog／renderer／能力清单和校验。不能只增加 Markdown 就宣称已具备运行能力。

来源记录固定上游 commit 与原文件路径，34 个上游场景配方、9 个宿主动作与5个跨场转场是方法参考与独立实现；不依赖安装另一仓库，不导入上游占位事实、字幕系统或外部媒体。详细契约见[Storyboard 2.4](../references/storyboard-schema.md#storyboard-24-controlled-shots)。

不含预设模板的完整字段例子见[独立组合示例](../examples/shot-selection/README.md)。

## 清单实施数量与宿主动作

按 2026-09-30 筛选清单计数，当前接入 **48/48**，加3个原生场景共37个场景入口。9个宿主动作和5个换章配方分别查询，不计入正文镜头。家族只适配台账声明的变体，例如 chart-live 使用 OscilloscopeStreamV2、scroll-brake 使用 ChangelogScrollBrake、page-turn 使用 BarnDoorSplit，不宣称全部变体可用。

```bash
npm run list:shots -- --style retro-zine --canvas landscape
npm run list:shots -- --auxiliary
npm run list:shots -- --transitions
```

P2 输入与阶段详见各配方说明和 [施工清单](../references/p2-recipe-implementation.md)。宿主动作通过 `shot.effects: [{id, target}]` 显式启用，不在 `--shots` 中独立选择。C04/C05 绑定 document-write 的 blocks；C06 绑定 ring-annotation 的 subject 轮廓；C07 绑定 scroll-brake 的 focusId；C14 绑定 member-grid 未标记重点项（4–7个成员）。每个效果使用唯一目标 highlight beat；效果前后留清晰阅读窗口。

C09/C11/C12 分别对应 `overlap-line-carry` / `overlap-ink` / `overlap-barn-door`，时长0.6–2.4秒，`chapterBoundary: true`。C09 每片最多一次，仅承接两个 code-reveal 场景相同配置标题线；两场 code 图层声明相同 `semanticRole: "carry:<key>"`，transitionIn 声明该 `carryKey`。交接不覆盖字幕，正文 beats 在交接完成后开始。

| 新场景 | 用途 | 关键输入 |
|---|---|---|
| [research-stack](research-stack/recipe.md) | 资料集合依次进入焦点 | 真实文献、来源文章或记录集合 |
| [list-stack-press](list-stack-press/recipe.md) | 新增条目持续积累 | 原文有累积事件、持续新增条目或资产 |
| [integration-hub](integration-hub/recipe.md) | 旧结构变为统一中枢 | 原文有前后结构变化和实际接入关系 |
| [scroll-brake](scroll-brake/recipe.md) | 从长列表定位关键条目 | 有真实日志、条目清单与重点项 |
| [chart-live](chart-live/recipe.md) | 数据按顺序揭示与重组 | 真实序列、分组统计或量级变化 |
| [particle-sand-fill](particle-sand-fill/recipe.md) | 数量汇积成柱 | 有真实量级对比或积累统计 |
| [member-grid](member-grid/recipe.md) | 集合中突出特定成员 | 真实群体、类别、状态或异常比例 |
| [ring-annotation](ring-annotation/recipe.md) | 主体转为机制图，旁侧解释 | 有真实分层、环形结构或结构关系 |
| [cycle-mechanism](cycle-mechanism/recipe.md) | 对象转入循环机制 | 原文有明确循环/反馈机制 |
| [media-before-after](media-before-after/recipe.md) | 真实前后素材擦动对照 | 两张可比较的真实图片或截图 |
| [document-write](document-write/recipe.md) | 文档段落逐步书写显现 | 有完整且需要展示版式的原文摘录 |
| [code-reveal](code-reveal/recipe.md) | 代码/配置逐行或逐字符揭示 | 原文包含实际代码或配置示例 |
| [letterspace-materialize](letterspace-materialize/recipe.md) | 有来源字标连续描画 | 文档需要真实品牌/组织字标或短章名 |
