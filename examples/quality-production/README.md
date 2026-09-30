# Quality production fixtures

两份公开的 24 秒分镜使用不同内容复测汇聚、同一对象状态变化和图片聚焦：

- [讲稿制作](storyboard.json)：文字与证据汇成讲稿，审核后改变状态，聚焦演示页右侧。
- [研究笔记](storyboard.research.json)：观察与资料汇成笔记，核实后改变状态，聚焦演示页左侧。

[原始演示材料](source.md)、[第一份讲稿](script.md)和 [素材来源](asset-manifest.json)均在本目录。SVG 是仓库原创演示界面，不是真实产品截图，也不使用用户提供的私人样片。24 秒是静音演示时间；有声生产应先实测语音并生成时间提案。

```bash
npm run validate:storyboard -- examples/quality-production/storyboard.json --mode fast
npm run preview:semantic -- --output .tmp/quality-landscape --storyboard examples/quality-production/storyboard.json --styles retro-zine,scatterbrain,signal,archive-grid,signal-noir,studio-frame
npm run preview:semantic -- --output .tmp/quality-portrait --storyboard examples/quality-production/storyboard.research.json --styles retro-zine,scatterbrain,signal,archive-grid,signal-noir,studio-frame --portrait
```

输出目录必须是新目录。两份分镜都应分别复测横屏和竖屏，检查代表帧后再看正常速度视频。扩展字段与音频流程见 [质量生产说明](../../references/quality-production.md)。
