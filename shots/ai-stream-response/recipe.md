# 结果生成与确认

## 意图与选用

先给一句摘要，再逐项补齐有依据的任务/证据，最后确认完成。用于解释 AI 结果的形成或有明确回执的任务过程。画面是内容驱动示意，不代表真的执行过在线任务；来源必须支持画面里的结论和状态。

## 输入边界

`slots.summary` 与 `slots.completion` 各引用一个 label；`slots.items` 引用2–4个 node，包含 label、text 和 `state: upcoming`。每个任务有唯一的 `set-state` beat，声明 `state: completed`。不接受额外连线、素材、坐标或未显示的正文。

## 动作顺序与时间

summary enter/reveal → 至少0.6秒阅读 → 任务逐项 enter/reveal，每项落定后至少0.6秒才显示下一项。任务落定至少0.1秒后才能启动 set-state；状态确认用0.2–0.8秒完成。全部任务完成后至少0.6秒才显示 completion；结尾保留至少1.2秒阅读。行体与状态图标有独立阶段，不把整个清单同时变成完成态。

## 横屏与竖屏

16:9 每行标签与正文并排，9:16 每行上下排列；摘要、任务与完成短句分别有固定槽位。支持六套当前风格、全片字体与独立字幕颜色，字幕直接显示在安全区。当前素材配色只支持横屏。

## 声音与易错点

声音不自动生成。避免日志刷屏、逐字响应代替可读摘要，或未完成任务时先亮完成短句。上游参考卡指出其参数未经实战项目验证，因此本实现按内容阅读预算重新编排，不直接沿用其高速节拍。

运行输入见[横屏示例](../../examples/shot-recipes/ai-stream-response/storyboard.json)与[竖屏示例](../../examples/shot-recipes/ai-stream-response/portrait.json)。方法来源与许可证见[来源记录](provenance.json)。当前状态 experimental。
