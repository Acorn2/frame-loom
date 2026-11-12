# 编辑讲解、机制图解与产品实演

三项正式、experimental 的 2.4 配方来自已确认的设计方向。它们使用静态注册的生产 renderer，不读取 `designs/` 的试片组件或示例专用代码。

| 用途 | 风格 | 配方 | 当前画幅 |
| --- | --- | --- | --- |
| 文章、观点、来源与数据对照 | `retro-zine` | `editorial-explainer@1.2.0` | 16:9 |
| 系统、原理、流程、局部确认 | `signal-noir` | `mechanism-map@1.2.0` | 16:9 |
| 产品说明、功能教程、真实界面取景 | `studio-frame` | `product-showcase@1.2.0` | 16:9 |

## 正常制作入口

先读来源材料，再查询兼容清单和初始化。三项均属于原六套的可选镜头池，不改变三套 AI 插画风格的固定流程：

```bash
npm run init:project -- --slug editorial-explainer --style retro-zine --shots editorial-explainer --font source-han-serif-sc
npm run list:shots -- --style signal-noir --canvas landscape
npm run init:project -- --slug mechanism-explainer --style signal-noir --shots mechanism-map --font source-han-sans-sc
npm run init:project -- --slug product-demo --style studio-frame --shots product-showcase --input-mode document-images --font source-han-sans-sc
```

初始化只创建待编排文件。用户视频继续从 `scene-plan.json` 写来源、旁白、画面意图和观众所得，导出讲稿与审阅表后再写正式分镜。Agent 可根据材料推荐更合适的组合；明确限定的手动集合仍是严格白名单。

## 配方契约

第一内容槽位完整显示标题；所有文字和图形都有唯一槽位、真实内容与几何。位置使用 1920×1080 基准，内容在 x=120..1800、y=96..850 范围内，字幕留在独立安全区，字体跟随全片选择。

机制图解由 `composition` 标注分层、总览路径、时间轴、确认门或收束。实际关系放入 `scene.connections`；端点侧和折点放入 `routes`。两端入场后才画线，不能因画面需要而编造关系。

产品实演至少展示一张本地真实截图；`crop` 使用原图归一化坐标。`focus` 绑定唯一动作、目标图层和目标取景；读取原图真实尺寸，保持比例并完整展示声明区域。`verticalDelay` 同步延后竖向位置与高度变化，避开标题且不让下沿提前进入字幕区。编译会检查每个取景运动帧的内容框边界与遮挡，实际渲染继续执行文字、节点与图片 QA。

配色遵循现有项目配色流程，真实界面保留原像素。不得用生成的界面代替产品证据；不把配方库描述成在线编辑器。旁白、TTS、字幕和最终交付沿用原生产与审核规则。

编辑讲解使用来源主栏、解释旁栏及显式图表。`items` 绑定文字／图表标题，`metrics` 绑定原始数值与统一单位。柱高从实际值及数轴计算，原值标签不做四舍五入；非零起点须给出可见说明。重标尺在数据落定后通过 `focus` 连续改变同一批数据的显示尺度，不更换或改写数据。内容范围为 y=100..850；当前只支持非负条形图，数轴边界最多两位小数。完整契约见[编辑讲解配方](../shots/editorial-explainer/recipe.md)。

## 公开样例与复现

`examples/shot-recipes/editorial-explainer/`、`examples/shot-recipes/mechanism-map/` 与 `examples/shot-recipes/product-showcase/` 的分镜是可替换内容的生产夹具，带来源文档、讲稿与素材登记；产品截图记录的是捕获时版本。正式样片集中在 `examples/scenario-directions/previews/`。

```bash
npm run preview:directions
```

该命令使用正式 `StoryboardV2`、生产锁、素材/文字预检、Chromium 实测、视频检查和自动 QA 生成公开静音样片，同源封面从已检查视频解码取得。已有输出须输入匹配；显式 `--force` 只重建所选公开产物。它不产生画面底片交付批准或有声交付批准。

新 ID 不改变旧 renderer、旧镜头版本、旧风格或既有竖屏能力。新配方未声明的画幅和组合报错，不静默替换。配方库对风格的归组只改变浏览入口，旧链接、ID 与生产输入继续使用原契约。
