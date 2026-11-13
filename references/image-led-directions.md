# 批注图解与情境叙事

本次接入以 `designs/illustration-directions-pilot/output/v2/` 经 hresh 确认的静音设计样片为视觉基准。复用原创插画，正式样片从受控 renderer 重新生成；不是把设计试验的视频文件直接放入配方库。

## 范围与数据流

- 风格 ID `annotated-reasoning`、`editorial-typography` 不变，展示名分别为「批注图解」和「情境叙事」。新初始化固定使用 `annotated-image`／`scene-narrative` 与 `semantic-default`。
- 文档 → 逐场计划 → 插画计划与原生 imagegen → 检查并登记本地图片 → 2.4 分镜的文字、图像区域、取景阶段和连接 → 静态配方 renderer → 生产锁、布局实测与输出 QA。
- 批注绑定源图归一化区域，随显式取景同步；情境叙事使用完整插画，通过分场切换与有限取景推进。文字、字幕与品牌始终原生渲染。源图内部不生成文字。
- 生图计划显式声明 `guideVersion: "2.0"`：批注图解采用透明主体，情境叙事允许完整不透明场景。不声明时仍读取旧规范，保持旧计划及登记指纹不变。
- 公共示例采用已生成的来源素材路线，保留提示词、字节指纹与来源说明；不伪造在新规范下重新生图的记录。

## 兼容边界

保留旧 `annotated-manuscript`、`editorial-flow`、原风格 token 和素材规范；旧文字镜头的插画 8% 限制继续有效。不迁移旧分镜、不改手绘白板及其样片。两项新配方仅 16:9，未知字段、版本、动作、无效图像区域或取景阶段须拒绝。

## 编排契约

基于1920×1080声明几何，按横屏宽度等比缩放。每场 `shot.slots.items` 唯一覆盖全部图层，首项 `node.label` 完整等于 `scene.title`；文字用 `node`，图片用 `object + asset + fit: contain`，每项有唯一 `reveal`。图片 label 以24px显示于图像下方；不在图片内写正文。

- `elements` 声明 text/image、x/y/width/height。内容 x≥110、y≥160、右边≤1810、底边≤900；图片区至少120px；取景按 contain 展示所选源图区域，比例不同时在外侧留白，不展示区域外的像素。正文 fontSize 24–112，bodySize 24–48，regular/semibold，left/center/right，颜色只引用 ink/muted/accent/accentAlt。单行文字可启用 underline，并在文字落定后声明唯一 highlight。文字不自动换行；预检逐行核对宽度，显式换行时须保证总高度足够。
- 图片 `crop` 为源图归一化 x/y/width/height，全部位于0–1内。`focus` 每项绑定 beat ID、同一图片 target 与终点 crop；beat 使用 focus，先 reveal，有限取景按同图时间顺序且不重叠。不靠隐藏 layer 状态或持续漂移推进。
- `annotated-image.annotations` 以实际 connection ID为键，声明源图 `region`、accent/accentAlt、fromSide/toSide 及有限 via 控制点。connection 从图片连到已出现的正文节点；唯一 draw 晚于两端 reveal。圆圈和引线使用同一个源图变换；活动期间每帧检查 region 不被 crop 裁掉。不得用装饰线杜撰因果。
- `scene-narrative` 不声明连接线。用分场切换及有限 focus 推进环境、动作或观察证据；同角色先登记参考图，再生成后续场景，不用取景变化冒充角色表演。
- `composition` 为 establish/detail/compare/question/closing，描述已编排画面的构图；不自动填入内容。可选 `kicker` 是原生小字栏标。主张与 `visual.source` 必须有来源，`representation` 为 diagram。单场最长60秒，最后动作完成后至少留1秒阅读。

新项目无需手选配方：`npm run init:project -- --slug my-topic --style annotated-reasoning` 或 `--style editorial-typography`。填写逐场计划后，按[插画生产](illustrated-production.md)实际生图、检查并登记；透明主体与完整场景规范分别由 `illustration.v2.json` 固定。已有 PNG 可走明确来源素材路线，不伪造新的生图登记。

## 接入清单

- [x] 严格契约、静态注册、共享几何、预检与实测检查。
- [x] 新初始化、版本化生图规范与兼容测试。
- [x] 两条同主题、同旁白的 30 秒正式静音样片、同源封面及来源清单。
- [x] 配方库名称、描述、双语展示与中英文 README。
- [x] 类型、lint、完整测试、catalog／schema 校验，旧项目实际渲染。
- [x] 所有公开镜头及字体组合预览更新，严格库构建、浏览器播放复核。

回退可只切回初始化映射和样片来源，不需要迁移用户数据。接入阶段先完成本地实现与验证；hresh 随后授权审查，通过后提交并推送 GitHub。

## 接入阶段验证结果

2026-11-13：49个测试文件、873项测试通过；后续配方库专项71项通过。类型、lint、字体、catalog、文档链接及独立 Remotion bundle 通过。398条镜头预览与45组字体预览指纹有效，严格配方库构建通过。两条30秒静音样片自动QA和完整播放复核通过，中文／英文及390px页面无横向溢出。旧两套18秒文字分镜实际渲染成功，白板样片、分镜、风格及两套旧生图规范字节保持不变。证据见[样片验证记录](../examples/illustration-directions/verification.json)。

## 提交前审查修正

审查复现并修正两处边界：原生文字使用 `white-space: pre`，预检现在拒绝依赖自动换行才能放下的长行；取景按源图选择区域裁剪，比例不同时保留空白，不再露出区域外的像素。增加长标签、长正文、显式换行、默认字号、空正文及不同源图比例的回归验证。旧文字镜头、素材规范与手绘白板保持原路径。

提交前修正后验证：49个测试文件、881项测试通过，其中图像配方28项回归测试通过。398条公开镜头、45组字体预览重新生成并通过指纹核对，严格配方库构建通过。两条修正版样片完整播放与全部QA页面复核通过；旧两套18秒文字分镜及20秒文章分镜再次实际渲染成功。
