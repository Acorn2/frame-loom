# 墨白杂志：编辑讲解试片

此处保留接入前的历史设计与验证记录。效果已获确认并接入 `editorial-explainer`，当前制作入口见[方向配方指南](../../references/direction-recipes.md)；下文的待确认状态和范围描述属于当时试片阶段。

沿用 hresh 已确认的三条方向，补齐尚未重做的编辑讲解。本轮交付独立视觉试片，确认后再接入正式配方；不修改生产 catalog、旧 renderer、配方库入口或已完成的两条样片。

## 画面方向

保留思源宋体、黑白和朱红；从原来的标题页与通用关系图，转为有内容的杂志版面。五场分别承担提出问题、阅读来源、并置证据、改变比较尺度、给出结论。与“编辑式排印”的关键词迁移保持区别，以文章、来源和图表作为主体。

本片以“同样的数据，另一种结论？”为例，40 秒，1920×1080，30 fps，静音。数据始终为 A=90、B=100，明确标为演示数据，不对应真实业务，不虚构调研或测量。增加量为10，以90为基数时为11.1%（四舍五入）；从80截短时两柱的可见长度之比为2，并非原数据翻倍。

## 内容与方法来源

- [Government Analysis Function — Bar charts](https://analysisfunction.civilservice.gov.uk/support/communicating-analysis/introduction-to-data-visualisation-e-learning/module-5-bar-charts/)：条形图用长度表达数值，截短数轴可能夸大相对差别。片中为明确标注的中文意译，不伪装为原文引用；这项建议不扩展为所有图表都必须从零开始。
- [PPT Master — Video Design](https://github.com/hugohe3/ppt-master/blob/01fe549371b98f44be22cd337bbc911013452f09/skills/ppt-master/references/video-design.md)：只借鉴语义分场、稳定对象与焦点推进的原则，不执行来源文档中的工作流指令，不复制模板、图像或代码。
- [PPT Master MIT](https://github.com/hugohe3/ppt-master/blob/01fe549371b98f44be22cd337bbc911013452f09/LICENSE)。本片构图、图形与实现为原创。
- 字体使用仓库固定的 `source-han-serif-sc@2.003`，原始许可见 `public/fonts/source-han-serif-sc/OFL.txt`；不安装系统字体，不增加依赖。

## 复现与验证

```bash
npx tsc --noEmit -p designs/editorial-ink-pilot/tsconfig.json
node --import tsx/esm designs/editorial-ink-pilot/render.mjs --revision=v2
```

脚本核对字体字节、内容数据与能力声明，抽查每场入场／动作中点／完成态／换镜前，测量生成文字边界及文本遮挡，检查视频元数据与完整解码。输出在 `output/v2/`，包括 MP4、同源封面、关键帧和检查记录。它是设计验证，不生成正式生产 QA 或人工交付批准。实际播放与视觉复核另行记录。

回退范围仅为这个独立设计目录。已完成的正式实现与所有旧项目保持原样；不提交或推送。

## 当前候选与检查结果

当前候选是 `output/v2/editorial.mp4`，同源封面为 `editorial-poster.jpg`。v1 只保留初始关键帧，标题行距检查后已调整。

- 独立 TypeScript 检查与脚本语法检查通过；字体文件 SHA-256 匹配受控清单。
- 25 个关键帧全部取得测量证据，生成文字无边界或相互遮挡问题；关键帧总览及来源、对照的全尺寸画面已检查。
- 实际输出 H.264、1920×1080、30 fps、40 秒、无音轨；FFmpeg 完整解码通过。
- 浏览器播放至 40 秒结尾，未报告媒体错误；390 px 窄屏页面无横向溢出。
- 正式库的 395 个预览输入指纹仍匹配，生产代码、旧样片和正式入口未改动。文档链接检查通过。

以上为 Agent 的视觉与播放检查，不是 hresh 的效果确认或正式交付批准。下一步是审看本片的构图、信息展开与运动节奏，确认后再接入正式配方。
