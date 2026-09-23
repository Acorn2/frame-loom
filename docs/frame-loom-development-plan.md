# FrameLoom 开源项目开发规划

**项目路径**：`/Users/ankanghao/ai_code/frame-loom`  
**规划日期**：2026-09-22  
**项目名称**：FrameLoom  
**中文名称**：帧织  
**项目定位**：面向 Codex、Claude Code、Kimi Code、OpenCode 等 Coding Agent 的结构化视频生产 Skill。  
**英文简介**：An open-source Agent Skill for turning structured documents into style-driven, reviewable videos.

## 当前实施状态（2026-09-22）

规划中的 v0.2–v0.5 本地能力基线已经落地：3 个 Style Pack、4 个语义模板、运行时 Zod 契约及生成式 JSON Schema、项目初始化、素材来源校验、安全区检查、输出元数据检查、抽帧/contact sheet、统一 `qa:storyboard` 报告、CI 和贡献文档。Style Pack 已改为索引与文件驱动，新增风格不再修改核心注册表。当前本地版本标记为 `0.5.0`；公开发布仍需单独执行，不在本次改造范围内。

可选音频层已具备本地 voiceover、SRT/VTT、音乐和 SFX 的供应商无关接入、时长检查、响度测量、可选 voiceover 下音乐 ducking 及 audio pilot 渲染；仍不包含 TTS、声音克隆、自动母带处理和自动发布。所有输出在完整人工播放复核前都不是发布成片。

后续工作从“补齐基础闭环”转为真实项目试用、素材 provenance 强化、视觉回归基线、字幕排版深化、音频响度/ducking 和更多可复用模板，不再以增加脚本数量为主要目标。

## 1. 项目结论

FrameLoom 可以做成一个独立的开源项目，但不应只是当前 Remotion 工程的公开副本，也不应把项目描述成“输入一句话，自动生成任何类型的视频”。

推荐的产品定义是：

> 用户提供文档、产品资料或结构化内容，Coding Agent 帮助用户完成内容提炼、视觉风格选择、可执行分镜设计和人工审核，FrameLoom 再将审核后的 storyboard 编译成可复核、可重复渲染的 Remotion 视频。

FrameLoom 的核心价值不是替代视频大模型，而是为结构化内容提供一条稳定、低成本、可修改、可重复的生产路径：

```text
文档 / 产品资料
    ↓
内容提炼与视频路线判断
    ↓
风格候选与视觉预览
    ↓
用户选择 Style Pack
    ↓
script.md + storyboard.draft.json
    ↓
人工审核
    ↓
storyboard.json
    ↓
素材校验与时间轴计算
    ↓
Remotion 无音频预览视频
    ↓
抽帧、播放、移动端检查
    ↓
可选音频接入与最终渲染
```

## 2. 依据与继承关系

### 2.1 三篇教学文档沉淀的能力

| 教学文档 | 应沉淀为 |
| --- | --- |
| 19：一份文档进去，一支预览视频出来 | 文档分析、脚本与分镜、确定性渲染、预览返工、视频质量基本盘 |
| 20：声音克隆让视频用你的声音开口 | 可选音频层、音频与字幕配置、音频时长驱动时间轴、音频权限和来源边界 |
| 21：从能跑到好看 | 内容到视觉元素的映射、注意力引导、转场、节奏、字幕安全区、抽帧与完整播放验收 |

### 2.2 当前 `remotion-video-factory` Skill 的核心约束

FrameLoom 应继承以下原则：

- AI 负责语义判断，程序负责时间轴、布局、动画和渲染。
- `storyboard.draft.json` 与审核后的 `storyboard.json` 分离。
- V2 storyboard 必须显式声明 `template`、`layers`、`connections`、`beats`、`captions` 和 `transitionOut`。
- 自由文本 `motion`、`visualIntent` 只能作为说明，不能替代可执行动作。
- 每个重要内容含义都要映射到可见图层或关系，再映射到 beat 和字幕窗口。
- 素材必须有可解析路径、用途和来源说明。
- 没有音频时可以生成静音预览，但不能把静音预览描述为音频成片。
- 阶段之间需要人工确认，不能一次自动跳过 storyboard 审核、素材审核和视频 QA。

### 2.3 参考 `frontend-slides` 的产品设计

FrameLoom 借鉴以下公开设计思路：

- Skill 是用户入口，运行时和辅助资料按需加载。
- 风格先以预览卡片展示，再读取选中风格的完整规范。
- 使用 `style-index` 做候选筛选，避免一开始加载全部设计细节。
- 同时支持 Claude Code 插件安装和其他 Coding Agent 直接读取 `SKILL.md`。
- 提供完整示例、安装方式、风格画廊和可选工具脚本。
- 默认能力保持简单，扩展模板和实验性风格采用渐进式加载。

FrameLoom 不直接复制其 HTML/PPT 实现，而是将“视觉风格发现 + 渐进式 Skill + Agent 无关的仓库结构”迁移到 Remotion 视频场景。

## 3. 产品目标

### 3.1 MVP 用户

