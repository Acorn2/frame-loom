# 视频模板重构实施记录

日期：2026-09-30。首版依据本地设计方案与镜头筛选清单实施，状态为 **experimental**。这里记录实际实现和验收缺口，自动检查不代替正常速度的完整播放。

## 2026-10-04：补齐21份P2候选（当前）

清单覆盖从27/48增至48/48：新增13个场景、5个受控宿主动作、3个跨场换章。运行时共37场景（34上游＋3原生）、9宿主动作、5换章；53份公开样片包含两个既有变体。新增输入和显式阶段进入schema、静态renderer、能力清单、选择集合、生产锁与QA。前后对照检查素材实际尺寸与内容，图表读取真实采样，代码保留字符和缩进，字标需要输入SVG路径。公开示例为自有示意内容，不代表上游或真实产品测量。

新增卡片使用白色、冷灰与石墨材质，网页继续分开显示场景、辅助动作与换章，不显示版本号。检查并修复关系线穿正文、对开换章新页遮住旧页的问题，历史版本保持独立。完整350项测试、typecheck、lint与目录校验通过；53样片实际渲染并完成严格静态构建；素材对照与线条承接通过生产入口渲染和自动QA。关键帧、正常播放及网页交互证据见[P2复核记录](../examples/shot-recipes/p2-visual-review/README.md)。

本轮只验收公开静音示例，未制作用户成片或调用在线TTS。P2仍限定retro-zine、16:9，保持experimental；家族只适配已声明变体，不把候选覆盖率解释为所有上游变体均可用。真实旁白、其他风格、竖屏和创作者最终节奏认可仍未验收。

## 2026-10-02：镜头视觉与材质重做（历史1.2.0）

范围仍为27/48：21场景与4宿主动作使用1.2.0，2个换章保持1.0.0，3原生场景保留。每个配方分别定义背景、材质、字形与空间处理，Style Pack继续提供配色家族；实际生产与网页共用renderer。1.0.0、1.1.0各自视觉代码与清单快照保留，旧项目不自动升级。

18个测试文件、266项通过，含旧版精确解析、文字/字幕对比度和外部字幕跨镜切换。32公开样片完成实际渲染、128帧回读、浏览器1倍速自动播放到结束；另检查深浅背景外部字幕实际帧和网页关键交互、四种宽度。见[视觉实施矩阵](shot-visual-redesign.md)、[当前复核证据](../examples/shot-recipes/visual-review/README.md)。仍experimental，真实旁白、其他风格与竖屏未验收。

## 2026-10-02：已接入27份动效重做（1.1.0历史）

用户限定只重做已接入27份；候选覆盖仍27/48，不接入P2。21场景和4辅助使用1.1.0，保留1.0.0定义和渲染路径；两个转场沿用1.0.0，核对几何并更换可见两章内容的展示样例。原生3场景不改变。移除新版镜头共享的强制网格与底部重复主张，让压印、扇面、词轮、胶片带、曲线汇聚、结构装配和翻面各自控制画面与运动阶段。正常旁白字幕、安全区、精确版本和生产锁仍受原契约约束。

镜头页卡片展示真实静音动效：可见播放、离屏/后台暂停、减少动态效果时暂停；有全屏与详情播放，矩阵线框及卡堆胶带可切换。风格和镜头仍在独立页面，勾选/制作组合跨页面保留。

本轮实际检查：17个测试文件、263项；typecheck、lint、generate:schemas、validate:shots、check:docs、git diff --check通过。32份公开样片实际渲染，128张关键帧已回读；浏览器以1倍速播放32份到结束事件，四种网页宽度和关键交互通过检查。证据见[复核记录](../examples/shot-recipes/motion-review/README.md)；逐配方辨识点见[实施矩阵](shot-motion-redesign.md)。这是公开静音配方样例检查，不制作用户生产视频、不调用在线TTS；真实旁白、其他风格、竖屏与创作者节奏验收仍未完成，状态继续experimental。下文保留此前版本的历史验证记录。

## 清单扩展：全部剩余P1（历史记录）

本轮增加15项：A04/A06/A07/A08/A09/A10/A14/A17、B05/B08、C02/C03/C08/C10/C13。当前实际接入27/48：21个上游场景、4个宿主动作、2个跨场转场，加3个原生场景，共24个可选场景入口。其余21项全部是P2，仍pending；具体变体与范围见[台账](../shots/shortlist-coverage.json)。C03只接MaskingTapeSlap，C10只接BlindsSlice，A17不包含逐字3D变体；不能用镜头族的完整研究范围冒充实际能力。

新增输入契约、静态组件、文字矩形预检和24/30/60fps音频时间提案已接通：标题实测字体基线/最长词；轮换保留每项阅读；证据与词成对同步；结构闭合后填字；真实递增日期等距展示并注明非时间比例；指标保留符号、单位、精度、来源与最终真值。四种C类宿主动作进入独立锁；两个跨场动作在共享时间线处理同步位移/互补裁切，字幕与正文动作避开交接，交接中点和结束进入必选QA，manifest/provenance绑定生产锁。

