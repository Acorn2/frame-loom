# 机制图解与产品实演：设计试片

此处保留接入前的历史设计与验证记录。效果已获确认，正式配方及当前制作入口见[方向配方指南](../../references/direction-recipes.md)；下文的待确认状态和范围描述属于当时试片阶段。

状态：设计试片，待 hresh 观看确认；不是正式配方、生产功能或交付批准。

## 范围与选择

2026-11-12 用户确认先参考 PPT Master，重做机制图解和产品实演的代表样片。
本轮使用仓库已有 Remotion、思源黑体和 SVG/CSS 能力，不新增依赖，不改风格 ID、生产 renderer、配方库或中英文 README，不调用音频服务。
独立入口只服务设计验证；通过后再将必要构图收敛为受控、版本化的生产配方，不能把本试片入口当作生产流程。

## 输入 → 处理 → 输出

- 机制图解：根 README 和 `references/usage-guide.md` 的时码审片、镜头返工流程 → 原创流程图、局部展开、确认门与路径动画 → 40 秒横屏静音试片。
- 产品实演：本仓库配方库的真实网页状态截图 → 保留界面原貌的构图、取景与状态切换 → 40 秒横屏静音试片。
- 输出：两个 1920×1080、30 fps MP4，同源封面、逐场联系表、可播放对比页、素材来源和检查记录。

## 视觉决策

- 机制图解：石墨中性底、稀疏工程网格、细线、显式锚点和一条当前路径。结构决定构图；保留整体定位再展开局部，不用等宽卡片排满全片。
- 产品实演：来源界面的白/冷灰底与蓝色强调、真实界面占主要画面、少量大字解释。全部截图均是实际状态，不重画虚构界面，不将在线配方库描述为在线视频编辑器。
- 全片使用已固定版本的思源黑体；动效只承担进入、揭示、画线、聚焦、强调和取景，均在现有能力声明范围内。
- 静音设计片不铺旁白字幕；屏幕文字是画面内容。时间码与场景编号示意会显式标注。

## 参考与来源边界

参考 PPT Master `01fe549371b98f44be22cd337bbc911013452f09`：

- [Blueprint](https://github.com/hugohe3/ppt-master/blob/01fe549371b98f44be22cd337bbc911013452f09/skills/ppt-master/references/visual-styles/blueprint.md)：图解组织页面，工程标注承担解释。
- [Product Launch](https://github.com/hugohe3/ppt-master/blob/01fe549371b98f44be22cd337bbc911013452f09/skills/ppt-master/templates/styles/product-launch/templates/design_spec.md)：真实行为和产物支撑功能主张。
- [Video Design](https://github.com/hugohe3/ppt-master/blob/01fe549371b98f44be22cd337bbc911013452f09/skills/ppt-master/references/video-design.md)：保留定位线索、按语义推进焦点。
- [MIT License](https://github.com/hugohe3/ppt-master/blob/01fe549371b98f44be22cd337bbc911013452f09/LICENSE)。

只借鉴表达原则；代码、流程图与构图在本目录原创。不复制对方模板、品牌素材、照片、图标或字体。
机制流程以 FrameLoom 当前公开文档为依据；示意时间和场景编号不表示某个实际生产项目的测量值。
网页截图只来自本仓库公开配方库；捕获信息和文件指纹见 `assets/sources.json`。
字体沿用 `fonts/font-index.json` 的 `source-han-sans-sc@2.005` 及其 SIL OFL 许可。

## 验收与后续

1. 两条片的结构、节奏与素材角色清楚不同，不靠换颜色制造差别。
2. 逐场检查入场、完整态、切换前和转场；重要文字无裁切，截图重点可读。
3. 检查真实 MP4 尺寸、帧率、时长、无音轨与全片解码；浏览器检查实际播放。
4. 样片由同一入口生成封面；保存输入、输出 SHA-256 与检查结果，不伪造生产 QA 或人工批准。
5. hresh 确认效果后，才规划正式配方、兼容性测试及配方库/README 调整。

本轮回退边界是整个独立设计目录；现有生产路径和公开入口不改动。

## 复现与查看

在仓库根目录执行，沿用仓库依赖；`--revision` 使用尚不存在的新版本，避免覆盖已审看的输入或视频：

```bash
npx tsc --noEmit -p designs/video-directions-pilot/tsconfig.json
node --import tsx/esm designs/video-directions-pilot/render.mjs --revision=v5
```

`--phase=stills` 只生成关键帧；同一输入下可随后用 `--phase=video` 编码视频。脚本核对截图与字体字节、现有能力声明、生成文字边界、视频元数据和全片解码；检查记录名为 `study-checks.json`，不生成正式生产 receipt 或批准记录。

当前候选为 `output/v2/mechanism.mp4` 与 `output/v4/product.mp4`。产品 v3 将用于特写的真实界面换为三倍像素密度的原生网页捕获，来源记录为 `assets/sources-3x.json`；没有使用图像放大滤镜或合成界面。v4 延后取景动画的向上运动，保证中间态不擦过标题。
`output/v1/` 保留初次关键帧检查，未生成整片；`output/v2/product.mp4` 保留特写清晰度检查前的试片。视频、封面与联系表保存在本地设计目录，`output/` 不进入 Git。
`index.html` 是独立试片观看页，修改候选版本时同时更新其中的路径。捕获界面使用本仓库构建的本地配方库；来源清单中的公开网址只作产品来源参考。