- 想把文章、教程、产品说明、知识内容制作成视频的独立开发者。
- 使用 Codex、Claude Code 或其他 Coding Agent 的非专业视频创作者。
- 需要稳定生成产品介绍、知识讲解、报告摘要、流程说明视频的团队。
- 想基于 Style Pack 反复生产同一类视频的内容创作者。

### 3.2 MVP 输入

- Markdown、纯文本或结构化文章。
- 产品截图、网页截图或用户提供的图片素材。
- 可选的音频文件、字幕文件和背景音乐。
- 用户选择的画布比例、目标平台和大致时长。
- 用户选择的 Style Pack。

### 3.3 MVP 输出

默认输出：

```text
projects/<video-id>/
├── source/
├── production-brief.md
├── content-brief.md
├── script.md
├── storyboard.draft.json
├── storyboard.json
├── assets/
├── asset-manifest.json
└── output/
    └── preview-silent.mp4
```

可选输出：

```text
projects/<video-id>/
└── audio/
    ├── voiceover.mp3
    ├── captions.srt
    ├── music.mp3
    └── audio-config.json
```

### 3.4 MVP 成功标准

一个新用户在本地安装依赖后，可以完成以下闭环：

1. 将一份 Markdown 文档放入项目。
2. 通过 Skill 了解项目适用边界。
3. 查看至少 3 个风格候选。
4. 选择一个 Style Pack。
5. 生成一份经过人工确认的 storyboard。
6. 运行结构校验。
7. 生成一支 20–60 秒的无音频 MP4。
8. 抽查开场、中段、转场和结尾。
9. 在不修改 renderer 的情况下更换另一份文档重新生成。

建议第一版把“能否稳定跑通这条闭环”作为主要验收标准，而不是 Style Pack 数量、动画数量或 AI 自动化程度。

## 4. 产品边界

### 4.1 MVP 做什么

- 提供一个通用的 `SKILL.md`。
- 提供风格目录和风格索引。
- 提供 3 个可运行的 Style Pack。
- 提供 4 个通用语义模板。
- 提供 V2 storyboard schema。
- 提供素材、时间轴、能力和目标校验。
- 提供 Remotion 预览和渲染脚本。
- 默认生成无音频预览。
- 支持用户后来提供音频和字幕。
- 提供示例、安装文档和 Style Gallery。

### 4.2 MVP 不做什么

- 不做在线 SaaS、用户账号、云端渲染和任务队列。
- 不做完整的浏览器 storyboard 编辑器。
- 不内置某一家 TTS、声音克隆或云端视频模型。
- 不承诺生成剧情片、真人表演、电影镜头或复杂 3D 场景。
- 不把所有视频都强行压缩成文字卡片。
- 不自动发布到 YouTube、Bilibili、抖音或其他平台。
- 不把用户提供的真实产品界面替换为虚构的 AI mockup。
- 不在核心包中捆绑来源不明的字体、音乐和图片。

### 4.3 适用内容

优先支持：

- 知识讲解
- 产品介绍
- 产品流程演示
- 教程和课程摘要
- 资讯、榜单和报告
- 数据解释
- 文档和方案汇报

应路由到其他方案：

- 剧情短片
- 角色表演
- 高度依赖真实摄影的宣传片
- 依赖连续人物表情和镜头语言的内容
- 主要价值来自生成式视觉想象的电影化镜头

## 5. 核心架构

### 5.1 三层模型

FrameLoom 采用“Skill 层、Runtime 层、Production 层”三层结构。

#### Skill 层

负责指导 Coding Agent：

- 读取输入和判断路线。
- 提炼内容和证据边界。
- 选择 Style Pack。
- 生成脚本和 storyboard 草稿。
- 提醒人工审核节点。
- 执行验证、预览和 QA。

#### Runtime 层

负责确定性执行：

- 解析 storyboard。
- 计算场景时间轴。
- 渲染模板、图层、连接和动作。
- 解析 Style Pack tokens。
- 校验能力和素材。
- 输出 Remotion 视频。

#### Production 层

负责单支视频：

- 来源文档。
- 内容摘要和脚本。
- 具体 storyboard。
- 素材和来源。
- 用户选择的风格。
- 可选音频。
- 预览和交付文件。

```text
Agent Skill
    ↓
Production Artifacts
    ↓
Storyboard Contract + Style Pack
    ↓
Runtime / Renderer
    ↓
MP4 + Review Evidence
```

### 5.2 内容、结构、视觉三者分离

同一份内容应能通过不同 Style Pack 生成不同视觉结果：

```text
内容层：讲什么
结构层：什么时间出现、元素之间是什么关系
视觉层：用什么颜色、字体、材质、布局和动作表达
```

推荐的 storyboard 入口：

```json
{
  "schemaVersion": "2.1",
  "style": {
    "id": "retro-zine",
    "version": "1.0.0"
  },
  "project": {
    "title": "AI 产品介绍",
    "width": 1920,
    "height": 1080,
    "fps": 30,
    "durationSec": 30,
    "durationFrames": 900,
    "status": "draft"
  },
  "scenes": []
}
```

### 5.3 系统层与生产层边界

可复用系统层：

- schema
- Style Pack
- 模板
- 图层 renderer
- motion primitives
- transitions
- caption renderer
- timing utilities
- validators
- render scripts
- review tools

每支视频的生产层：

