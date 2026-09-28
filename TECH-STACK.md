# Tech Stack

- Node.js 20+、TypeScript、React 和 Remotion 负责本地确定性画面渲染。
- Zod 定义并导出 JSON Schema；Vitest 运行分镜契约测试；ESLint 与 TypeScript 检查代码。
- FFmpeg/ffprobe 用于媒体检查、抽帧和音频测量。
- Style Pack 是项目内 JSON 配置；2.3 语义构图使用现有运行时，不引入新渲染服务或依赖。

核心验证命令见 `AGENTS.md` 和 `package.json`。新增语义画面可运行 `npm run preview:semantic -- --output <new-directory>` 检查全部 Style Pack。
