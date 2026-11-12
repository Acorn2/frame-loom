# 按使用场景展示的正式样片

| 样例 | 分镜 | 输出 |
| --- | --- | --- |
| 编辑讲解：同样的数据，另一种结论？ | [editorial/storyboard.json](../shot-recipes/editorial-explainer/storyboard.json) | [40秒静音样片](previews/editorial.mp4) |
| 机制图解：从反馈到新版本 | [mechanism/storyboard.json](../shot-recipes/mechanism-map/storyboard.json) | [40 秒静音样片](previews/mechanism.mp4) |
| 产品实演：从选型到制作 | [product/storyboard.json](../shot-recipes/product-showcase/storyboard.json) | [40 秒静音样片](previews/product.mp4) |

三条均由正式注册的生产 renderer 生成，1920×1080、30 fps，无音轨。封面取自相同实际视频；不是独立设计组件或重画的展示图。

机制内容来自 FrameLoom 的公开审片与返工流程。时间码和场景编号为示意，不是实测生产记录。产品使用真实配方库截图，界面为素材捕获时版本；来源与字节指纹见[捕获记录](../shot-recipes/product-showcase/capture-sources.json)，显示媒体见[素材登记](../shot-recipes/product-showcase/asset-manifest.json)。字体沿用仓库受控的思源黑体与 SIL OFL 许可。

两项配方目录中的 `source.md`、`script.md` 和 `storyboard.json` 是公开配方夹具。新用户生产仍通过 Skill 初始化项目并编写版本化逐场计划，不能把夹具直接当作任意材料的完整成片。

通过 `npm run preview:directions` 复现，见[配方指南](../../references/direction-recipes.md)。自动 QA 和完整播放检查结果另见[接入记录](../../references/scenario-directions-integration.md)；样片没有人工交付批准。

方法参考 PPT Master 的蓝图、产品发布与语义动画规范。FrameLoom 的图形和代码原创，不复制其模板、图标、图片或字体；上游链接与许可记录在两项配方的 `provenance.json`。

编辑讲解的规则依据为英国 Government Analysis Function 的条形图指南；片中中文为意译，90和100为演示数据，不代表任何业务测试。数值、来源与计算说明见[来源材料](../shot-recipes/editorial-explainer/source.md)，原设计确认稿保留在 `designs/editorial-ink-pilot/`，正式播放入口使用公开配方。
