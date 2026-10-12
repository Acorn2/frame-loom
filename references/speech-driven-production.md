# 语音同步与增量渲染

范围：保留 FrameLoom 的严格分镜、静态 renderer、审核指纹与 QA，改善语音时间证据、开放白板排期和局部重渲。封面、品牌包装、混合素材不属于本次增量。

## 语音时间证据

豆包（火山引擎）v3 接收穿插在音频流中的 `sentence.words[{word,startTime,endTime}]`，时间单位为单次语音的秒。公开预设在 `requestBody.req_params.audio_params` 请求 `enable_subtitle: true`（TTS/ICL 2.0）与 `enable_timestamp: true`（TTS 1.0）；适配器不为已有配置自动补入参数，已有项目可按需显式开启。请按所用音色核对[官方接口文档](https://www.volcengine.com/docs/6561/1598757)。不修改用户密钥和资源配置。

缓存同时保留音频与时间证据，核对音频字节、证据摘要、原旁白覆盖、先后顺序和 ffprobe 实测时长。新适配器给豆包 v3 单独的缓存修订，其他服务的语音缓存键不变。部分时间戳、超范围、重复、TN 替换（例如 `123` 变成中文数字）不能冒充原文实测对齐；保留字数估算，清单明确记录 `estimated`。字幕跨供应商词边界需要估算时也标明估算，绝不替换朗读文本。

`audio-manifest.json` 保持 1.0，新增可选的分场 `speechWords` 和 `captionTimingSource`；全局来源可为 `provider`、`estimated`、`manual`、`mixed`。旧音频清单继续有效。`audio/caption-cues.json` 的人工校订仍优先。

## 开放白板时间提案

`--plan-timing` 继续只写新文件，原分镜与批准不变。`whiteboard-board` 使用自然书写预算和单笔顺序，空间几何、风格、字体、素材、配方集合不变。没有语音分组时保留原动作相对起点并消除重叠；有分组时以语音窗口排期。

Agent 可按语义准备 `speech-cues.json`，不能猜测画面节点与旁白的关系：

```json
{
  "schemaVersion": "1.0",
  "scenes": [{
    "sceneId": "intro",
    "textHash": "此处填写 scene.narration.trim() 的 SHA-256",
    "groups": [
      {"text": "你可能已经懂了很多道理。", "targets": ["heading", "reader"]},
      {"text": "一年过去，生活还是老样子。", "targets": ["year-arrow", "result"]}
    ]
  }]
}
```

分组按顺序完整覆盖原旁白，目标唯一覆盖该场全部 reveal/draw；箭头也要列入。顺序必须符合已有关系契约。时间戳缺失或无法完整对应分组边界时，窗口明确使用估算；分镜仍须审核。例子仅展示格式，实际目标和讲稿需取自当前项目。

```bash
npm run synthesize:voiceover -- projects/你的项目 --plan-timing projects/你的项目/storyboard.timing.json --speech-cues projects/你的项目/speech-cues.json
```

提案旁另写 `<新分镜>.timing.json`，记录输入指纹、实测音频摘要和每场 `provider` / `estimated` / `original-beats` 时间来源。该文件为复核证据，不是生产输入。提案重新通过配方编译；动作完成前不能写下一目标，末尾保留配方阅读时间。预算不足直接报出场景和目标，要求缩短文案、调整分组或拆镜头；不压缩成难读动画，也不靠延长静音尾巴解决。确认内容和时间后显式采用提案，按原有 fast/review 流程验证和审核。

## 分场渲染缓存

默认在项目 `.cache/scenes/` 存储静音 H.264 场景与布局实测证据。仅适用于 2.4 且没有重叠换场；历史分镜和重叠换场明确使用整片路径。`render:storyboard --no-scene-cache` 可恢复整片渲染用于排查和对照。

键绑定该场内容、素材字节、实际起点、全片画幅/帧率/时长、风格/字体/配色、renderer 构建、配方版本、交付用途、字幕和布局必选帧。同一场字节和记录不一致、帧数不符、布局证据缺失都会重新渲染。内容修改只失效相关场；全片时长、字体、风格或实现变动可能失效全部场，不承诺所有修改都只重渲一场。

画面分场拼接，旁白、配乐衰减和跨场音效仍由 Remotion 一次生成整片 WAV，再一次编码 AAC，避免分场 AAC 的编码填充积累。最终仍经过完整布局、视频流检查、原子候选发布和当前生产锁核对；缓存命中不能代替完整播放复核。

验收：离线模拟时间戳含缺失/错序/文本变化；检查人工字幕优先；白板单笔/阅读不足拒绝；真实渲染首次未命中、二次命中、改一场局部失效、缓存损坏重渲、整片有声拼接与重叠换场回到原路径。服务商在线权限与实际听感需要真实项目复核。本地缓存可删除后重建，不改变生产输入。
