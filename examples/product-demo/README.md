# Product Demo Example

横屏 `retro-windows` 示例，只使用当前已实现的 `statement` 模板。

```bash
npm run validate:storyboard -- examples/product-demo/storyboard.json
npm run check:safe-area -- examples/product-demo/storyboard.json
npm run render:storyboard -- examples/product-demo/storyboard.json /tmp/frame-loom-product-demo.mp4
npm run extract:review-frames -- /tmp/frame-loom-product-demo.mp4 examples/product-demo/storyboard.json /tmp/frame-loom-product-demo-review
```
