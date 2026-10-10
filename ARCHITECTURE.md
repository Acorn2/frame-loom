# Architecture

FrameLoom 把语义决策与确定性渲染分开。Agent 读取来源、拆分主张、选择画面工作并写入 JSON；CLI 不从文档自动推断事实或关系。

## 根据文档选镜头

浏览器保存公开的auto/manual选择方式；新访客默认auto，旧手动集合保持manual。网页生成指令，不接收文档。Agent读取原文、查询兼容配方、记录逐场来源与画面任务，再通过现有--shots初始化2.4。手动选择仍是严格白名单；推荐不新增fast确认。

`scripts/lib/content-quality.mjs`提供确定性警告，共享preflight由validate:storyboard、produce和QA调用。检测长片中的同配方同语义高重复及只有标题的长停留，不强制多样性、不改变renderer、schema或交付门槛。语义覆盖与合理取舍由Agent依据[镜头编排流程](references/shot-planning.md)复查。

## 字体流

`fonts/font-index.json` 保存字体 ID、固定版本、文件来源、SHA-256、原始许可及风格推荐。公开字体文件位于 `public/fonts/`。浏览库读取相同清单，保存单选字体及跟随推荐／手动模式；静态构建只复制清单声明的字体、许可与公开组合样片。选择进入 Agent 指令和 `init:project --font`，最终分镜写入可选 `font: {id, version}`。

渲染校验文件与版本，统一解析字体后覆盖 display/body tokens；原生 FontFace API 注册文件，Remotion delayRender 在加载完成前阻止出帧与镜头字体测量。生成的标题、正文、标签、数字及字幕共享字体家族。没有 `font` 的历史分镜保留原字体栈。字体文件、许可和清单进入审核／输入指纹；2.4 生产锁记录字体与文件指纹。

`preview:fonts` 用公开文字示例渲染 30 个横屏组合，缓存于 `library/font-previews/`。原风格／镜头样片继续使用原始字体且明确标注；组合样片缺失或过期时显示状态，不替换成另一种字体的样片。字体选择与镜头集合、音频及交付目的独立。

## 数据流

本地配方库读取 Style Pack index、场景/辅助动作/换章 catalog 和公开配方说明，构建 `dist/library/` 下的 `index.html`（风格）、`shots.html`（镜头）和 `selection.html`（导出）三个静态入口。共享 ES module 按所在页面初始化；浏览器本地存储保存公开选择并跨页恢复，禁用存储时使用 URL 参数携带选择，不传文档路径。浏览器保存风格、镜头、成品/配音/确认选项并导出 Agent 制作指令，随后沿现有原文→分镜→生产流程执行；没有生产 API。静态文件服务仅监听本机，公开文件与用户生产目录隔离。公开预览脚本复用实际 renderer，产物与输入指纹存于可重建的 `library/previews/`，输入变化后不展示旧动画。

GitHub Pages 使用独立 Library Pages 工作流生成和缓存公开样片，严格构建只上传 `dist/library/`，不上传用户项目或仓库其他目录。相对资源路径支持项目站点子路径；浏览器行为与本地页面相同。PR 仅验证构建，`main` 的发布任务使用单独的 Pages/OIDC 权限与 `github-pages` 环境，远端未启用前不会成为已发布站点。

`project-input.json` 确定纯文档或文档加图片；原文、`shot-map.md` 和可选的 `asset-manifest.json` 提供可追溯输入。`storyboard.draft.json` 经生产流程转为可渲染的 `storyboard.json`。`src/schemas/storyboard.ts` 定义 2.3 结构，`src/validation/` 校验语义关系、时长、Style Pack 能力与素材路径。`src/renderer/render-scene.tsx` 根据 `scene.visual` 选择语义渲染器；没有 `visual` 的历史分镜继续走旧模板。Style Pack 只提供外观和动效参数，不决定文案中的关系。

`scripts/produce.mjs` 串联校验、音频选择、渲染和 QA；`scripts/preview-semantic-visuals.mjs` 用同一公开分镜渲染各 Style Pack 的完成态，供回归审阅。渲染后的 MP4、抽帧和报告保存在项目输出目录。

