# 白板接入验证记录

## 范围

白板方法拆成独立的 `whiteboard` 风格、现有字体和三个受控镜头。推荐显式选择 `xiaolai`；全片字体仍可替换。三个镜头适配七套当前风格和横屏；白板风格首轮仅支持这三个镜头与 `semantic-default`。

流程镜头按输入顺序解释 2–4 项；对照镜头展示两项，不补造因果；主体解释展示有来源的本地图片和 2–3 条说明。所有动作由当前帧计算，固定种子控制路径，文字采用横向揭示，不模拟汉字笔顺。绘制时间不足、单笔阶段重叠、关系错误、来源缺失和槽位溢出均会阻止生产。

上游方法来源与固定提交见各镜头 `provenance.json`。未复制上游代码、媒体或字体，未增加运行依赖。

## 已执行的检查

最终复核日期：2026-10-11。

- 类型与 lint：`npm run typecheck`、`npm run lint` 通过。
- 契约：`validate:shots`、`validate:styles`、`validate:fonts` 通过；目录包含 43 个场景镜头，原有五种字体字节保持不变。
- 白板专项及既有镜头回归：`npm run test:shots`，162 项通过。涵盖三镜头 × 七风格 × 五字体的输入校验、错误阶段、关系、来源、资产、画幅和三条说明的共享几何。
- 基础语义实际布局回归：`npm run test:content-layout -- --only semantic-kinds--whiteboard`，七种语义的横屏检查通过。
- 字体参考：`npm run preview:fonts`，35 组风格 × 字体参考由实际 renderer 生成。
- 公共配方库：`npm run preview:library`，382 个实际 renderer 样片全部完成，当前源码指纹一致，图片与视频无缺失。
- 完整静态构建：`npm run build:library -- --require-previews` 通过，包含七套风格、43 个场景镜头及全部兼容组合。仅生成本地静态产物。
- 最终全量回归：`npm run test`，33 个测试文件、584 项全部通过。并发渲染期间配色生命周期测试曾触发 5 秒超时，渲染结束后的默认全量运行通过；未调整超时或关闭检查。
- 文档：`npm run check:docs` 检查 273 个 Markdown 文件、803 个本地链接，通过；`git diff --check` 通过。
- 五场静音示例：实际 renderer 生成 960×540、30 fps、48.4 秒样片；检查 76 个事件帧，布局无错误。
- 最大槽位生产复现：使用 `whiteboard-explain/three-notes.json` 的三条说明，通过正式 `render:storyboard --mode fast` 渲染 1920×1080、30 fps、550 帧静音预览；`qa:storyboard` 自动检查通过，包括生产锁、输出规格与 26 个必查布局帧。

## 视觉复核与边界

已查看五场示例的时间序列截图、三条说明的完成态及不同风格的镜头封面。主体解释的自动布局检查保留 `media-small` 警告：主体图片约利用可行展示面积的 16%。本示例使用无内部文字的简洁原创 SVG，所检查帧的主体和说明可辨；真实图片需要按内容重新核对可读性。

这些检查不等于完整播放批准。示例为静音审片预览，未调用真实 TTS 服务，也未完成有声视频的同步与完整播放复核。自动 QA 的 `releaseReady` 和 `fullPlaybackPassed` 保持 false。

当前验证不覆盖竖屏、自动生成素材、上游脚本运行时或新增 TTS 时间戳。
