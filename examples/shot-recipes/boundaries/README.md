# 镜头边界验证

自有技术验证文字，不代表任何真实产品能力或历史事实。[六镜头分镜](storyboard.json)覆盖中文、English、版本号与数字，以及四条清单和较长来源文本；[五分支分镜](network-five.json)覆盖网络最大条目数。均采用 2.4、retro-zine + 16:9。

对应实际完成帧位于各个镜头示例的 `previews/boundary.png`。这些静态帧用于检查排版，正常速度完整播放仍待复核。

```bash
npm run validate:storyboard -- examples/shot-recipes/boundaries/storyboard.json --mode fast
npm run preview:shot -- examples/shot-recipes/boundaries/storyboard.json relations .tmp/network-boundary.mp4 --mode fast
```
