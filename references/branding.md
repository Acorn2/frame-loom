# 三套主风格的右上角品牌

手绘白板、彩色手绘讲解、像素讲解笔记共用独立品牌层。标识在片头短暂画入，之后固定在右上角，换场不重新播放；品牌文字继承项目所选字体。白板使用绿色星形和弧形下划线，彩色手绘使用风格强调色，像素风使用方块星形与阶梯线。项目配色可覆盖默认颜色。

设计参考 [simon-skills 的品牌配置](https://github.com/trustfuture/simon-skills/blob/3ad0a25127c17da48a0e869c9efbf4136c40848b/skills/whiteboard-video/config.json)及其[独立品牌层](https://github.com/trustfuture/simon-skills/blob/3ad0a25127c17da48a0e869c9efbf4136c40848b/skills/whiteboard-video/render.html)。这里复用可配置品牌的设计思路；片尾关注卡不在此功能内。

## 一处替换

修改仓库根目录 [config.json](../config.json) 的 `brand.name`，后续三套主风格生产共用此名称。默认 `Your Brand` 是占位文字。项目中存在 `config.json` 时使用该项目的完整配置，没有时读取仓库配置；项目配置不是局部合并。原六套风格不读取品牌配置、不添加此标识。

```json
{
  "schemaVersion": "1.0",
  "brand": {
    "name": "Hresh赫什",
    "watermark": {
      "enabled": true,
      "position": "top-right",
      "opacity": 0.72,
      "size": 36,
      "margin": 56,
      "drawInSeconds": 1.2,
      "sparkle": true,
      "underline": true
    }
  }
}
```

也可以在制作组合页面输入品牌名，复制的指令要求 Agent 设置项目配置；页面不会改写磁盘文件。初始化支持：

```bash
npm run init:project -- --slug pixel-brand-test --style paper-collage --brand-name 'Hresh赫什'
```

该参数复制仓库品牌设置并创建项目 `config.json`，继承的本地 Logo 路径转为绝对路径。没有参数时项目继续使用仓库配置，初始化不生图、不生成视频。

## Logo 和显示约束

在 `brand` 中添加 `logo` 后，以本地 PNG 代替品牌文字。路径相对于该配置文件，也支持绝对路径；不支持渲染时联网加载。建议使用带透明背景、裁掉多余留白的横向 Logo。记录真实来源和使用许可，例如：

```json
"logo": {
  "path": "assets/brand-logo.png",
  "source": "用户提供的品牌原稿",
  "license": "用户确认拥有并授权本项目使用"
}
```

`brand.accent` 与 `brand.ink` 可选，使用六位十六进制颜色；未指定则跟随风格或项目配色。开启标识时，名称需为不超过 40 字符的单行文字，字号 24–40、边距 40–64、不透明度 0.5–1（均按 1920 宽画布设计）。渲染等待实际字体加载，过长名称会缩小至 24；仍超出预留区时拒绝渲染，要求缩短名称或使用 Logo。文字的最终合成色必须有足够对比度。

右上角预留区域为横屏画布的 `x=1600, y=36, w=284, h=108`，随画布宽度缩放。标题和开放白板内容避开此区域；实测 QA 检查标识越界及正文、来源图片遮挡。Logo 内部可读性仍需人工观看。设置 `watermark.enabled: false` 可关闭；其余位置暂不支持，未知字段不静默忽略。

## 视频、封面、缓存与审核

三套主风格的 2.4 生产渲染会同时输出 `<video.mp4>.cover.png` 和封面记录。封面从当前校验视频中抽取首个图解和品牌都完成的稳定帧（开放白板还等待铅笔退场），不另行生图，不构造另一套排版；沿用视频画幅、标识和该帧字幕。已有文件需显式 `--force`。

```bash
npm run render:cover -- projects/<project>/storyboard.json projects/<project>/output.mp4 projects/<project>/cover.png
```

品牌配置、名称及已启用 Logo 的实际字节进入生产锁、审核指纹和分场缓存。修改后重新渲染，review 项目重新审核；不能给旧品牌视频提取冒充新配置的封面。关闭时不读取 Logo。历史视频不批量重写。

公开风格库、镜头样片、字体样片和它们的封面统一展示固定 `Your Brand`，不读取用户项目或仓库中的私有品牌配置、Logo。私有品牌只进入用户生产输出；公开样片用于演示标识位置和三套媒介的差别。
