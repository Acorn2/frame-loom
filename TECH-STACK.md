# Tech Stack

本地风格与镜头配方库使用原生 HTML/CSS/ES modules 与 Node.js 静态文件服务，不新增依赖。构建时从既有 catalog 输出 JSON 和公开媒体；Remotion 复用同一打包生成配方样片。三个独立 HTML 页面使用相对链接、共享 CSS 与 ES module，支持 GitHub Pages 子路径。浏览器存储保存风格、镜头选择和样片播放位置，不要求填写文档路径；禁用存储时 URL 参数仅携带公开选择。导出逻辑与 DOM 分离，Vitest 覆盖兼容性、制作路由、公开TTS元数据与媒体请求。

公开页面使用 GitHub Pages + Actions 静态 artifact 发布，生成产物不提交到 Git。独立工作流固定 Ubuntu 24.04 / Node.js 24，安装 FFmpeg、Noto CJK 和 Liberation 字体；预览以输入指纹缓存，发布构建检查全部图片与动画完整性。没有增加项目 npm 依赖或运行时后台。

- Node.js 24+（推荐 Node.js 24 LTS）、TypeScript、React 和 Remotion 负责本地确定性画面渲染；CI 与 Pages 工作流统一使用 Node.js 24。
- Zod 定义并导出 JSON Schema；Vitest 运行分镜契约测试；ESLint 与 TypeScript 检查代码。
- FFmpeg/ffprobe 用于媒体检查、抽帧和音频测量。
- Remotion 的确定性逐帧计算用于入场与转场；FFmpeg `silencedetect` 用于有声成片的片尾检查。
- Style Pack 是项目内 JSON 配置；2.3 语义构图使用现有运行时，不引入新渲染服务或依赖。

核心验证命令见 `AGENTS.md` 和 `package.json`。新增语义画面可运行 `npm run preview:semantic -- --output <new-directory>` 检查全部 Style Pack。

本轮没有新增运行时服务或依赖。Vitest 固定为 4.1.11；语音缓存使用 Node.js 文件与 SHA-256，真实时长来自现有 ffprobe。字幕精确时间暂采用人工 cue，不内置强制对齐模型。


2.4继续使用现有React/Remotion/Zod/tsx；shot与video-template为仓库内JSON，不增加运行时依赖或加载任意代码。`init:project --style ... --shots ...` 通过既有tsx读取类型契约并保存用户的配方集合，`list:shots` 查询实际兼容能力，`validate:shots` 与 `test:shots` 覆盖新注册能力。生产锁使用Node.js原生SHA-256与文件快照。

清单增量沿用现有依赖；新标题、矩阵和层级组件使用 DOM/SVG 与纯帧函数，不复制上游 `_fixtures`、假UI、私有页面或媒体；48项台账为本地 JSON。宿主动作使用单独严格契约并绑定 SHA-256 生产指纹。

P1扩展仍不添加依赖：浏览器 `document.fonts.ready` 与DOM测量标题基线/最长词；Remotion纯帧函数驱动滚轮、翻面和换章；SVG互补裁切不复制场景DOM。宿主动作、换章与场景各有独立JSON Schema和SHA-256锁。

本轮镜头动效重做复用Remotion内置Easing/spring，不新增依赖。每帧只从frame、beat与纯几何计算状态；字体测量仍经document.fonts.ready及delayRender绑定。浏览库使用原生video、IntersectionObserver与prefers-reduced-motion，继续输出相对路径静态站点。

当前镜头视觉继续使用现有DOM/CSS/SVG：白色/冷灰/石墨画布、细网格、柔和阴影、透视卡片与纯帧运动；强调色与字体由现有Style Pack提供，无新增依赖、远程字体或图片素材。独立的历史1.1渲染快照保持精确版本解析；Vitest覆盖深浅背景、正文与字幕对比度、字幕跨镜切换和历史兼容。

