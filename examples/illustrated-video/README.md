<!-- Historical fixtures retain their exact media and contracts. -->

> 当前风格库第二、第三主风格已替换为批注推演与编辑式排印，正式分镜见[文案动画示例](../text-led-video/README.md)。下文彩色手绘与像素笔记的素材、提示词和样片保留作旧项目兼容与方法回归。

# 历史插画风格与六镜头示例

三套目录分别保存来源、严格素材计划、imagegen 提示词、实际 PNG、来源登记、独立镜头与42秒能力分镜。人物为虚构角色，能力分镜中的数字仅为三份示意资料的计数。

纯文档生成主体与字体、文字、连接分别编排；流程见 [插画生产](../../references/illustrated-production.md)。人物和物件均按各自媒介实际生成并登记，文字与关系由 renderer 绘制。

```bash
npm run render:storyboard -- examples/illustrated-video/flat-explainer/storyboard.json /tmp/flat-explainer.mp4 --mode fast
npm run validate:assets -- examples/illustrated-video/flat-explainer/storyboard.json
```

## 历史三风格同文案对照

本目录保留的18秒对照样片统一为「好问题，从观察开始」，均为18秒横屏静音预览。标题、完整旁白文本、画面文字和亲子观察植物的情境一致，画法、构图与动效按各自媒介编排。Whiteboard 使用[原创亲子观察示例](../whiteboard-original/README.md)的一张开放白板；Flat 与像素笔记使用各自的 `curiosity.json`，分为情境、三个步骤、结论三场。

共同旁白文本：好问题，从观察开始。先看清细节，再比较差异，最后把疑问说出来。一起观察，也一起提问，把好奇变成自己的发现。

共同画面文字：一起观察，也一起提问；看见细节／先看清楚；比较差异／找出不一样；提出问题／问一句为什么；把好奇，变成自己的发现。

[手绘白板](../template-families/previews/whiteboard-original.mp4) · [彩色手绘](../template-families/previews/flat-explainer-illustrated.mp4) · [像素笔记](../template-families/previews/paper-collage-illustrated.mp4)。后两套新亲子插画以公开白板人物作角色参考，通过原生 imagegen 生成并登记；实际调用提示词见 [彩色手绘](flat-explainer/curiosity-imagegen-request.json)／[像素笔记](paper-collage/curiosity-imagegen-request.json)。

```bash
npm run preview:illustrated -- --styles flat-explainer,paper-collage
npm run validate:assets -- examples/illustrated-video/flat-explainer/curiosity.json
```

布局实测记录保存在对应 `<style>-illustrated.layout-qa.json`。这些样片没有配音，音频继续使用现有生产入口；自动 QA 不替代全片播放复核。

此历史对照中的第二、第三风格分别为「彩色手绘讲解」与「像素讲解笔记」，内部 ID 沿用 `flat-explainer`、`paper-collage`。彩色手绘仍引用 `*-v2.png`；像素讲解笔记引用实际 imagegen 生成并检查的 `*-pixel.png`，当前素材计划、提示词和来源清单已更新。旧剪纸图片和 `*.cut-paper-v2.json` 留作历史比对。像素主体按块显现、强调轻闪一次，中文由独立所选字体显示。

## 六镜头能力示例

两套 `storyboard.json` 能力分镜保留「零散资料如何变成清晰讲解」的文案与六种语义镜头，各自保留已登记的漫画／像素素材，作为配方回归输入。彩色手绘使用大幅主体、有机舞台、环绕说明与横向流程；像素笔记使用紧凑主体、阶梯模块、纵向条目与直角连接。主体标签与正文沿用所选字体，不把像素风格绑定到像素字。

[主体、对照、流程完成态对比](../template-families/previews/illustrated-style-comparison-01.png) · [解释、拆解、指标完成态对比](../template-families/previews/illustrated-style-comparison-02.png)。对比图来自之前42秒能力分镜的实际 renderer，左侧为彩色手绘，右侧为像素笔记；当前风格库主样片见[原创白板](../whiteboard-original/README.md)与[文案动画](../text-led-video/README.md)。


像素主题示例：[懂了很多，生活没变](paper-collage/knowledge-change.json)，21 秒静音预览位于 `examples/template-families/previews/pixel-notes-knowledge-change.mp4`。实际调用的提示词保存在 [imagegen-requests.json](paper-collage/imagegen-requests.json)，使用原生 imagegen；读书人物由先行提示词生成，另两张物件按准备后的完整提示词生成。当前登记仍绑定素材计划、规范和图片字节，历史剪纸登记单独保留。