实际检查：npm test 在项目 tests/ 目录内15个文件、231项通过；typecheck、lint、generate:schemas、validate:shots、check:docs、git diff --check通过。公开样例渲染48张真实Remotion静帧（13组中途/完成/交接、6个细节阶段、卡堆胶带的3帧），回读发现组句回落与后续文字重叠，已改为回落完成后才组句并增加回归。静态证据见[P1关键帧](../examples/shot-recipes/p1-previews/README.md)。有声换章的外部字幕边界在预检和渲染均检查；未制作用户生产视频、未调用在线TTS。正常速度播放、真实旁白和竖屏尚未验收，新增能力仍为experimental，仅retro-zine@1.0.0、16:9。

## 清单扩展：首批12项

本次按筛选清单建议的首批12项继续实现：A01、A02、A03、A05、A11、A12、A13、A15、A16、B01、B16、C01。原来仅4个上游场景；本次增加 blur-slide、split-text-stagger、card-stack、concept-matrix、platform-hinge-rise、source-converge、diagram-cascade 和标题宿主 marker-underline。当前为11个上游场景＋1个宿主动作，加3个原生场景，运行时共14个场景入口。48项的实际入口、优先级、条件与适配变体见[实施台账](../shots/shortlist-coverage.json)，其余36项仍 pending。type-assembly 只接 SplitTextStagger，wall-reveal 接 BentoLightUp／WireframeDrawOn，canvas-materialize 只接 DiagramCascadeBuild。

新增组件全部静态注册，有严格槽位、文字预算、显式阶段、入场／来源阅读／展开／归纳／层级顺序约束与QA检查点。C01作为受控宿主动作注册，不开放效果堆叠；实际使用的动作清单和来源独立绑定生产锁。真实汇聚关系、层级父子关系由输入提供，不使用占位事实或自动编造因果。既有选择集合与音频提案支持这些配方，预设模板维持原组合。

实际验证：全套14个测试文件、190项通过；新增30项覆盖清单计数、具体变体、错误关系、阶段抢读、父子几何、实际文本槽位、seek和24/30/60fps的长短实测时长提案。typecheck、lint、schema导出与validate:shots通过，catalog返回14场景、1辅助、12/48清单覆盖。24张静态关键帧涵盖7个新增场景与矩阵的第二变体，中途、完成、交接帧均已回读；视觉复核发现裂升标题裁掉下划线，修复后重新检查。静态证据见[关键帧记录](../examples/shot-recipes/shortlist-previews/README.md)。本次未制作新的用户生产视频、未调用在线TTS。正常速度播放、真实旁白和竖屏仍待验证，所有新配方保持experimental。

## 主流程修正：独立风格与配方选择（此前增量）

用户明确本任务目标是重构制作逻辑与搭建配方库，上一轮把视频验证当成主要交付，且缺少独立选择入口。本轮补齐 `list:shots`、`init:project --style ... --shots ...` 与顶层 `shotRecipes`，以“视频风格 + 多个配方 → Agent 按原文逐场编排”为主流程；预设模板只作快捷组合。实际入口及上游方法适配说明见[配方库](../shots/README.md)，字段见[独立选择示例](../examples/shot-selection/README.md)。本轮修正未发起视频制作或音频合成。

集合中的每个配方都校验风格、画幅和版本；场景只能使用集合内的镜头，允许重复与部分使用，不能自动添加基础回退。选定但未使用的定义同样进入生产锁。独立初始化只写空场景草稿、制作简报和镜头映射表，未知／重复／不兼容选项在创建目录前停止。已有 2.4 分镜没有新字段时仍保留原行为；旧仅风格 2.3 初始化也保留。

以下视频记录属于上一轮实现的历史验证证据；本轮运行时代码变化已使旧输出的生产锁过期，不能作为当前代码的可恢复生产记录。本轮以组合契约、初始化、兼容检查、锁变化与回归测试验收，不重渲用户视频。

本轮实际检查：typecheck、lint、generate:schemas、validate:shots、独立组合 fixture 校验及 check:docs 通过；全套 13 个测试文件、160 项通过，其中配方测试 43 项。新增回归覆盖无预设组合、重复使用、集合外镜头拒绝、未使用配方兼容检查、重复 ID、能力列表筛选、独立初始化不产出视频及失败前不创建目录。锁测试补充所选但未使用配方的定义变化。

## 阶段与边界

