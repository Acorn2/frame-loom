# Tech Stack

- Node.js 20+、TypeScript、React 和 Remotion 负责本地确定性画面渲染。
- Zod 定义并导出 JSON Schema；Vitest 运行分镜契约测试；ESLint 与 TypeScript 检查代码。
- FFmpeg/ffprobe 用于媒体检查、抽帧和音频测量。
- Remotion 的确定性逐帧计算用于入场与转场；FFmpeg `silencedetect` 用于有声成片的片尾检查。
- Style Pack 是项目内 JSON 配置；2.3 语义构图使用现有运行时，不引入新渲染服务或依赖。

核心验证命令见 `AGENTS.md` 和 `package.json`。新增语义画面可运行 `npm run preview:semantic -- --output <new-directory>` 检查全部 Style Pack。

本轮没有新增运行时服务或依赖。Vitest 固定为 4.1.11；语音缓存使用 Node.js 文件与 SHA-256，真实时长来自现有 ffprobe。字幕精确时间暂采用人工 cue，不内置强制对齐模型。
