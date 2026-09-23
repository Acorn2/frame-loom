# FrameLoom 架构

## 三层边界

1. **Skill 层**：指导 Agent 读取文档、选择风格、生成并审核 storyboard。
2. **Runtime 层**：解析已审核的 storyboard，应用 Style Pack，计算场景时间轴并调用 Remotion。
3. **Production 层**：每支视频自己的 source、script、storyboard、素材和输出。

```text
document → content decisions → reviewed storyboard → validators → renderer → MP4 → QA evidence
```

内容、结构、视觉分离：内容回答讲什么，storyboard 回答什么时候出现和彼此关系，Style Pack 回答如何呈现。renderer 不读取某个示例的文案或绝对路径。

## v0.5 数据流

Style index 先提供紧凑候选，选中后才读取完整 Style Pack。CLI 使用 Zod 运行时契约读取 storyboard、Style Pack、素材清单和可选音频配置；通过后按画布方向生成 Style Pack token，把截图转为渲染可读的数据 URI，并将 props 交给 Remotion。输出路径由调用方明确提供且默认不可覆盖。FFmpeg/ffprobe 在渲染后生成元数据、音频时长和视觉复核证据。

```text
style-index → selected style → reviewed storyboard → contract + mapping + assets + safe area
  → renderer → silent/audio MP4 → ffprobe + review frames + QA report
```

## 演进边界

能力清单是 validator 和 renderer 的共同边界。当前四类模板共用图层和动作原语，语义映射 validator 再为每类模板增加结构要求。新增模板、动作或素材类型时，先实现 renderer，再增加 capability、validator fixture 和视觉回归；不通过自由文本 `motion` 绕过契约。Style Pack 通过索引和文件契约发现，新增风格不修改核心 TypeScript 注册表。
