# 批注图解与情境叙事正式样片

两条 30 秒、1920×1080、30fps 静音样片，复用 hresh 确认的原创插画，以正式配方重新渲染。相同主题、旁白文本及字幕见两个 storyboard。手绘白板保持原版。

- [批注图解](previews/annotated.mp4)：[分镜与来源](../shot-recipes/annotated-image/)
- [情境叙事](previews/narrative.mp4)：[分镜与来源](../shot-recipes/scene-narrative/)

素材均由原生 imagegen 生成；人物与情境为虚构，叶片仅为观察示意，不推断物种或科学成因。提示词、原始 PNG 字节指纹保存在各示例中。所有文字、字幕、品牌和批注为 renderer 原生生成，不写入源图。公开样片固定使用 Your Brand，不读取私有品牌。

复现：`npm run preview:image-led -- --force`。复核包含生产锁、布局实测、输出 QA 和全片播放。未经完整审核不代表正式交付。旧文字样片及分镜保留在 `examples/text-led-video/`。
