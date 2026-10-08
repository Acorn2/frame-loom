# 轮廓手绘微颤

轻量手绘轮廓质感。

宿主/输入：ring-annotation，通过 effects 显式声明目标槽位，匹配唯一 highlight beat。

关键要求：一次一组、确定种子；正文保持稳定，不拿抖动修补无意义长停留。

阶段与参数：宿主全部正文/结构落定 → highlight 窗口 → 清除运动 → 至少1.2秒完成态。冻结窗位于 focus 内，冻结前后继续同一运动；微颤仅作用于主体环轮廓，不作用于正文。

声音默认关闭，交接不能覆盖旁白字幕；不得将视觉扫描当作真实识别结果，不复制上游页面或声音。适配六套当前风格、16:9。

[可运行示例](../../examples/shot-recipes/ring-annotation/line-boil.json) · [契约](manifest.json)