- source
- script
- storyboard
- assets
- asset manifest
- audio
- output

系统层不得依赖某一支示例视频的文案、截图、音频、项目 ID 或产品事实。

## 6. 推荐仓库结构

第一版采用单仓库，降低使用和维护成本。等运行时稳定后，再考虑拆出 npm 包或独立 Style Pack 仓库。

```text
frame-loom/
├── SKILL.md
├── README.md
├── LICENSE
├── .gitignore
├── package.json
├── tsconfig.json
├── eslint.config.mjs
├── .claude-plugin/
│   └── plugin.json
├── references/
│   ├── staged-workflow.md
│   ├── production-pipeline.md
│   ├── style-selection.md
│   ├── storyboard-schema.md
│   ├── audio-integration.md
│   └── review-checklist.md
├── styles/
│   ├── style-index.json
│   ├── retro-windows/
│   │   ├── preview.md
│   │   ├── design.md
│   │   ├── style.json
│   │   ├── motion.json
│   │   └── assets/
│   ├── retro-zine/
│   │   ├── preview.md
│   │   ├── design.md
│   │   ├── style.json
│   │   ├── motion.json
│   │   └── assets/
│   └── scatterbrain/
│       ├── preview.md
│       ├── design.md
│       ├── style.json
│       ├── motion.json
│       └── assets/
├── schemas/
│   ├── storyboard.schema.json
│   ├── style-pack.schema.json
│   ├── asset-manifest.schema.json
│   └── audio-config.schema.json
├── src/
│   ├── Root.tsx
│   ├── compositions/
│   │   └── DataDrivenVideo.tsx
│   ├── renderer/
│   │   ├── capability-manifest.ts
│   │   ├── render-scene.tsx
│   │   ├── render-layer.tsx
│   │   └── render-beat.ts
│   ├── templates/
│   │   ├── statement/
│   │   ├── graph-explainer/
│   │   ├── metric-grid/
│   │   └── interaction-flow/
│   ├── layers/
│   ├── motion/
│   ├── transitions/
│   ├── styles/
│   ├── audio/
│   └── timeline/
├── scripts/
│   ├── init-project.mjs
│   ├── list-styles.mjs
│   ├── preview-styles.mjs
│   ├── validate-storyboard.mjs
│   ├── render-storyboard.mjs
│   ├── extract-review-frames.mjs
│   └── inspect-output.mjs
├── examples/
│   ├── article-video/
│   ├── product-demo/
│   └── data-explainer/
├── projects/
│   └── .gitkeep
├── public/
│   └── assets/
└── docs/
    ├── frame-loom-development-plan.md
    ├── MVP.md
    ├── ARCHITECTURE.md
    └── TECH-STACK.md
```

## 7. Style Pack 规范

### 7.1 Style Pack 目标

Style Pack 不是单纯的配色文件，而是完整的视觉和动作系统。至少需要定义：

- 色彩 token。
- 字体 token和字体来源。
- 画布背景和表面材质。
- 标题、正文、标签、数字和字幕层级。
- 安全区、间距和布局约束。
- 卡片、节点、截图、连线和标注的默认视觉。
- 入场、强调、聚焦和转场的动作语言。
- 可支持的模板和图层。
- 内容密度限制。
- 适合和不适合的内容类型。

### 7.2 Style Pack 文件

```text
styles/<style-id>/
├── preview.md
├── design.md
├── style.json
├── motion.json
├── renderer-map.json
├── preview/
│   ├── hook.png
│   ├── content.png
│   └── transition.png
└── assets/
```

文件职责：

- `preview.md`：短风格卡片，用于候选筛选。
- `design.md`：选中后读取的完整设计规范。
- `style.json`：机器可读的视觉 token。
- `motion.json`：机器可读的动作参数和适用条件。
- `renderer-map.json`：模板、图层、动作到风格实现的映射。
- `preview/`：至少提供开场、内容和交接三类关键帧。
- `assets/`：纹理、装饰或可授权字体等风格资源。

### 7.3 Style Pack 示例

MVP 建议先实现 3 种差异明确的风格：

#### `retro-windows`

- 适合：软件教程、开发工具、数字产品介绍。
- 视觉：灰色窗口、像素化标题、系统控件、机械式状态变化。
- 动作：窗口打开、按钮聚焦、列表高亮、状态切换。
- 风险：避免只做静态 Windows 95 截图，要让界面状态产生真实变化。

#### `retro-zine`

- 适合：观点文章、知识解释、品牌故事、文化内容。
- 视觉：纸张、印刷错位、拼贴、绿色或红色强调、手工排版。
- 动作：纸张进入、剪贴元素移动、印刷层叠、轻微错位。
- 风险：纹理和装饰不能影响文字阅读。

#### `scatterbrain`

- 适合：创意方法、学习笔记、个人表达、轻量产品介绍。
- 视觉：便利贴、手写字、自由布局、彩色批注。
- 动作：便利贴贴入、重点圈选、关系线绘制、局部聚焦。
- 风险：自由布局仍需保留清晰的阅读顺序和安全区。

### 7.4 风格选择工作流

Skill 不应一次加载所有完整设计规范，建议采用渐进式加载：