正式 MP4 先写入输出目录内的隔离临时目录，完成媒体检查并生成对应指纹记录后再替换目标文件。失败的渲染不会发布残缺视频；显式覆盖时保留旧视频和记录，发布失败可回退。下次运行会识别已结束进程留下的临时目录，恢复被中断替换的旧文件；遇到无法判定的外部改动则停止，保留回退文件供人工核对。QA 抽帧和分页也先在临时目录生成，再写入审片目录，索引最后发布。

`src/timeline/overlap-handoff.ts` 统一旧模板、镜头职责模板与语义模板的重叠透明度；`attention.ts` 和 `motion-progress.ts` 根据分镜 beat 与 Style Pack 参数控制主体入场及注意力。音频轨在 composition 中按项目时长淡入淡出，QA 对成片尾部采样并记录静音警告。这些规则不选择素材或虚构画面内容。

## 边界

- 示意图必须以 `diagram` 表示；真实媒体必须有本地素材和 manifest 来源。
- 数字来自文档或用户素材，`visual.source` 记录位置；代码只校验存在，不替创作者核实内容。
- 静音预览按屏显信息估算初始时长；实际旁白以测得的音频时间为准。
- 自动抽帧检查覆盖动作中途、完成态和切镜前；正常速度全片播放仍由人审阅。
- 2.3 长片的逐镜完成态和交接前帧为必选审片证据；接触表每页最多 48 帧，索引记录页与帧号、时间范围。QA 检查每场覆盖和分页数量。

## 语音资产、派生时间与交付

原稿仍以 scene.narration 为准。服务合成的逐段语音与哈希存于用户项目 `.cache/tts/`，与镜头起点分离；采用的片段、混音与字幕继续存入 `audio/` 并参与生产指纹。失败时保留成功缓存，但不发布不完整音频包。时间提案只写新分镜文件，采用后必须重新校验；review 重新批准。手工字幕按讲稿哈希、文字顺序及实测语音范围核对。

TTS 配置按 provider 区分格式、范围与声音控制；旧中性占位值兼容，非默认的不支持项报错。配置发现逐项输出安全状态，选择只考虑可用配置，真实配置不可用不退回测试音调。ElevenLabs 可选邻场文本进入实际请求和缓存键；环境音色、豆包 Resource ID 与环境 endpoint 绑定复用指纹。`outputSampleRate` 只影响最终单声道混音，独立于源语音缓存。`preview:tts` 显式请求短句、输出独立试听文件，不发布生产音频清单。

Renderer 为最终有声候选文件生成 profile 与视频指纹记录；QA 和批准检查同一文件，批准后不重渲。代表片段复用正式音频加载器和原时间轴，只做带标记的审片输出。

语义扩展通过 2.3 的可选字段显式启用，能力清单、schema、validator 和 renderer 同步；不重解释旧字段。图像聚焦根据实际图像尺寸计算原图归一化区域，并等待尺寸就绪后渲染。

`visual.shotPattern` 在不改变 `visual.kind` 语义关系的前提下选择已声明的镜头构图。首个 `document-conclusion-deal` 仅用于有一段来源原文和三条向外连接结论的 `network`：校验来源和连接后，renderer 用项目文本与 Style Pack 绘制原文驻留和逐条入场；音频、字幕及整片时间轴仍由现有管线负责。


## 2.4 视频模板与镜头配方

主入口是独立的 `style + shotRecipes`：`list:shots` 根据 manifest 查询兼容配方，`init:project --style ... --shots ...` 只初始化制作简报和空场景草稿。Agent 再根据原文填逐场 `shot`、槽位与 beats，selection 校验确保不越出用户集合。预设模板是可选快捷入口；集合只限制可用能力，不强制配方数量、使用顺序或全部出现。所选但未使用的配方定义也进入生产锁，修改后需重新校验。

`styles/` 继续定义视觉外观；`shots/` 保存配方清单、中文说明和上游来源；`video-templates/` 定义精确风格/镜头集合和选用规则。`src/shots/catalog.ts` 读取受约束清单，`renderer-registry.tsx` 静态绑定组件，没有动态TSX加载。`compile-shot.ts` 把slots、beats、有效画幅和风格解析为阶段计划；动画是纯帧函数，来源停靠和标题降格没有组件内隐藏时间轴。只有配方选择由Agent判断，程序不会自行添加事实或关系。

