# FrameLoom 项目规则

## 定位

FrameLoom 是以 Codex 为主要入口、兼容其他 Coding Agent 的本地、确定性视频生产 Skill。当前版本支持讲稿交接、静音审片预览、供外部剪辑的干净画面底片，以及 TTS／外部旁白合成的项目内有声视频。

## 目录职责

- `src/`：Remotion composition、类型、校验和 renderer。
- `schemas/`：对外可读的 JSON Schema 契约。
- `shots/`、`video-templates/`：受控配方与视频模板清单、来源及Agent选用指南；新场景只经静态renderer注册。
- `styles/`：可渐进加载的 Style Pack，不放用户私有素材。
- `fonts/`：受控字体清单、推荐关系与来源；`public/fonts/` 保存固定版本的字体和原始许可。新增或修改字体必须校验字节指纹，不安装到系统。
- `scripts/`：本地校验和渲染入口。
- `library/`：本地风格与镜头配方浏览及选择页面；`npm run library` 启动，能力读取现有 catalog，不接管生产。`preview:library` 只渲染公开配方样片。
- `.github/workflows/library-pages.yml`：GitHub Pages 只发布完整的 `dist/library/` 静态产物；PR 不发布，用户生产目录和音频配置不得进入站点。
- `examples/`：公开、可替换、无私有凭据的示例生产层。
- `projects/`：用户视频生产目录，不提交输出视频。新生产项目使用 `YYYYMMDD-内容主题` 命名；同日同名用 `-02`、`-03`，旧目录不批量改名，`template-` 预设示例不适用。
- `.agents/skills/frame-loom/`：Codex 自动发现入口，Claude Code 插件通过 manifest 的 `skills` 路径复用；根目录 `SKILL.md` 是共享生产流程。
- `.claude-plugin/`：Claude Code 插件元数据，复用根目录 `SKILL.md`。

## 验证入口

对外文档按读者任务归位：中英文 README 负责效果、首次使用与能力边界，`references/README.md` 索引当前指南和历史记录，详细步骤放对应指南；致谢与许可作为 README 最后章节。带日期的验证记录保留当时事实，不作为当前能力说明；功能摘要须与实际 catalog 和风格固定流程一致。

运行环境要求 Node.js 24+（推荐 Node.js 24 LTS）及 FFmpeg/ffprobe；CI 与 Pages 工作流统一使用 Node.js 24。`validate:shots` 同时核对 README 与共享 Skill 的当前能力摘要。

```bash
npm run typecheck
npm run lint
npm run test:storyboard
npm run validate:shots
npm run test:shots
npm run validate:storyboard -- examples/article-video/storyboard.json
npm run render:storyboard -- examples/article-video/storyboard.json /tmp/frame-loom-preview.mp4 --mode fast
npm run inspect:output -- /tmp/frame-loom-preview.mp4 examples/article-video/storyboard.json
```

`produce --mode review` 要求 `reviewed` 或 `approved` 状态及当前 `storyboard-approval.json` 指纹；`fast` 可推进 `generated`／`validated`。`--output-purpose visual-preview|visual-master|in-project-video` 决定交付用途；`--audio-mode silent|tts|external|auto` 决定音频来源。没有音频时只有审片预览或画面底片；明确要求项目内有声视频不能静默回退。画面底片经自动 QA 和完整视觉复核后由 `approve:visual-handoff` 标记为可交后期；项目内有声讲解视频需要匹配旁白、音频与画面 QA，并由 `approve:delivery` 记录完整播放复核。

## 约束

- 配方库面向用户的卡片、详情与复制指令不展示风格或镜头版本号；使用名称与ID选择，内部生产契约保留兼容性与复现记录。镜头选择库只展示当前可选风格的配方，AI 插画风格专属内置镜头不进入卡片、搜索和分类统计；共享可选镜头保留，完整 catalog、样片与生产能力不裁剪。
- 配方库中英文语言偏好独立于制作状态，切换须保留风格、字体、画幅、镜头与制作选项，存储禁用时通过公开 URL 恢复。英文制作指令必须与中文保持相同参数及制作边界，不把界面语言作为翻译讲稿的授权。样片、字体示例、配方原文和许可保留原始内容并标注；品牌输入、ID 与来源路径不翻译。
- 无项目配色时，当前镜头配方的展示与生产外观使用白色、冷灰或石墨中性底色；whiteboard 按上游视觉基准使用 #fffdf7 点阵纸色，默认强调色由风格提供。采用主体产品截图／网址配色时，背景、文字、表面及强调色均以来源为准，允许来源暖色或有色底；不得只取按钮颜色后强制改成冷灰。风格保留构图、装饰和运动。全片字体独立单选并覆盖标题、正文、图解与字幕。未指定字体的旧分镜保留原字体栈。封面与动画必须由同一实际 renderer 生成。
- 原六套当前风格支持43个横屏场景配方；三套当前主风格为 whiteboard、annotated-reasoning、editorial-typography。Whiteboard 保留开放白板、基础白板及插画能力；后两套分别使用 annotated-manuscript、editorial-flow 与 semantic-default 固定内置范围。旧 flat-explainer、paper-collage 从新选择入口隐藏，生产能力保留，不迁移旧分镜。样片、详情、封面必须使用所选风格实际 renderer。竖屏维持原六套已有能力；新两套仅横屏。
- Renderer 只能使用 `src/renderer/capability-manifest.ts` 声明的能力。
- 所有视频模板的旁白字幕与场景字幕都直接显示在画布上，不得添加实色或半透明的字幕底板、胶囊或背景色。字幕使用有效配色中独立的 `captionInk`，与正文 `ink` 区分：浅色画布使用深色字幕，深色画布使用白色字幕，并保证文字对比度和安全区。
- 底部旁白字幕按短句单行展示，不把整场讲稿一次铺满画面。TTS 项目的每场旁白起点要贴合镜头起点，旁白结束到换镜的空档不得超过 0.5 秒；需要更长的视觉停留时，拆成独立镜头。
- 所有模板的底部旁白字幕在每条字幕首尾省略逗号、句号、顿号、分号、冒号等停顿标点；同一条字幕内部需要区分分句时保留标点，句末问号和感叹号按语气保留。只处理显示与导出的字幕，不改讲稿或 TTS 朗读文本。
- TTS 参数按服务能力校验，不通过丢弃参数或更换模型消除错误。`list:tts-profiles` 的 `ready` 只代表本地预检，不保证在线权限；`preview:tts` 是显式在线试听，不得自动调用或作为生产音频包。
- 语音时间证据、开放白板时间提案与分场缓存见 `references/speech-driven-production.md`。估算不得标为供应商实测；提案只写新文件，采用后仍按当前分镜审核。缓存命中仍需当前布局、输入指纹与输出 QA，不能替代完整播放复核。
- `storyboard.draft.json` 不得直接作为生产渲染输入。
- 真实产品界面、字体、音乐和图片必须有来源说明；v0.1 示例只使用 CSS 和文本。
- 系统层不得依赖某一个示例的文案、素材或产品事实。