```text
读取 style-index.json
    ↓
根据内容类型筛选候选
    ↓
读取候选风格的 preview.md
    ↓
生成 3 个风格候选说明或短预览
    ↓
用户选择风格
    ↓
只读取选中风格的 design.md、style.json、motion.json
    ↓
生成 storyboard
```

风格索引建议：

```json
{
  "styles": [
    {
      "id": "retro-zine",
      "name": "Retro Zine",
      "category": "editorial",
      "mood": ["warm", "handmade", "printed"],
      "bestFor": ["knowledge", "opinion", "story"],
      "canvas": ["landscape", "portrait"],
      "templates": ["statement", "graph-explainer"],
      "preview": "styles/retro-zine/preview.md",
      "status": "stable"
    }
  ]
}
```

## 8. Storyboard 与数据契约

### 8.1 必须支持的结构

```text
project
  ├── style
  ├── width / height / fps
  ├── durationSec / durationFrames
  └── status

scenes[]
  ├── id
  ├── template
  ├── title
  ├── narration
  ├── layers[]
  ├── connections[]
  ├── beats[]
  ├── captions[]
  └── transitionOut
```

### 8.2 MVP 模板

| 模板 | 语义职责 | 首版要求 |
| --- | --- | --- |
| `statement` | 钩子、观点、结论 | staged label、标题、注释、强调 |
| `graph-explainer` | 人物、概念、原因和关系 | 节点、连线绘制、关系高亮 |
| `metric-grid` | 数字、规模、对比和结果 | 指标入场、数字计数、结论聚焦 |
| `interaction-flow` | 产品流程、操作步骤和状态变化 | 截图替换、点击标注、局部聚焦 |

### 8.3 MVP 图层

- `node`
- `card`
- `label`
- `annotation`
- `metric`
- `screenshot`

### 8.4 MVP 动作

- `enter`
- `reveal`
- `draw`
- `focus`
- `highlight`
- `count`
- `camera-push`

### 8.5 MVP 转场

- `fade`
- `slide`
- `paper-wipe`
- `carry`

### 8.6 校验原则

校验器至少检查：

- schema 版本。
- 风格 ID 和版本是否存在。
- 模板、图层、动作、转场是否在能力清单中。
- 每个 beat 的 target 是否存在。
- `draw` 是否指向 connection。
- ID 是否在场景内唯一。
- 所有时间点是否落在场景内。
- 场景总时长与项目时长是否一致。
- `durationFrames` 是否和 fps、durationSec 一致。
- caption 是否超出场景。
- screenshot asset 是否存在且不是空白文件。
- 生产 storyboard 是否处于允许渲染的状态。

## 9. Skill 工作流

Skill 主文件只做流程地图，详细规则拆到 `references/`。

### 9.1 建议的阶段

保留当前九阶段，但将风格选择插入到早期：

| 阶段 | 结果 | 默认模型 |
| --- | --- | --- |
| 01 | 项目 intake、内容类型和路线判断 | 快速/经济 |
| 02 | 内容提炼、证据边界和风格候选 | 均衡 |
| 03 | 风格选择和风格预览确认 | 均衡 |
| 04 | `storyboard.draft.json` | 最高质量 |
| 05 | storyboard 审核并生成 `storyboard.json` | 最高质量 |
| 06 | 素材计划、素材获取和 provenance | 均衡 |
| 07 | 讲稿、可选音频、字幕和时间轴 | 均衡 |
| 08 | 结构校验和代表性 pilot render | 快速/经济 |
| 09 | 视觉/音频 QA 与定向修复 | 均衡 |
| 10 | 全量渲染和交付报告 | 快速/经济 |

如果希望与现有 `remotion-video-factory` 保持九阶段兼容，也可以把“风格选择”作为 Stage 02 的子阶段，不单独改变编号。MVP 推荐先保持九阶段编号稳定，避免迁移已有工作流：

```text
Stage 01：项目 intake 和路线判断
Stage 02：内容提炼、证据计划、Style Pack 选择
Stage 03：Storyboard draft
Stage 04：Storyboard critique 和 production contract
Stage 05：素材获取
Stage 06：讲稿、音频、字幕和时间轴
Stage 07：校验和代表性预览
Stage 08：视觉/音频 QA
Stage 09：全量渲染和交付
```

### 9.2 默认无音频流程

默认流程应该明确：

```text
输入文档
  → script.md
  → storyboard.draft.json
  → storyboard.json
  → provisional timing
  → preview-silent.mp4
```

没有音频时，时间轴必须标记为 provisional。建议使用：

- 中文屏显阅读：约 5 个短字符/秒，加 0.8–1 秒呼吸时间。
- 旁白预估：约 3.8–4.5 个中文字符/秒。
- 最后一个重要 beat 后至少保留约 0.4 秒。
- 重要视觉变化通常每 1.5–2.5 秒发生一次。

### 9.3 可选音频流程

用户提供音频后：

1. 读取 `audio-config.json`。
2. 检查音频路径和格式。
3. 读取或生成字幕。
4. 对齐音频和原始讲稿。
5. 以测量到的音频和字幕时间作为时间轴最终来源。
6. 重算 scene duration、beat、caption 和项目总时长。
7. 生成带音频 pilot。
8. 进行人声、字幕、BGM 和音效试听。