2.4每场显式shot，由shot-validator与现有语义校验共同预检。标题、文档结论及清单使用新组件；对照、网络与基础回退复用原语义组件。新路径的壳层标题/结论直接驻留，主体动作遵循显式beats。2.1–2.3保留旧入口和旧试点固定动作，迁移工具只输出2.3到2.4的新文件与报告。

音频时间提案保留配方窗口并重排阶段，完成后重新编译检查。渲染绑定selected manifest、provenance、style、runtime与resolved-plan哈希；record/QA/run/批准共同检查生产锁和视频字节。派生计划与锁存于每个输出自己的 `.production/` 目录，并在receipt中保留快照。先检查渲染期间输入未变化再发布，不因失败覆盖旧输出证据；多个输出互不覆盖生产锁。

`validate:shots` 核对catalog、index、严格schema、静态renderer与capability集合；`list:video-templates` 返回实际精确选择。安装后的生产依赖不包含上游Shotcraft仓库，已接入的34个上游场景配方、9个宿主动作与5个换章配方仅参考方法独立实现，原生配方明确署名FrameLoom。来源说明不等于外部媒体授权。

清单扩展以 `shots/shortlist-coverage.json` 跟踪全部48项。新增场景仍通过同一静态schema/catalog/renderer/selection链，`concept-matrix.variant` 只允许已实现的两个变体。C01通过单独 auxiliary catalog 声明受控宿主与 highlight 阶段，不增加场景信息结构；实际使用的宿主动作 manifest/provenance 进入生产锁。新关系布局按真实连接计算，拒绝循环、多父、孤立、过深层级和无来源汇聚；文本预检按实际槽位尺寸检查。


P1扩展采用独立槽位与阶段约束：字体加载后实测标题基线与最长词，证据/关键词同步替换，结构 trace 完成才填文字，日期与指标精度由输入保存。`auxiliary-catalog` 控制四种宿主动作；`chapter-transitions` 控制两种换章，composition 只渲染一份场景DOM并在共享重叠帧应用互补条形裁切或整页同步位移。章节正文避开交接，旁白字幕不能穿过换章；production lock 分别绑定 scenes/auxiliaries/transitions 的定义与来源。2.1–2.3拒绝trace/tape及新转场，旧路径保留。

镜头版本隔离：当前视觉组件位于`src/shots/`，历史1.0.0与1.1.0视觉组件分别封存在`src/shots/legacy-v1/`、`src/shots/legacy-v11/`，历史清单位于各配方的`history/`。renderer按shot精确版本选择，production-lock按同一版本读取清单；旧分镜不自动改版。新ShotShell只负责安全区、标题区、字幕与交接，构图和运动由配方组件负责。公开样片包含51个库入口及2个已注册变体；可见卡片按需加载、离屏暂停，选择状态仍在三个独立页面共享。

当前镜头视觉职责：`appearance.ts` 从现有StyleTokens推导每个配方的深浅背景、场景文字、卡片文字、阴影和静态装饰；不增加风格ID或用户输入参数。无项目配色时画布以白色、冷灰、石墨色为主体，Style Pack提供强调色与原始字体；显式素材配色覆盖背景、文字、表面和强调色，保留来源暖色或有色背景。显式全片字体覆盖原始字体；卡片前景与场景前景分开，暗场中的白卡仍使用深色正文。`RenderShot` 按精确版本派发并注入外观，34个当前上游场景配方及3个原生场景应用中性底色；历史上游版本不应用新外观。`DataDrivenVideo` 按共享时间线的当前场景选取外部字幕captionInk，seek或换镜后立即跟随深浅背景；字幕无底板。网页通过实际renderer生成的公开样片展示同一行为。

制作向导数据流：构建从examples/tts-profiles读取四份公开样例，只选择id/name/provider/model/voice/voiceFromLocalConfig字段进入catalog.ttsPresets；不读取用户音频配置或环境值。选择页使用normalizeProduction约束公开选项，目标映射为visual-master或in-project-video，旁白映射silent/tts/external，确认开关映射review/fast。生产选项与镜头在同一浏览器记录跨页恢复，存储禁用时以公开URL参数携带。指令由Agent结合随后提供的文档与音频执行；配置不匹配时说明缺口，不隐式更换服务。预览指纹依旧只绑定视频渲染源，向导和公开TTS目录不改变样片画面。

