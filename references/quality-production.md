# Quality production workflow

这些能力仍处于公开测试阶段。自动检查保证结构和技术约束；讲解是否清楚、发音是否正确及观看节奏仍需完整播放复核。

## 所有模板的质量节奏

新分镜先定“此刻要看什么”，再安排入场与转场。`enter` 按 Style Pack 的动效规则执行；`spring` 风格在 beat 时长内收住。node、card、metric 按最近的入场或聚焦动作转移注意力，已看过的内容轻度变淡并保持可读。镜头末动作后保留阅读时间，但长静止提示需要结合真实旁白判断；不要靠无意义的背景漂移消除提示。

重叠转场现由三条渲染路径共用同一交接曲线：旧画面先退，新画面随后淡入；`overlap-slide` 另加位移。选择重叠的镜头需复查中点与总时长。TTS 按实测语音对齐镜头，时间提案继续使用无重叠交接，避免旁白在画面尚未出现时开始。背景微动与 BGM 都是有理由才采用的风格选项。若启用有来源的 BGM，默认首尾渐变，并由实际语音结束时间释放 ducking；输出 QA 会提示超过 2 秒的片尾静音，不会擅自补音乐或把警告当发布批准。

## 干净有声候选文件

`in-project-video` 保留声音与字幕，默认不显示 `AUDIO PILOT`。为兼容现有项目，文件名仍为 `pilot-audio.mp4`，生成后仍是 `manual-review-pending`。

Renderer 同时写入 `<video>.render.json`，记录用途、审片标记设置和视频指纹。QA 与 `approve:delivery` 核对该记录。旧视频没有记录时必须重新渲染；不能为旧视频补造记录。批准仅确认已审阅的文件，不重渲、不改视频字节。

## 先测语音，再定时间

使用项目实际目录替换 `<project>`。以下命令会调用已配置 TTS；`mock` 只生成测试音调，不能交付。

```bash
npm run synthesize:voiceover -- <project> --plan-timing <project>/storyboard.retimed.json
```

命令逐段合成并实测，语音以内容寻址保存在项目 `.cache/tts/`。提案只写新文件，原 `storyboard.json`、既有音频包和批准记录保持不变。提案保留原稿，按实测语音加约 0.15 秒尾部停留，按比例安排原动作；有旁白镜头周围改为无重叠交接，避免混音和隐藏画面期间开口。提案不是语义对齐：必须检查关键动作、阅读时间与无声停留；需要更长时间时拆镜头。

确认提案后，由创作者或 Agent 显式采用为当前分镜，再运行原生产命令。`review` 模式必须重新批准当前分镜。锁定底片继续受原有音频回流规则约束。

```bash
npm run produce -- <project> --mode fast --audio-mode tts --output-purpose in-project-video
```

已经有生成音频包时，`--reuse` 仍要求整包指纹一致。确认重建现有包时使用 `synthesize:voiceover -- <project> --force`：未变语音仍命中缓存，只重排和重新合成文件；改变一段讲稿只新增该段请求。必须重新向服务商请求相同文字时另加 `--refresh-voice`。失败不删除成功缓存，缓存损坏则重新生成。缓存不记录密钥，也不参与最终生产输入指纹；被实际采用的音频仍参与指纹。

不同项目不共享缓存；同一项目当前按单个生产进程操作。模型服务端变化需要显式刷新。长片的最终视频重编码仍可能是全片操作。

## 手工修订字幕时间

默认字幕时间来自字重估算，`audio-manifest.json` 会写明 `captionTimingSource: estimated`，不能称为逐词对齐。完整英文词、版本号和小数不再从中间切断；单个超长词会报告，请调整经审核的显示表达或讲稿，不能无限缩字。

需要精确时间时，在项目创建 `audio/caption-cues.json`，覆盖所有有旁白镜头。`textHash` 取当前 audio manifest 对应段；以下 hash 是占位值。时间以该镜头实测语音开始为零点。

```json
{
  "schemaVersion": "1.0",
  "scenes": [{
    "sceneId": "opening",
    "textHash": "<current segment textHash>",
    "cues": [
      {"startSec": 0, "endSec": 1.5, "text": "先看文字"},
      {"startSec": 1.8, "endSec": 4, "text": "再看证据"}
    ]
  }]
}
```

每条为单行短句。程序核对原稿文字和顺序（忽略显示标点及空白），拒绝过期指纹、重叠和超过实测语音的时间。重建音频包后标记为 `manual`，不会再拆分这些短 cue 的时间。当前未接入供应商逐词时间戳或自动强制对齐。

## 三种可选语义扩展

只适用于 Storyboard 2.3；省略字段时保持旧行为。

| 字段 | 行为 | 约束 |
| --- | --- | --- |
| `visual.networkDirection: inward` | 多路来源汇聚到 anchor | 每个分支恰好一条指向 anchor 的连接；默认 outward |
| `visual.changeMode: replace` | 同一位置保留对象，切换状态说明和外观 | 前后状态使用同一 glyph；默认左右 compare |
| `visual.mediaFocus` | 从全景移动、放大并裁切到来源图片的一部分 | x/y/width/height 为原图归一化矩形；宽高至少 0.25；矩形不可越界 |

聚焦对象还需 `start`、`duration`（镜头内帧数）和 `label`。动作必须在镜头内完成。局部放大不会增加原图分辨率。两份可复用公开例子见 [quality-production](../examples/quality-production/README.md)。

## 有声代表片段与长片证据

```bash
npm run preview:shot -- <project>/storyboard.json <scene-id> <project>/output/shot-audio.mp4 --audio-config <project>/audio/audio-config.tts.json
```

复用正式渲染的音频加载与预检，音画使用同一原时间轴；有声片段额外包含前后各最多 0.5 秒，便于检查交接。`clip-timing.json` 保存与原片的帧对应。该文件有审片标记，只供检查，不能直接获批交付。`--mode review` 仍需当前分镜批准。

2.3 长片保留每场完整态和交接前帧，不再被全片 48 帧上限丢弃。额外总览点可以采样；接触表每页最多 48 帧，全部页列于 `review-frames.json.contactSheets`，`pages` 给出每页对应的帧号和时间范围。QA 会核对逐镜必选帧没有缺失、页数与抽帧数一致。抽帧与接触表先在临时目录完成，失败时旧索引保持不变；恢复 QA 时可复用通过指纹校验的视频。这仍不代替正常速度全片播放。

渲染中断后可按 `run.json` 的阶段，从 `--from render` 或 `--from qa` 重试。渲染先写隔离文件并检查媒体，随后发布视频及渲染记录。意外终止的临时目录由下次运行识别；若旧文件与预期不符，程序会停止并保留回退文件，不猜测哪一版该覆盖。公开发布仍需要完整观看、字幕与声音复核。