音频适配器只定义接口，不内置供应商：

```text
AudioInput
  ├── voiceover
  ├── captions
  ├── music
  └── sfx
```

## 10. 开发阶段与原子任务

## Sprint 0：项目基线与开源边界

**目标**：建立可维护的仓库基础，明确许可证、运行环境和开发文档。

### Task 0.1：初始化项目元数据

- **位置**：`package.json`、`tsconfig.json`、`eslint.config.mjs`、`.gitignore`
- **内容**：初始化 TypeScript + React + Remotion 项目，固定 Remotion 版本，加入 lint、typecheck、test、build 脚本。
- **依赖**：无
- **验收**：`npm install`、`npm run lint`、`npm run build` 成功。

### Task 0.2：建立开源入口文档

- **位置**：`README.md`、`LICENSE`、`.claude-plugin/plugin.json`
- **内容**：说明定位、安装、支持的 Agent、最小使用流程、能力边界和许可证。
- **依赖**：Task 0.1
- **验收**：新用户只看 README 能知道如何安装和运行示例。

### Task 0.3：记录技术和架构决策

- **位置**：`docs/MVP.md`、`docs/ARCHITECTURE.md`、`docs/TECH-STACK.md`
- **内容**：将本规划中的产品边界、数据流和技术选择转成项目长期文档。
- **依赖**：Task 0.1
- **验收**：文档不依赖个人项目名称、私有截图或本地绝对路径。

### Sprint 0 验收

- 仓库可以安装、构建和运行空的 Remotion composition。
- 仓库具备 MIT 或其他明确的开源许可证。
- 不包含个人产品素材、私有音频、密钥或旧项目输出。

## Sprint 1：Storyboard Schema 与能力清单

**目标**：建立与 renderer 解耦的可校验生产契约。

### Task 1.1：定义 TypeScript schema

- **位置**：`src/schemas/storyboard.ts`、`schemas/storyboard.schema.json`
- **内容**：定义 project、style、scene、layer、connection、beat、caption、transition 类型。
- **依赖**：Sprint 0
- **验收**：合法示例可解析；缺少必填字段、错误 ID 和未知 action 能被识别。

### Task 1.2：定义 capability manifest

- **位置**：`src/renderer/capability-manifest.ts`
- **内容**：声明模板、图层、动作、转场及其兼容 target。
- **依赖**：Task 1.1
- **验收**：校验器和 renderer 使用同一份能力声明，不允许各自维护隐式列表。

### Task 1.3：实现 storyboard validator

- **位置**：`scripts/validate-storyboard.mjs`、`src/validation/`
- **内容**：实现结构、能力、目标、时间轴、style 和 asset 路径校验。
- **依赖**：Task 1.1、Task 1.2
- **验收**：错误信息包含文件路径、scene ID、beat ID 和修复提示。

### Task 1.4：编写 validator 测试

- **位置**：`tests/storyboard-validator.test.ts`
- **内容**：覆盖合法样例、未知能力、越界时间、断裂 target、时长不一致和 asset 缺失。
- **依赖**：Task 1.3
- **验收**：`npm run test:storyboard` 通过。

### Sprint 1 验收

- 一份 storyboard 可以在不启动 Remotion Studio 的情况下完成完整结构校验。
- renderer 不需要通过猜测或忽略未知字段运行。

## Sprint 2：Runtime 与第一个垂直闭环

**目标**：让一份最小 storyboard 真正渲染为 MP4。

### Task 2.1：建立 DataDrivenVideo composition

- **位置**：`src/compositions/DataDrivenVideo.tsx`、`src/Root.tsx`
- **内容**：通过 input props 加载指定 storyboard，不使用固定 sample。
- **依赖**：Sprint 1
- **验收**：命令行可以指定任意合法 storyboard 文件。

### Task 2.2：实现主题 token 加载

- **位置**：`src/styles/`、`src/renderer/style-loader.ts`
- **内容**：加载 style ID、合并默认 token、校验 style 版本。
- **依赖**：Task 1.1
- **验收**：同一 storyboard 切换 style ID 后可以改变视觉 token，不改变内容结构。

### Task 2.3：实现 `statement` 模板

- **位置**：`src/templates/statement/`
- **内容**：支持标题、标签、注释、分阶段进入和结论强调。
- **依赖**：Task 2.1、Task 2.2
- **验收**：开场和结尾场景可渲染，标题和结论不会超出安全区。

### Task 2.4：实现最小 motion primitives

- **位置**：`src/motion/`
- **内容**：实现 enter、reveal、highlight、fade、slide 的确定性动作。
- **依赖**：Task 2.3
- **验收**：动作由 beat 驱动，不能通过自由文本触发未知行为。

### Task 2.5：实现 render CLI

- **位置**：`scripts/render-storyboard.mjs`
- **内容**：接受 storyboard 输入路径和输出路径，禁止覆盖其他项目输出。
- **依赖**：Task 2.1
- **验收**：`npm run render:storyboard -- <path> <output>` 输出合法 MP4。

### Sprint 2 验收

