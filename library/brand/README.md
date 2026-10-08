# FrameLoom 产品图标

文档页与播放符号表示“AI 文档转视频”。深灰底座 `#202733`、白色文档与蓝色播放符号 `#7796ff` 沿用网站配色。图形由本项目绘制，采用仓库的 MIT 许可。

- `logo.svg`：可编辑的主图标，导航栏使用；包含文档文字线条。
- `favicon.svg`：省略文字线条，供小尺寸浏览器标签页使用。
- `favicon.ico`：16、32、48px 浏览器兼容图标；16、32px 使用简化版。
- `apple-touch-icon.png`：180px 主屏幕图标。
- `logo-512.png`：512px 产品头像素材。

修改 SVG 后，运行 `node scripts/prepare-brand-assets.mjs` 重新导出 PNG 和 ICO。脚本使用现有 Remotion 浏览器依赖，网站构建直接复制已生成的图标。

产品名保持 FrameLoom；导航副标题使用“AI 文档转视频”。网站是风格与镜头配方的浏览入口，视频生产仍通过本地 Coding Agent Skill 完成。
