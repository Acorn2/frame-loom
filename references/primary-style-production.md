# 三套 AI 插画风格的固定制作流程

[文档导航](README.md) · [使用指南](usage-guide.md) · [插画生产](illustrated-production.md)

用户选择风格、全片字体、画幅、成品用途与配音，提供文档或文档加图片；镜头由风格自带，不开放镜头集合选择，也不要求用户确认推荐集合。

| 风格 | 固定内置镜头范围 |
| --- | --- |
| 手绘白板 `whiteboard` | `whiteboard-board`，开放白板、单笔书写、贴纸与明确关系 |
| 批注推演 `annotated-reasoning` | `annotated-manuscript`，正文、圈词、划线、旁注与关系；`semantic-default` 展示真实截图 |
| 编辑式排印 `editorial-typography` | `editorial-flow`，同一批文字随明确阶段连续重排；`semantic-default` 展示真实截图 |

内置范围由 `library/style-policy.mjs` 统一维护，页面和初始化共用。固定指镜头体系，不固定文案、场景数或旁白时长。Agent 根据来源编排，不凭空添加关系。两套文案镜头让文字和图解主导，插画声明框总面积最多占画布8%，严格字段、阶段与示例见[文案动画制作](text-led-production.md)。

```bash
npm run init:project -- --slug whiteboard-test --style whiteboard --font xiaolai
npm run init:project -- --slug annotated-test --style annotated-reasoning --font source-han-serif-sc
npm run init:project -- --slug editorial-test --style editorial-typography --font source-han-sans-sc
```

初始化自动填入当前精确版本的内置范围，创建空的 2.4 编排草稿；不代表已生成讲稿、素材或视频。主风格不接受手动缩小或扩大 `--shots`；等于完整内置范围的参数保留内部兼容。全片字体继续独立选择。

风格库隐藏这三套的镜头选择步骤与镜头导航，不展示空的手动集合；配方卡片和详情只供查看。旧 localStorage 或链接中的主风格手动集合会清除并归入固定流程，不能阻止复制制作指令。原六套的自动推荐、显式手动集合和兼容性校验保持原有行为。

纯文档实际生图与来源登记仍按[插画生产](illustrated-production.md)执行，截图路线使用真实图片。有声同步和时间提案按[语音生产](speech-driven-production.md)执行。旧分镜、历史配方能力和已生成项目不批量迁移；review / fast 的审核规则不变。

旧 `flat-explainer`、`paper-collage` 从新选择入口隐藏，已有项目的六个插画镜头、素材登记和渲染路径保留。

三套风格均有右上角品牌标识，名称和本地 Logo 由仓库／项目 `config.json` 统一控制，视频和同源封面共用。制作页可填品牌名，配置、预留区域及审核行为见[品牌标识](branding.md)。