- 输入一个最小 storyboard，能够生成静音 MP4。
- 生成的视频可以从不同输出路径重复渲染。
- 相同输入、相同版本和相同素材下，结果在可接受范围内可复现。

## Sprint 3：Style Pack 与风格选择

**目标**：把固定主题变成可选择、可扩展、可渐进加载的风格系统。

### Task 3.1：定义 Style Pack schema

- **位置**：`schemas/style-pack.schema.json`、`src/schemas/style-pack.ts`
- **内容**：定义 token、motion、template support、preview、font provenance 和 status。
- **依赖**：Sprint 2
- **验收**：内置风格都能通过 schema 校验。

### Task 3.2：建立 style index

- **位置**：`styles/style-index.json`
- **内容**：提供风格 ID、名称、情绪、适用内容、画布比例、支持模板和预览位置。
- **依赖**：Task 3.1
- **验收**：脚本能够列出风格并按内容类型筛选。

### Task 3.3：制作第一个 Style Pack

- **位置**：`styles/retro-zine/`
- **内容**：完成 preview、design、style tokens、motion tokens 和 provenance。
- **依赖**：Task 3.1
- **验收**：`retro-zine` 能渲染 Sprint 2 的同一份 storyboard。

### Task 3.4：制作第二和第三个 Style Pack

- **位置**：`styles/retro-windows/`、`styles/scatterbrain/`
- **内容**：确保三种风格在颜色、字体、材质、布局和动作语言上有明显差异。
- **依赖**：Task 3.3
- **验收**：三种风格都能完成开场、内容和结尾代表帧渲染。

### Task 3.5：实现风格候选预览工具

- **位置**：`scripts/list-styles.mjs`、`scripts/preview-styles.mjs`
- **内容**：读取 compact index，为候选风格生成或展示关键帧预览。
- **依赖**：Task 3.2、Task 3.3、Task 3.4
- **验收**：用户能在不加载所有完整 design.md 的情况下选择风格。

### Sprint 3 验收

- 用户可以查看至少 3 个风格候选。
- 选择不同风格后，同一 storyboard 可以生成不同视觉结果。
- 风格文件可以独立增加，不需要修改核心 schema。

## Sprint 4：通用视频模板与内容映射

**目标**：覆盖教学文档中的主要结构，不让项目退化为动画文字卡。

### Task 4.1：实现 `graph-explainer`

- **位置**：`src/templates/graph-explainer/`
- **内容**：节点、连接、draw、focus 和 highlight。
- **依赖**：Sprint 2
- **验收**：关系类内容能看出实体、关系和当前重点。

### Task 4.2：实现 `metric-grid`

- **位置**：`src/templates/metric-grid/`
- **内容**：指标卡、count、比较和结论聚焦。
- **依赖**：Sprint 2
- **验收**：数字变化具有明确语义，不只是数字滚动装饰。

### Task 4.3：实现 `interaction-flow`

- **位置**：`src/templates/interaction-flow/`
- **内容**：真实截图状态、replacement group、focus 和 camera-push。
- **依赖**：Sprint 2
- **验收**：至少两个真实状态之间存在明确的流程变化。

### Task 4.4：实现内容到视觉映射检查

- **位置**：`src/validation/mapping-validator.ts`
- **内容**：检查长 narration 是否有有效视觉 target、caption 是否与 beat 时间重叠、重要内容 layer 是否被 beat 触达，并校验模板语义要求。
- **依赖**：Task 4.1、Task 4.2、Task 4.3
- **状态**：已完成；映射质量问题默认给出 warning，模板结构缺失仍按 error 阻止。
- **验收**：长旁白无有效 target、caption 与 beat 不重叠、内容 layer 未被触达时可定位提示；现有示例通过校验。

### Sprint 4 验收

- 产品介绍、知识解释和数据说明各有一个可运行示例。
- 每个示例都能说明画面如何解释内容，而不是只展示装饰性动画。

## Sprint 5：Agent Skill 与示例生产流程

**目标**：让 Codex、Claude Code 等 Coding Agent 可以从输入文档带用户走完整流程。

### Task 5.1：编写根目录 `SKILL.md`

- **位置**：`SKILL.md`
- **内容**：说明适用边界、阶段门禁、风格选择、文件产物、命令和停止规则。
- **依赖**：Sprint 3、Sprint 4
- **验收**：Agent 能根据 Skill 找到下一步需要读取的 references，而不必一次读取全部文件。

### Task 5.2：编写风格选择 reference

- **位置**：`references/style-selection.md`
- **内容**：候选筛选、预览、用户选择和选中后加载完整设计规范。
- **依赖**：Sprint 3
- **验收**：风格选择阶段不会提前生成最终 storyboard 或渲染全片。

### Task 5.3：编写生产、schema 和 QA references

- **位置**：`references/production-pipeline.md`、`references/storyboard-schema.md`、`references/review-checklist.md`
- **内容**：沉淀三个教学文档中的生产判断、映射规则、时长 fallback 和 QA。
- **依赖**：Sprint 4
- **验收**：规则与 runtime 能力一致，不写入未实现的模板或动作。

### Task 5.4：实现项目初始化脚本

