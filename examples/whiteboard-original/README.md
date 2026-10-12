# 好问题，从观察开始

FrameLoom 原创手绘白板公开样片，18 秒、16:9 横屏、30 fps、静音，使用小赖字体与 Your Brand 占位。文案、亲子人物及白板构图重新创作；演示观察细节、比较差异和提出问题。人物为虚构插画，不代表真实用户、产品界面或实际效果。

亲子画法参考用户认可的自然博物馆白板项目：圆润人物、粗黑轮廓、柔和配色。这里重新生成了戴眼镜的家长、拿放大镜的孩子和一盆植物，没有复制项目中的平板角色素材，也未把私有项目文件或品牌带入网页。

## 来源与生成

- 文案：[source.md](source.md)，FrameLoom 原创。
- 素材计划：[illustration-plan.json](illustration-plan.json)。
- 精确生图提示词：[illustration-prompts.json](illustration-prompts.json)；实际调用记录：[imagegen-requests.json](imagegen-requests.json)。使用原生 imagegen，要求真实透明背景；已查看人物完整性和文字缺失，再经 alpha 检查及字节指纹登记。
- 主体：[curious-family.png](assets/curious-family.png)；来源与登记：[asset-manifest.json](asset-manifest.json)。AI 输出使用受图片服务条款约束，不是实拍。
- 绘制方法：开放白板、Rough.js 双线、逐行擦出和单支铅笔参考 trustfuture/simon-skills，保留 [MIT 声明](../../references/licenses/simon-whiteboard-MIT.txt)。历史对照仍在 [whiteboard-reference](../whiteboard-reference/README.md)。

## 渲染

```bash
npm run validate:storyboard -- examples/whiteboard-original/storyboard.json --mode fast
npm run validate:assets -- examples/whiteboard-original/storyboard.json
npm run preview:illustrated -- --styles whiteboard
node scripts/prepare-style-covers.mjs
npm run build:library
```

[观看完整静音样片](../template-families/previews/whiteboard-original.mp4) · [查看实际完成态](../template-families/previews/whiteboard-original.png)。布局实测记录在 `whiteboard-original.layout-qa.json`；自动 QA 不替代全片播放复核。批注推演与编辑式排印的[同文案对照](../text-led-video/README.md)沿用本样片标题、完整旁白、画面文字及亲子观察情境，使用各自文案动画；旧彩色手绘与像素笔记的[历史素材](../illustrated-video/README.md)保留兼容。生产继续使用用户自己的文档，样片主题不成为系统默认讲稿。
