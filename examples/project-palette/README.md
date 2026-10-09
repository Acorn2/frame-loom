# 截图配色闭环示例

使用 FrameLoom 本地制作组合页的真实截图，从主操作按钮区域采样得到 `#3454d1`，并在 Product Frame 风格中覆盖默认绿色。截图自身保持原貌。三场镜头分别展示浅色标题、深色白卡及真实截图，11.5 秒，1920×1080／30fps，静音审片预览。

来源、采集状态与原图区域见 [source.md](source.md)、[visual-sources.md](visual-sources.md) 和 [asset-manifest.json](asset-manifest.json)。最终颜色在 [storyboard.json](storyboard.json)，字体与配方选择独立。示例不代表公开发布或完整播放批准。

从仓库根目录执行（输出文件应尚不存在）：

```bash
npm run sample:palette -- examples/project-palette --asset product-home --region 413,1089,30,20
npm run validate:storyboard -- examples/project-palette/storyboard.json --mode fast
npm run validate:assets -- examples/project-palette/storyboard.json
npm run render:storyboard -- examples/project-palette/storyboard.json examples/project-palette/output/product-colors.mp4 --mode fast --output-purpose visual-preview
npm run qa:storyboard -- examples/project-palette/storyboard.json examples/project-palette/output/product-colors.mp4 examples/project-palette/output/review --mode fast --output-purpose visual-preview
```

输出、生产锁与 QA 文件是本地可重建产物，整个 `output/` 不提交。截图是公开项目示例，用户私有截图不进入配方库。