- **位置**：`scripts/init-project.mjs`
- **内容**：创建 `projects/<video-id>/` 及生产层基础文件。
- **依赖**：Task 5.1
- **验收**：初始化后可直接放入 source 并开始 Stage 01。

### Task 5.5：准备三个公开示例

- **位置**：`examples/article-video/`、`examples/product-demo/`、`examples/data-explainer/`
- **内容**：每个示例包含 source、storyboard、asset manifest、style 和输出说明。
- **依赖**：Sprint 4、Task 5.4
- **验收**：不包含个人私有产品、未授权图片、真实密钥或不可公开的音频。

### Sprint 5 验收

- Codex 和 Claude Code 都能通过仓库中的 `SKILL.md` 理解使用方法。
- Agent 可以从 Markdown 示例生成或修改一个项目层 storyboard。
- 示例不依赖当前作者机器的绝对路径。

## Sprint 6：音频预留与可选集成

**目标**：保持默认静音生产，同时允许用户在后续提供音频数据。

### Task 6.1：定义 audio config

- **位置**：`schemas/audio-config.schema.json`、`references/audio-integration.md`
- **内容**：定义 voiceover、captions、music、sfx 的路径、启用状态、音量和来源。
- **依赖**：Sprint 5
- **验收**：没有音频时不会阻塞静音渲染。

### Task 6.2：实现字幕读取和安全区

- **位置**：`src/audio/`、`src/layers/captions/`
- **内容**：读取 SRT/VTT，显示整句字幕，并为横屏和竖屏保留独立安全区。
- **依赖**：Task 6.1
- **验收**：长字幕会按语义和标点切分，不覆盖关键图表和截图。

### Task 6.3：实现音频时长校准入口

- **位置**：`scripts/inspect-audio.mjs`、`src/timeline/`
- **内容**：读取音频时长和字幕最后时间，生成 timing report。
- **依赖**：Task 6.1
- **验收**：音频存在时，报告明确指出是否需要重算 storyboard 时间轴。

### Task 6.4：保留外部 TTS 接口

- **位置**：`references/audio-integration.md`
- **内容**：记录用户可以自行使用 Qwen3-TTS、VoxCPM2、云端 TTS 或真人录音，但核心项目不内置供应商。
- **依赖**：Task 6.3
- **验收**：文档不保存密钥，不暗示未验证的供应商集成已经可用。

### Sprint 6 验收

- 静音输入仍能正常渲染。
- 用户提供 voiceover 和 captions 后，可以生成带音频的 pilot。
- 音频时间测量结果能够影响 scene duration，而不是只把音频叠加到原视频。

## Sprint 7：QA、文档和发布准备

**目标**：让外部用户能够安装、运行、理解限制并提交问题。

### Task 7.1：完善抽帧和 contact sheet

- **位置**：`scripts/extract-review-frames.mjs`
- **内容**：抽取开场、中段、关系场景、交互场景、转场和结尾代表帧。
- **依赖**：Sprint 4
- **验收**：20 秒以上视频默认生成至少 6 个有意义的检查帧。

### Task 7.2：完善输出元数据检查

- **位置**：`scripts/inspect-output.mjs`
- **内容**：检查输出时长、分辨率、fps、音频轨和文件大小。
- **依赖**：Sprint 2
- **验收**：输出报告不把编码成功等同于视觉质量通过。

### Task 7.3：建立 CI

- **位置**：`.github/workflows/ci.yml`
- **内容**：执行 schema 校验、Style Pack 校验、测试、lint、typecheck 和最小示例构建。
- **依赖**：Sprint 1、Sprint 3、Sprint 5
- **验收**：Pull Request 中的无效 storyboard、缺失 style 或类型错误会失败。

### Task 7.4：整理安装和贡献文档

- **位置**：`README.md`、`CONTRIBUTING.md`、`docs/`
- **内容**：补充安装、Style Pack 开发、模板开发、素材授权、问题排查和发布说明。
- **依赖**：Sprint 5、Sprint 6
- **验收**：第三方开发者可以新增一个 Style Pack，而不需要了解全部 renderer 内部实现。

### Sprint 7 验收

- 新用户可以从 README 完成第一个示例。
- CI 能在干净环境运行。
- 所有公开示例都能通过验证和最小渲染。

## 11. 测试与验证策略

### 11.1 单元测试

- schema 解析。
- style token 合并。
- 时间轴计算。
- 中文阅读时长 fallback。
- beat 和 caption 边界。
- asset 路径解析。
- capability manifest。
- 音频时长报告。

### 11.2 集成测试

- 一个最小 storyboard 从 JSON 到 Remotion composition。
- 每个 Style Pack 至少渲染一个 `statement` 场景。
- 每个模板至少有一个 fixture。
- 缺失素材、未知 action 和越界时间会阻止渲染。
- 同一 storyboard 切换 style 后仍保持场景数量、时长和内容 ID。

### 11.3 视觉回归

每次修改共享 renderer 或 Style Pack 时，至少检查：

- 开场钩子。
- 普通内容场景。
- graph 或 interaction 场景。
- 转场中点。
- 结尾完成态。
- 移动端或竖屏代表帧。

首版可以使用人工检查 + 固定关键帧，后续再增加 snapshot 或像素差异检查。像素差异只能提示变化，不能替代完整播放。