| 阶段 | 已实现／验证 | 尚未完成 |
| --- | --- | --- |
| A 契约与单镜闭环 | Storyboard 2.4、严格槽位、静态 catalog／renderer、文档驻留的显式 dock、单镜事件预览；原 2.3 文档镜头仍可渲染 | 创作者对新旧镜头的完整播放比较 |
| B 首套模板 | 六种镜头及 semantic-default；retro-zine-explainer 精确版本和选用指南；两份独立自有文档、旧版对照分镜、边界截图 | 模板整体观看效果的人工结论 |
| C 时间／锁／QA | 24／30／60 fps 的有界重排；短语音冲突拒绝；按视频独立保存锁和计划；真实豆包录音复用、93.6 秒有声样片、同稿换镜头返工、阶段恢复及失败保留旧输出 | 当前进程没有豆包环境变量，未新发起在线合成；完整发音与音画听审待完成 |
| D 迁移与入口 | 新模板初始化、列表和校验；2.3 显式迁移并输出报告；README／Skill／架构文档；按 guide 选镜头并制作／返工 | 2.1／2.2 自动语义迁移不提供，原路径保留；升级 stable 仍受上述人工验收约束 |
| E 扩展 | 首批12项（11场景＋1宿主动作），48项台账与变体记录 | 其余36候选、其他预设、真实素材对比、跨场复杂转场与竖屏 |

新版不要求每篇文档使用所有镜头。模板推荐由 Agent 根据原文与 guide 判断，初始化脚本不会假装具有内容语义判断能力。首套六种配方只声明 retro-zine + 16:9；其他场景可用基础语义镜头。

## 可复用证据

- [资料笔记](../examples/video-templates/knowledge-notes/README.md)与[演示产品更新](../examples/video-templates/product-update/README.md)：各 52 秒、1920×1080、30 fps，覆盖六种镜头与基础收尾；各有 84 张 QA 代表帧、两页接触表。
- [镜头边界分镜](../examples/shot-recipes/boundaries/storyboard.json)：中文／English／数字、四条清单、较长原文摘录；[五分支网络分镜](../examples/shot-recipes/boundaries/network-five.json)覆盖最大条目数。
- 六种镜头的实际边界完成帧见各自 [preview](../shots/document-conclusions/preview.md)，关键阶段与完整模板画面见[模板预览](../video-templates/retro-zine-explainer/preview.md)。

本地用户材料与声音不进入公开 fixtures。新项目为 `projects/20260930-tongliao-shot-template/`，最终候选为 `output/pilot-audio.mp4`，同稿返工为 `output/pilot-audio-v002-final.mp4`，对应 `storyboard.revision-02.json`。旧来源项目、讲稿、原音频不覆盖；新项目记录逐场录音来源及 hash，按 ffprobe 实测时长重新拼接，旁白起点贴镜头且讲述场景尾空档约 0.15 秒。

有声输出实测约 93.589 秒，含一条音轨、32 条短句字幕。最终原版自动 QA 抽取 162 张代表帧、四页接触表，同稿返工为 160 帧、四页接触表，均通过自动检查。最终四份输出再次核对生产锁、解析计划、receipt 与视频字节全部匹配；原版从 QA 阶段恢复成功，前置阶段及渲染复用。字幕是句级估算，未声明逐词对齐；约四秒独立结尾停留会产生片尾静音提示，完整播放后决定保留或调整。候选始终是 manual-review-pending，不生成虚假的批准文件。

## 检查与发现

`npm run typecheck`、`npm run lint`、`npm test`（13 个文件、156 项）、`npm run test:storyboard`（23 项）、`npm run validate:shots`（7 个镜头、1 套视频模板）、`npm run validate:styles`（7 个 Style Pack）、`npm run check:docs` 及 `git diff --check` 均在此次实施中实际运行并通过。公开边界 fixture 也纳入契约和文本预检回归。

生产锁测试覆盖所选与未选配方变化、渲染代码变化、派生计划篡改、receipt 不匹配、视频字节改变、失败渲染不替换旧输出。真实渲染期间修改代码也触发拒绝发布，随后重新渲染，避免旧画面配新指纹。

边界抽帧发现三分支网络会与中央节点重叠，已仅针对新版 network-expand 改为左侧主体、右侧分支分区，连线终点避开文字；旧版径向布局保持。四项清单调整字号和行内宽度后检查了实际完整分辨率截图。

完整测试曾在四个视频同时编码时有两项 5 秒超时；编码结束后原命令全部通过，新增边界回归后最终 156 项通过，没有放宽超时或关闭测试。

## 复现入口

```bash
npm run list:video-templates
npm run validate:shots
npm run init:project -- --slug my-explainer --video-template retro-zine-explainer
npm run validate:storyboard -- examples/video-templates/knowledge-notes/storyboard.json --mode fast
npm run render:storyboard -- examples/video-templates/knowledge-notes/storyboard.json .tmp/knowledge-notes.mp4 --mode fast
npm run qa:storyboard -- examples/video-templates/knowledge-notes/storyboard.json .tmp/knowledge-notes.mp4 .tmp/knowledge-notes-review --mode fast
npm run migrate:storyboard -- examples/video-templates/knowledge-notes/storyboard.legacy.json .tmp/knowledge-notes-migrated.json
```

输出已有时默认拒绝覆盖；换文件名可保留比较证据。新配方参考方式、精读路径、上游 commit 和许可记录于各自 provenance。仅参考方法并独立实现，不导入上游私有素材或原片；本地 Shotcraft 不成为运行依赖。
