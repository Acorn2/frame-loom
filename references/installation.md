# 安装与首次运行

[English](installation.en.md) · [返回 README](../README.md#快速开始)

FrameLoom 在本机渲染视频。你需要 Git、Node.js 24+、FFmpeg（含 ffprobe）；制作自己的文档视频还需要一个可用的 Coding Agent。推荐 Node.js 24 LTS，仓库 CI 使用此版本。

## 1. 准备环境

从 [Node.js 官方下载页](https://nodejs.org/en/download)选择 **24 LTS** 和你的操作系统，按页面指引安装。npm 随 Node.js 提供。已使用版本管理器的用户可切换到 Node.js 24，无需另装一份。

### macOS

如果已安装 [Homebrew](https://brew.sh/)，在终端安装 Git 和 FFmpeg：

```bash
brew install git ffmpeg
```

没有 Homebrew 时，Git 可从 [Git 下载页](https://git-scm.com/downloads)获取；FFmpeg 的预编译下载入口见 [FFmpeg 官网](https://ffmpeg.org/download.html)。确保 `ffmpeg` 和 `ffprobe` 所在目录加入 `PATH`。

### Windows

使用 PowerShell。已安装 WinGet 时：

```powershell
winget install --id Git.Git --exact --source winget
winget install --id Gyan.FFmpeg --exact --source winget
```

安装后重新打开 PowerShell，让新的 `PATH` 生效。没有 WinGet 时，从 [Git 下载页](https://git-scm.com/downloads)安装 Git，再从 [FFmpeg 官网的 Windows 下载入口](https://ffmpeg.org/download.html)获取预编译版本，将包含 `ffmpeg.exe`、`ffprobe.exe` 的 `bin` 目录加入 `PATH`。

### Ubuntu / Debian

Node.js 按官方页面安装 24 LTS；系统默认的 `nodejs` 包可能不满足最低版本。Git 和 FFmpeg 可通过系统包管理器安装：

```bash
sudo apt-get update
sudo apt-get install -y git ffmpeg
```

其他 Linux 发行版使用对应包管理器，或选择 [FFmpeg 官方列出的预编译版本](https://ffmpeg.org/download.html)。

### 检查是否准备完成

在之后运行 FrameLoom 的终端执行；以下命令同样适用于 PowerShell：

```bash
git --version
node --version
npm --version
ffmpeg -version
ffprobe -version
```

五条命令都应输出版本信息，`node --version` 至少为 `v24.x`。这一步只检查环境，不会请求 Agent 或 TTS 服务。macOS 已有本地安装和渲染验证，Ubuntu 有 CI；Windows 提供安装指引，尚未完成完整安装与渲染验收。

## 2. 下载项目并安装依赖

```bash
git clone --depth 1 https://github.com/Acorn2/frame-loom.git
cd frame-loom
npm ci
```

所有后续命令在仓库根目录执行。字体已经随仓库提供，无需安装到系统；首次渲染可能下载 Remotion 使用的浏览器，需要网络连接。

### 选择版本与更新

上述命令下载 `main` 的当前源码，适合体验最新改动。版本号相同的两个 `main` 提交也可能有不同的功能；反馈问题时，在仓库根目录执行 `git rev-parse --short HEAD`，记录提交号。

需要固定版本时，先查看 [GitHub Releases](https://github.com/Acorn2/frame-loom/releases)，选择已实际发布的 tag，再按该 Release 的安装命令下载。没有 Release 时，`package.json` 中的版本号不表示相应 tag 已存在。

更新时建议安装到新的目录，先渲染自带样片，保留旧目录中的 `projects/`、私人素材和本机配置。确认新版本可用后，再让 Agent 从旧项目继续；旧分镜沿用原契约，新版渲染与 QA 通过并重新审核后才能交付。不要把新版本的示例分镜覆盖到自己的项目中。回退时使用保留的旧目录及其原始输出。

如果继续跟随 `main`，可在没有源码改动的安装目录执行 `git pull --ff-only`，随后运行 `npm ci` 和下面的样片检查。Git 提示冲突或工作区改动时，保留现场，改用新目录安装；不要用强制重置解决更新问题。

## 3. 先确认本机能渲染

使用已经编排好的纯文档公开分镜，生成一条 20 秒的横屏静音样片。这一步不需要 Coding Agent、TTS 配置或 API Key：

```bash
npm run render:storyboard -- examples/creator-production-pilot/storyboard.json .tmp/quick-start/preview-silent.mp4 --mode fast
npm run inspect:output -- .tmp/quick-start/preview-silent.mp4 examples/creator-production-pilot/storyboard.json
```

看到 `OUTPUT OK` 后，用本机播放器打开 `.tmp/quick-start/preview-silent.mp4`。它应为 1920×1080、30 fps、20 秒，带审片标记且没有声音。该检查核对媒体参数；你仍需实际观看画面。输出目录会自动创建；再次试跑请换一个输出文件名，已有视频默认不会被覆盖。

## 4. 让 Agent 制作自己的内容

在 Coding Agent 中打开整个 `frame-loom` 仓库；本机渲染依赖与 Agent 的使用权限分别准备。

| Agent | 如何加载与调用 |
| --- | --- |
| Codex | 在仓库中开启会话，输入“使用 frame-loom Skill”。仓库内的 `.agents/skills/frame-loom/SKILL.md` 会指向共享流程 |
| Claude Code | 从仓库根目录运行 `claude --plugin-dir .`，再输入 `/frame-loom:frame-loom`。插件显式注册同一个 Skill 入口；插件结构依据[官方文档](https://code.claude.com/docs/en/plugins-reference) |
| 其他 Coding Agent | 明确要求它先读取根目录 `SKILL.md`，并从仓库根目录执行命令 |

回到 [README 的自带文档试跑](../README.md#快速开始)，复制对应指令。正常情况下，Agent 会新建 `projects/YYYYMMDD-内容主题/`，返回其中 `output/preview-silent.mp4` 的实际路径及检查结果。视频渲染在本地；Agent 和可选 TTS 的网络请求与费用取决于所选服务。第一条静音预览无需 TTS Key。

## 常见安装问题

| 现象 | 下一步 |
| --- | --- |
| Node 版本低于 24，或出现 `EBADENGINE` | 切换到 Node.js 24+，重新打开终端，确认 `node --version` 后再运行 `npm ci` |
| 找不到 `ffmpeg` / `ffprobe` | 完成 FFmpeg 安装并检查 `PATH`；终端和 Agent 都重新启动，再分别确认能读取版本 |
| Agent 找不到 Skill | 确认打开的是整个仓库。Claude Code 需带 `--plugin-dir .` 启动；其他 Agent 可先显式读取 `SKILL.md` |
| 首次渲染停在浏览器下载或下载失败 | 保留下载错误，检查终端的网络与代理设置；恢复连接后重跑命令 |
| 已安装依赖，却提示缺少包或找不到 `package.json` | 确认当前目录含 `package.json`，并在这里执行 `npm ci` |
| 提示输出文件已存在 | 使用新的输出路径。需要覆盖时，先核对目标，再使用 renderer 的 `--force` 参数 |
| `review` 模式拒绝未经审核的分镜 | 首次试跑使用上面的 `--mode fast`；正式使用 review 时按[使用指南](usage-guide.md)完成分镜审核 |
| 静音预览没有声音 | 这是预期结果。需要旁白时继续配置 [TTS](tts-setup.md)，或提供匹配的外部配音 |

仍无法解决时，提交[安装或运行问题](https://github.com/Acorn2/frame-loom/issues/new?template=setup-problem.yml)，提供系统、工具版本、实际命令和错误输出。删除日志中的密钥、私人路径和私有材料。