### 11.4 完整视频验收

每支示例视频至少检查：

- 正常速度完整播放。
- 文字是否溢出。
- 重点是否按 beat 出现。
- 关系线是否连接正确。
- 截图是否为真实且有意义的状态。
- 场景交接是否有信息打架。
- 片尾是否完整停留。
- 手机正常大小下是否可读。
- 有音频时人声、字幕、BGM 是否同步和清晰。

## 12. 开源和许可证风险

- Remotion 的许可证和商业使用条件必须在实现前核对当前版本官方条款。
- 每个字体需要记录名称、来源、许可证和是否允许再分发。
- 每个背景纹理、图标、音乐和音效需要记录来源和使用权限。
- 示例产品截图必须是公开可用、用户提供或明确授权的素材。
- 不把教学文档原文、付费文章图片或受版权保护的资源直接打包进仓库。
- 不在 Skill、示例、日志和测试数据中写入 API key、Cookie、个人音频或隐私信息。
- 声音克隆只支持本人或明确授权的声音，项目文档需要明确提醒用户遵守适用法律和平台规则。

## 13. 主要风险与应对

### 风险 1：项目变成固定主题的代码复制

**应对**：第一阶段就把 style tokens、renderer map、preview 和 provenance 独立出来，并要求同一 storyboard 至少通过两种风格渲染。

### 风险 2：Style Pack 只改变颜色，用户看不出差异

**应对**：Style Pack 必须同时定义字体、表面、布局、动作和转场；Style Gallery 至少展示开场、内容和交接三类画面。

### 风险 3：AI 生成的 storyboard 仍然像 PPT

**应对**：保留“内容提炼 → 可见目标 → beat → caption”映射检查，优先使用 graph、metric 和 interaction 模板，禁止所有内容默认落到 title/bullets。

### 风险 4：模板数量增长过快导致维护困难

**应对**：MVP 只保留 4 个语义模板。新能力先进入 capability gap 清单，验证稳定后再纳入正式 schema。

### 风险 5：音频集成拖慢主线

**应对**：默认静音预览；音频只提供配置契约、字幕读取和时长校准入口，TTS 作为外部适配器。

### 风险 6：用户误以为编码成功就是质量通过

**应对**：把 validator、代表帧、完整播放和移动端检查写入 Skill 的交付规则，交付报告必须明确哪些检查已经完成。

### 风险 7：当前项目的个人资产污染开源仓库

**应对**：所有示例从公开、可授权、可替换的素材开始；禁止复制 Hresh、Tongliao 或其他真实项目中的私有内容作为默认示例。

## 14. 版本路线图

### v0.1：可运行核心

- Remotion 项目基线。
- storyboard schema。
- validator。
- `statement` 模板。
- 一个 Style Pack。
- 一个 Markdown → storyboard → MP4 示例。

### v0.2：风格选择

- `style-index.json`。
- 三个 Style Pack。
- 风格预览脚本。
- `SKILL.md` 和风格选择 reference。
- 两个以上示例。

### v0.3：通用内容模板

- `graph-explainer`。
- `metric-grid`。
- `interaction-flow`。
- 素材 manifest。
- 真实截图状态检查。

### v0.4：音频预留

- audio config。
- SRT/VTT。
- voiceover 时长检查。
- 带音频 pilot。
- 音频 provenance 文档。

### v0.5：开源发布

- 完整 README。
- Claude Code 插件入口。
- Agent 无关安装方式。
- CI。
- Style Pack 贡献指南。
- 公开示例和质量报告。

### v1.0：稳定生态

- 稳定 schema 版本。
- Style Pack 版本管理。
- 模板扩展规范。
- 兼容性矩阵。
- 更好的预览和 QA 工具。
- 可选的 npm 包或独立 runtime 发布。

## 15. 第一批实现顺序

推荐不要一开始同时做所有模板和风格，按以下顺序推进：

```text
1. 项目基线和许可证
2. storyboard schema + validator
3. DataDrivenVideo + render CLI
4. statement + retro-zine
5. 一个完整 article-video 示例
6. style-index + 风格预览
7. retro-windows + scatterbrain
8. graph-explainer / metric-grid / interaction-flow
9. Agent Skill 和阶段门禁
10. 音频配置和字幕读取
11. QA、CI、贡献文档
12. 首次公开发布
```

第一条必须打通的垂直切片是：

```text
examples/article-video/source.md
    → projects/article-video/storyboard.json
    → validate
    → render
    → output/preview-silent.mp4
```

在这条链路稳定之前，不建议投入大量时间做风格画廊、在线编辑器或复杂音频集成。

## 16. 规划后的下一步

下一步建议进入 Sprint 0，但先保持文档驱动：

1. 根据本规划创建 `README.md`、`docs/MVP.md`、`docs/ARCHITECTURE.md` 和 `docs/TECH-STACK.md`。
2. 确认 Remotion 当前版本、许可证策略和 Node.js 支持范围。
3. 初始化最小 Remotion composition。
4. 定义第一版 storyboard schema。
5. 用一个最小示例完成 `validate → render`。

完成第一个垂直切片后，再决定是否需要调整 Style Pack 规范和模板边界。