Storyboard 2.4 显式启用 shot，所有场景含精确版本和严格 layer 槽位；2.1–2.3保留原路径。新模板仅声明验证过的风格/画幅，未知能力不能静默回退。2.4 的生产锁和解析事件与render receipt、QA、run及批准绑定；派生计划不是可编辑输入。

三套主风格使用固定内置镜头流程（见 `references/primary-style-production.md`），用户只选风格，不选择镜头集合；初始化自动填入受控范围。原六套选择入口保留视频风格 + 镜头配方集合（`--style` + `--shots`）；预设视频模板是可选快捷入口。`shotRecipes` 约束逐场选择，不能自动添加未选配方；同一配方可重复使用。初始化只创建待编排文件，系统重构任务不自动转换成用户视频生产任务。

原六套配方库默认由 Agent 读取文档后推荐组合并逐场编排，选定后显式传入 `--shots`；手动集合仍是严格白名单，旧选择保持手动意图。推荐不按分类凑齐，fast 不新增组合确认，review 沿用讲稿分镜审核。内容编排与渲染前复查见 `references/shot-planning.md`；重复构图和标题长停留是警告，不替代语义判断或完整播放复核。

全片字体通过 `--font` 与独立 `storyboard.font` 选择；文件加载完成后才测量／渲染镜头，未知 ID、版本不符或文件损坏不得静默回退。字体及许可绑定生产与审核指纹。风格／镜头原样片标明原始字体，所选风格×字体的横屏参考由 `preview:fonts` 生成。

项目配色流程见 `references/project-palette.md`。2.4 的可选 `palette` 只启用当前横屏配方；未声明时保持原外观。新初始化记录 `palettePolicy: source-roles-v1`，采用配色时必须使用 palette 1.1；素材配色逐角色记录直接采样或有理由的推导，背景、正文、强调色必须直接采样。旧 1.0 保留原行为，不批量迁移。配色参考通过素材 `usage` 与画面素材分离，可以不出镜；最终色值、采样证据、派生色与来源字节绑定生产和审核。正式渲染只读取本地来源，不访问网址或重新选择颜色；验证可重采样固定区域核对证据。

新建2.4生产使用显式 `layoutPolicy: content-first-v1`；旧分镜不自动迁移。内容区域和原生节点几何在renderer与预检间共享；正式候选发布前的实测证据检查完成态裁切/碰撞及事件覆盖，自动QA仍不代替素材内部可读性和完整播放。规则与回归入口见 `references/content-layout.md`。

插画生产见 `references/illustrated-production.md`。纯文档新主风格启用生成主体策略，Agent 实际调用原生 imagegen，检查结果后登记；准备提示词不能视为完成生图。截图路线不自动生图。风格库前三套称为“AI 插画风格”，原六套称为“图文动效风格”；按画面构建方式分组，内部 primary / legacy 标识、能力与旧输入兼容保留。

Whiteboard 默认按开放白板编排：Rough.js 双线、逐行文字擦出、贴纸擦出与单支铅笔同步；不是以 illustrated-* 卡片代替。配方库主样片与 whiteboard-board 公开镜头样片使用 `examples/whiteboard-original/` 的原创人物和文案。`examples/whiteboard-reference/` 仅作上游方法对照与回归，保留原素材及 MIT 署名，不作为网页主展示。自有项目生成素材另行登记。

第二、第三主风格为 `annotated-reasoning`（批注推演）与 `editorial-typography`（编辑式排印）。正文、数字与关系是主体，辅助插画的声明框总面积最多为画布8%。批注必须引用正文中的唯一短语；排印通过显式 focus 阶段绑定同一批文字的位置、字号和可见性，连接绑定实际阶段和端点。能力、限制及示例见 `references/text-led-production.md`；不得把示例文案或图片路径写死到系统 renderer。旧两套规范仍服务已有项目。

三套主风格共用右上角独立品牌层，配置入口为仓库／项目 `config.json`；视频和同源封面使用相同标识，品牌配置与启用 Logo 字节绑定生产、审核和缓存。公开样片始终使用 Your Brand 占位，不读取私有品牌；原六套不加标识。见 `references/branding.md`。

三套 AI 插画风格的风格库主样片使用同一标题、完整旁白文本、画面文字与情境，便于比较画法、构图和动效；参考文案不成为用户生产的系统默认讲稿。