制作向导仍使用原生radio/select/details和既有ES module，无新增依赖或生产API。公开TTS元数据在build-library阶段从已校验样例提取，浏览器仅保存公开选项；测试覆盖四预设、外部旁白、静音底片、先审分镜、过期选项与元数据字段白名单。

TTS 配置使用既有 Zod 与导出的 JSON Schema，不新增服务商 SDK；Node.js fetch 继续只访问官方 HTTPS 主机。试听复用适配器与 ffprobe，最终采样率由既有 FFmpeg 混音设置处理。回归测试使用模拟 HTTP 响应和本地音频，真实账号、音色权限与听感需要显式在线试听。

P2 继续使用现有 React / Remotion / Zod；SVG 滤镜与确定性闭式粒子不引入新运行时依赖。

六套风格差异化仍使用现有React/Remotion、CSS与SVG，不增加依赖或远程字体。中文标题分别显式选择宋体、楷体及无衬线字体栈，使用已安装的系统字体和Noto回退；未打包字体，不保证不同系统的字形完全一致。标题采用平衡换行，渲染与预检共享字体适配及槽位尺寸。

## 横屏风格与镜头自由组合

跨风格镜头继续使用现有静态 renderer、Zod 校验及 Remotion，不新增依赖。公开样片生成覆盖 53 个示例 × 6 套风格，构建复制对应媒体并检验完整性。深色原生画布依据背景亮度确定文字颜色。

独立字体选择使用浏览器原生 FontFace/FontFaceSet 与现有 Remotion delayRender，不新增运行时依赖。思源黑体／宋体使用官方 CN 可变 WOFF2，霞鹜文楷使用官方 Regular/Medium TTF；得意黑使用官方 WOFF2，小赖字体使用比例版 Regular TTF。清单固定版本和 SHA-256，保留 SIL OFL 1.1。DOM.Iterable 补全 FontFaceSet 的标准集合方法类型。网页字形示例与 renderer 共用项目字体文件，字重映射在清单记录；组合样片由同一正式 composition 生成。

镜头自动/手动入口沿用原生radio与ES module，选择方式随既有localStorage/URL保存，无新增依赖或生产API。Agent承担文档语义推荐；Node.js共享预检仅做重复率与标题停留警告，复用现有分镜时间线，不改生产schema或renderer。

## 项目配色

继续使用 TypeScript/Zod、Node.js 原生文件与 SHA-256、既有 FFmpeg/ffprobe、原生页面控件，无新增依赖、服务或环境配置。Agent 处理素材语义，sample:palette 对显式区域输出像素候选；palette 1.1 保存完整颜色角色与采样／推导证据，固定区域候选由本地 FFmpeg 重采样核对；纯函数采用来源色并调整前景对比度。新初始化启用 source-roles-v1，旧 1.0 保持原行为。palette/usage/colorMode 为显式可选契约，历史输入缺字段不迁移。截图采集由 Agent 的可用浏览器执行，不成为 renderer 的网络依赖。

## 横竖屏镜头扩充（2026-10-09）

新增 type-and-filter、ai-stream-response、unit-dot-regroup；六套风格、16:9和9:16共用严格内容契约与独立画幅布局。当前40个横屏场景、4个竖屏场景；原专用配方不自动扩展画幅。搜索结果、任务状态与点阵总数均由输入给定，预检拒绝不一致数据和错误时序。公开库按风格×画幅读取实际样片，旧画幅/版本不迁移，不新增依赖；竖屏素材配色仍保持原限制。范围、验收与验证见[接入记录](references/shot-expansion-20261009.md)。

## 内容布局验证

复用React/Remotion、Chromium的DOM Range、Canvas字体墨迹测量及现有Vitest；不新增依赖。共享TypeScript布局函数提供确定性区域和节点边界，渲染器在同帧加载字体和图片后记录布局证据，Node端在候选发布和QA时校验。回归入口 `npm run test:content-layout`，完整矩阵使用 `--all`；见[布局契约](references/content-layout.md)。
