# FrameLoom 技术栈

- Node.js 20+
- TypeScript 5.9
- React 18
- Remotion 4.0.522
- Vitest：纯函数和 validator 测试
- Zod：运行时解析与 TypeScript 类型来源
- JSON Schema：由 Zod 生成，供 Agent 和外部工具读取

选择本地文件和 Remotion 是为了保持低运维、可重复和可审阅。v0.5 继续不引入数据库、云队列或供应商绑定的 AI/音频 SDK；Style Gallery 由无依赖 Node.js 脚本生成，QA、音频测量和 contact sheet 使用系统中的 FFmpeg/ffprobe。GitHub Actions 校验生成契约、类型、lint、测试、示例和最小渲染闭环。

Remotion 版本和许可可能变化；升级时需要重新核对官方条款、渲染器 API 和示例视频的视觉回归。
