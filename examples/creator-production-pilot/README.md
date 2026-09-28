# 创作者生产切片样例

本样例只输入仓库自己的公开 README 文档，按 `production-brief.md` → `route-card.md`／`content-gaps.md` → `shot-map.md` → `script.md` → `storyboard.json` 顺序完成一条 20 秒图解路线。它验证原文、主张、画面路线、内容缺口和镜头能在渲染前被逐项审阅。`R2` 是同一文档可制作的另一条叙事路线；两条路线都不要求图片、截图、录屏或音频。

![本项目 process 镜头的实际渲染帧](previews/process.png)

`storyboard.json` 的状态是 `generated`，用于自动预览；没有创作者审核，不能作为 `review` 模式输入。可以复制本目录到临时项目，运行完整 `fast` 管线，避免把输出写入示例目录：

```bash
cp -R examples/creator-production-pilot /tmp/frame-loom-creator-production-pilot
npm run produce -- /tmp/frame-loom-creator-production-pilot --mode fast --audio-mode silent
```

完成后查看 `run.json`、`output/preview-silent.mp4`、contact sheet 和 `qa-report.json`。自动 QA 通过只说明技术检查通过，仍须按正常速度完整观看。若要改 `process` 镜头，先更新 `shot-map.md` 中的 `C2`，再只修改 `storyboard.json` 的同名 scene；内容与计划文件变化会使 `--from` 恢复拒绝旧输入指纹。
