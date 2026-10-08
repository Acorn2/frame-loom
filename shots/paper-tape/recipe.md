# paper-tape

纸卡固定或立起，清单 C03，1.0.0 experimental。只能由 card-stack, row-embed 按受控输入启用，不作为独立镜头，也不加入 shotRecipes。

优先MaskingTapeSlap；停止晃动后阅读，PopupBookRise终态需可读。无音效，六套当前风格、16:9。来源详见 provenance.json。

## 运动制作方案（本次重做）

两条撕边胶带依次扑到对角，落地短压扁、旋转过冲再回正；第二条拍下后纸面停止轻晃。

## 关键参数与节拍

每条独占半个tape beat；扑入scale=1.45→1；旋转-16°→+7°→0；scaleY最低.72。

所有阶段读取显式 beat；参数随画布缩放，持续时间按 fps 和阅读预算校验，不强套上游示例固定时长。动作完成后保持静止；采样、暂停、倒放与随机 seek 不依赖播放历史。

## 声音建议

两条落点各有可选轻slap，默认不加声音。 此处仅说明事件点，运行时默认静音，不引入上游音效、私有媒体或自动播放音轨。

## 容易做错的地方

持续浮动不能延伸到阅读期；这里只接MaskingTapeSlap，不包含PopupBookRise。

## 版本与验证边界

当前版本 1.2.0。场景旧版1.0.0与1.1.0仍按各自renderer解析，新建项目选当前版本。实际公开预览使用本项目renderer、自有文本与六套横屏风格；真实TTS与竖屏须另行验收，不能由静音样片推断。

## 1.2.0 画面与材质

继承 row-embed 的冷灰工作台；绿色胶带与白纸形成材质区分。风格保留配色家族，场景独立定义背景与构图；辅助动作继承宿主。深色背景使用白色标题和字幕，白卡上的正文仍为深色。网页和生产共用同一renderer，当前支持六套风格 + 16:9，状态仍experimental。

当前关键帧与正常速度播放记录见[视觉复核](../../examples/shot-recipes/visual-review/README.md)。

当前中性底色与播放复核见[中性视觉复核](../../examples/shot-recipes/neutral-visual-review/README.md)。
