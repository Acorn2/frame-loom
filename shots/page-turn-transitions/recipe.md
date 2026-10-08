# 对开页面换章

页面作为实体换章。

宿主/输入：两场不同章节，transitionIn 绑定共享重叠时间线，正文避开交接；线条承接仅支持 code-reveal 的同名配置标题线，carryKey 必须绑定两场相同语义。

关键要求：先评估BarnDoorSplit；CubeRotate后置，限制频次，动作压缩与语音衔接实测。

阶段与参数：旧章完整阅读 → 0.6–2.4秒互补交接 → 新章正文 → 独立阅读。墨迹只处理遮罩；对开使用左右半页，新页回到精确原比例。

声音默认关闭，交接不能覆盖旁白字幕；不得将视觉扫描当作真实识别结果，不复制上游页面或声音。适配六套当前风格、16:9。

[可运行示例](../../examples/shot-recipes/chapter-transitions/page-turn-transitions.json) · [契约](manifest.json)
