# 独立风格与配方选择

[完整分镜](storyboard.json)演示 `style + shotRecipes`，无需 `videoTemplate`：风格为 retro-zine，选定 paper-title、document-conclusions、list-reveal，并逐场填写 `shot`、内容槽位与 beats。原文复用[自有资料笔记](source.md)，不包含用户私有材料。

先查询兼容能力，再初始化自己的待编排项目：

```bash
npm run list:shots -- --style retro-zine --canvas landscape
npm run init:project -- --slug my-topic --style retro-zine --shots paper-title,document-conclusions,list-reveal
npm run validate:storyboard -- examples/shot-selection/storyboard.json --mode fast
```

同一配方可在多个场景使用，集合并不强制顺序或全量使用。改成集合外的镜头会在校验与生产锁解析时被拒绝，未选基础回退也不会自动补入。该示例用于查看制作契约，本次修正没有生成对应视频。
