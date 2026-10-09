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
- `.agents/skills/frame-loom/`：Codex 自动发现入口；根目录 `SKILL.md` 是共享生产流程。
- `.claude-plugin/`：Claude Code 插件元数据，复用根目录 `SKILL.md`。

## 验证入口

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

- 配方库面向用户的卡片、详情与复制指令不展示风格或镜头版本号；使用名称与ID选择，内部生产契约保留兼容性与复现记录。
- 当前镜头配方的展示与生产外观使用白色、冷灰或石墨中性底色，不沿用 Style Pack 的大面积米黄纸色；默认强调色由风格提供，显式项目配色优先；全片字体独立单选并覆盖标题、正文、图解与字幕。未指定字体的旧分镜保留原字体栈。封面与动画必须由同一实际 renderer 生成。
- 当前37个横屏场景配方支持全部六套当前风格，风格与镜头集合独立选择；卡片、详情及变体加载所选风格的实际样片，不用其他风格或历史示例回退。竖屏仍仅支持基础语义配方；历史配方与预设模板保留自身能力声明。
- Renderer 只能使用 `src/renderer/capability-manifest.ts` 声明的能力。
- 所有视频模板的旁白字幕与场景字幕都直接显示在画布上，不得添加实色或半透明的字幕底板、胶囊或背景色。字幕使用有效配色中独立的 `captionInk`，与正文 `ink` 区分：浅色画布使用深色字幕，深色画布使用白色字幕，并保证文字对比度和安全区。
- 底部旁白字幕按短句单行展示，不把整场讲稿一次铺满画面。TTS 项目的每场旁白起点要贴合镜头起点，旁白结束到换镜的空档不得超过 0.5 秒；需要更长的视觉停留时，拆成独立镜头。
- 所有模板的底部旁白字幕在每条字幕首尾省略逗号、句号、顿号、分号、冒号等停顿标点；同一条字幕内部需要区分分句时保留标点，句末问号和感叹号按语气保留。只处理显示与导出的字幕，不改讲稿或 TTS 朗读文本。
- `storyboard.draft.json` 不得直接作为生产渲染输入。
- 真实产品界面、字体、音乐和图片必须有来源说明；v0.1 示例只使用 CSS 和文本。
- 系统层不得依赖某一个示例的文案、素材或产品事实。

Storyboard 2.4 显式启用 shot，所有场景含精确版本和严格 layer 槽位；2.1–2.3保留原路径。新模板仅声明验证过的风格/画幅，未知能力不能静默回退。2.4 的生产锁和解析事件与render receipt、QA、run及批准绑定；派生计划不是可编辑输入。

主选择入口是视频风格 + 镜头配方集合（`--style` + `--shots`）；预设视频模板是可选快捷入口。`shotRecipes` 约束逐场选择，不能自动添加未选配方；同一配方可重复使用。初始化只创建待编排文件，系统重构任务不自动转换成用户视频生产任务。

配方库默认由 Agent 读取文档后推荐组合并逐场编排，选定后显式传入 `--shots`；手动集合仍是严格白名单，旧选择保持手动意图。推荐不按分类凑齐，fast 不新增组合确认，review 沿用讲稿分镜审核。内容编排与渲染前复查见 `references/shot-planning.md`；重复构图和标题长停留是警告，不替代语义判断或完整播放复核。

全片字体通过 `--font` 与独立 `storyboard.font` 选择；文件加载完成后才测量／渲染镜头，未知 ID、版本不符或文件损坏不得静默回退。字体及许可绑定生产与审核指纹。风格／镜头原样片标明原始字体，所选风格×字体的横屏参考由 `preview:fonts` 生成。

项目配色流程见 `references/project-palette.md`。2.4 的可选 `palette` 只启用当前横屏配方；未声明时保持原外观。配色参考通过素材 `usage` 与画面素材分离，可以不出镜；最终色值、派生色与来源字节绑定生产和审核，不在渲染时访问网址或重新分析。