P2 场景使用独立严格 schema 与纯帧组件；宿主效果显式绑定槽位与 highlight 阶段。数据、素材、代码、字形为必需输入，不由 renderer 发明。换章沿共享时间线处理，辅助动作与转场分别进入 production lock。

P2 对开换章使用互补中央裁切与旧页左右半页位移，防止新页全屏提前遮挡旧页。前后素材在资产预检中核对真实像素/画布尺寸与文件内容；网页预览也绑定对应素材字节。

六套风格的语义布局集中于 `src/templates/semantic/style-language.ts`、`StyleStatement.tsx` 和 `StyleSequence.tsx`，由既有 `SemanticScene` 与2.4原生配方调用。标题槽位及字体适配由renderer和文本预检共享；流程只绘制输入声明的连接。原生配方保留完整StyleTokens，专用配方继续应用自己的中性外观；风格ID、能力清单和精确镜头解析不扩展。

## 横屏风格与镜头自由组合

当前配方 manifest 声明六套风格的横屏组合；动作、槽位与时长归配方，强调色归风格，全片字体独立选择。历史 manifest 保持原兼容边界。公开预览按配方 × 风格索引，卡片、详情与变体读取当前选择对应的实际 renderer 产物并标明原始字体；缺失或失效样片显示占位，不能借用其他风格样片。

## 项目配色流

选择页将 colorMode（auto/style/source）随公开制作选项保存和导出；init:project 写入 project-input.json 和 source-roles-v1 配色策略。Agent 判断素材代表主体品牌还是引用证据，网址先采集为本地图片。asset-manifest 的可选 usage 将 scene-media、palette-reference、both 区分；document 允许仅取色参考，不允许媒体层，document-images 仍要求可见媒体。

Agent 选择语义区域，sample:palette 用本地 FFmpeg 采样，不采用颜色。最终 storyboard.palette 是唯一生产输入：assets 引用 manifest ID，custom 记录用户指定色值。新项目 palette 1.1 明确八个角色，素材配色 evidence 记录直接区域采样或有理由的角色推导；背景、正文、强调色必须直接采样，校验拒绝缺项、采样不符和循环推导。共享 project-palette 解析器使用来源文字、背景和表面，只为对比度调整派生值；旧 palette 1.0 不迁移。style-loader、composition、镜头外观及字幕使用同一解析结果，字体、动作和真实图像不改变。仅显式启用的当前横屏配方应用新颜色，缺字段保留原路径。

production lock 存采用色、角色证据、固定区域采样、派生色及参考素材 SHA-256；QA 输出各角色和可读性调整，截图视觉匹配仍需人工复核；渲染开始与结束重新核对，QA 与批准传入相同项目路径校验实际字节。生产指纹与分镜批准也覆盖原素材。参考图不进入公开站点，公开样片继续展示默认风格。详见 [契约与执行流程](references/project-palette.md)。

## 横竖屏镜头扩充（2026-10-09）

新增 type-and-filter、ai-stream-response、unit-dot-regroup；六套风格、16:9和9:16共用严格内容契约与独立画幅布局。当前40个横屏场景、4个竖屏场景；原专用配方不自动扩展画幅。搜索结果、任务状态与点阵总数均由输入给定，预检拒绝不一致数据和错误时序。公开库按风格×画幅读取实际样片，旧画幅/版本不迁移，不新增依赖；竖屏素材配色仍保持原限制。范围、验收与验证见[接入记录](references/shot-expansion-20261009.md)。

## 内容优先布局与实测

`storyboard.layoutPolicy` 是显式版本契约；新2.4初始化采用content-first-v1，缺省保留历史路径。`src/layout/scene-layout.ts` 在renderer和预检之间共享区域与节点几何。`LayoutDiagnostics` 在正式渲染的已加载字体/图片下采集文字可见范围、遮罩和contain后的源图尺寸；`scripts/lib/layout-qa.mjs` 汇集场景事件及相邻交接证据，在候选原子发布前拦截硬错误。实测写入receipt并由QA核对分镜哈希、必选帧和视频字节；整体输入与实现继续进入原生产锁。主观吸引力、源图内部文字和音画全片复核仍由人工判断。
