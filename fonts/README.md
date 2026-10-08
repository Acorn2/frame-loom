# 项目字体

全片字体与视频风格独立选择，一次选择一个字体家族。受控清单 [font-index.json](font-index.json) 记录文件、固定版本、上游下载地址、SHA-256、字重映射和许可。文件保存于 `public/fonts/`，网页与 Remotion 共用。

| ID | 名称 | 官方来源 | 文件 |
| --- | --- | --- | --- |
| source-han-sans-sc | 思源黑体 | [Adobe](https://github.com/adobe-fonts/source-han-sans) | 官方 CN 可变 WOFF2，250–900 |
| source-han-serif-sc | 思源宋体 | [Adobe](https://github.com/adobe-fonts/source-han-serif) | 官方 CN 可变 WOFF2，200–900 |
| lxgw-wenkai | 霞鹜文楷 | [LXGW](https://github.com/lxgw/LxgwWenKai) | 官方 Regular、Medium TTF |
| smiley-sans | 得意黑 | [atelierAnchor](https://github.com/atelier-anchor/smiley-sans) | 官方 v2.0.1 压缩包中的 TTF WOFF2，400 |
| xiaolai | 小赖字体 | [LXGW](https://github.com/lxgw/kose-font) | 官方 v3.126 比例版 Regular TTF，400 |

霞鹜文楷 400 使用 Regular，500–900 映射到 Medium 文件；此映射保持统一家族，但不是连续可变字重，选型时以实际样片为准。所有文件保持官方原始字节，未裁剪或转换；浏览器 family 使用项目内别名，不修改字体文件内部名称。

得意黑和小赖字体为单字重；页面或镜头请求粗体时由浏览器合成，得意黑的倾斜来自原始字形。得意黑文件从官方 release 压缩包提取，清单同时记录压缩包 SHA-256 与成员路径；小赖字体使用比例版，未选用等宽版。得意黑的官方建议主要面向标题、字幕与短句，较长正文仍需在实际项目中复核可读性。

这五套字体采用 SIL OFL 1.1。随项目保留各自原始版权和许可：

- [思源黑体许可](../public/fonts/source-han-sans-sc/OFL.txt)
- [思源宋体许可](../public/fonts/source-han-serif-sc/OFL.txt)
- [霞鹜文楷许可](../public/fonts/lxgw-wenkai/OFL.txt)
- [得意黑许可](../public/fonts/smiley-sans/OFL.txt)
- [小赖字体许可](../public/fonts/xiaolai/OFL.txt)

字体不改用 FrameLoom 的 MIT 许可，不单独出售字体文件。修改、子集化或转换字体前需重新核对保留名称及上游条款。

运行 `npm run validate:fonts` 核对清单与实际字节。新增字体需记录来源与许可、字体 ID／版本、文件及字重，验证加载、中文标点、长标题、标签和单行字幕，再更新注册 ID 与生成的契约。只有校验与实际渲染通过的字体才能进入选项。
