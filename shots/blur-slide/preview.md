# blur-slide 验证入口

契约样例：[storyboard.json](../../examples/shot-recipes/blur-slide/storyboard.json)。

`npm run validate:storyboard -- examples/shot-recipes/blur-slide/storyboard.json --mode fast`

维护者可用 `preview:shot` 检查动作中间、完成与交接帧；初始化和列表命令不渲染视频。

此前1.0.0已进行横屏静态关键帧检查，完成态见 [complete.png](../../examples/shot-recipes/blur-slide/complete.png)。旧截图只作历史对照。

2026-10-02（1.1.0历史动效）：公开样片已按最新实际renderer重新渲染、抽取关键帧回读，并以1倍速在浏览器运行到结束。见[32份公开样片复核记录](../../examples/shot-recipes/motion-review/README.md)。卡片与配方详情可动态播放；真实旁白与竖屏未在本轮验收，仍experimental。

当前1.2.0采用独立场景视觉和材质，32份静音样片已重新渲染并检查关键帧、正常速度播放与页面交互；见[当前视觉复核](../../examples/shot-recipes/visual-review/README.md)。历史截图不作为当前版本证据。
