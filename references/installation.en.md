# Installation and first run

[简体中文](installation.md) · [Back to README](../README.en.md#quick-start)

FrameLoom renders videos on your computer. Install Git, Node.js 24+, and FFmpeg including ffprobe. To turn your own documents into videos, you also need a working coding agent. Node.js 24 LTS is recommended and used by CI.

## 1. Prepare your environment

Choose **24 LTS** and your operating system on the [official Node.js download page](https://nodejs.org/en/download). npm is included. If you use a version manager, switch to Node.js 24 instead of installing another copy.

### macOS

If you already use [Homebrew](https://brew.sh/), install Git and FFmpeg:

```bash
brew install git ffmpeg
```

Without Homebrew, use the [Git downloads](https://git-scm.com/downloads) and the prebuilt options on the [FFmpeg download page](https://ffmpeg.org/download.html). Add the directory containing both `ffmpeg` and `ffprobe` to `PATH`.

### Windows

In PowerShell, if WinGet is installed:

```powershell
winget install --id Git.Git --exact --source winget
winget install --id Gyan.FFmpeg --exact --source winget
```

Open a new PowerShell window after installation so it picks up the updated `PATH`. Without WinGet, install [Git](https://git-scm.com/downloads), then get a prebuilt package from the [Windows links on FFmpeg's download page](https://ffmpeg.org/download.html). Add the `bin` directory containing `ffmpeg.exe` and `ffprobe.exe` to `PATH`.

### Ubuntu / Debian

Install Node.js 24 LTS using its official download instructions; the distribution's default `nodejs` package may be too old. Install Git and FFmpeg with:

```bash
sudo apt-get update
sudo apt-get install -y git ffmpeg
```

On other Linux distributions, use the relevant package manager or one of the [prebuilt FFmpeg options](https://ffmpeg.org/download.html).

### Check your tools

Run these in the terminal that will run FrameLoom. They also work in PowerShell:

```bash
git --version
node --version
npm --version
ffmpeg -version
ffprobe -version
```

All five commands should print a version, and Node.js must be at least `v24.x`. These checks do not call an agent or TTS service. Local installation and rendering have been verified on macOS; Ubuntu is covered by CI. The Windows instructions have not yet been verified through a complete installation and render.

## 2. Download the project

```bash
git clone --depth 1 https://github.com/Acorn2/frame-loom.git
cd frame-loom
npm ci
```

Run subsequent commands from this repository root. Fonts are included and do not need a system installation. The first render may download Remotion's browser and needs a network connection.

### Choose a version and update

The commands above download the current `main` branch. Two commits with the same package version can have different behavior. When reporting an issue, run `git rev-parse --short HEAD` from the repository root and include the commit ID.

For a fixed version, choose an existing tag from [GitHub Releases](https://github.com/Acorn2/frame-loom/releases) and follow that Release's installation commands. If no Release exists, the version in `package.json` does not mean a matching tag is available.

For updates, install into a new directory and render the bundled sample first. Keep the old directory's `projects/`, private assets, and local configuration. Once the new version works, ask the agent to continue from your existing project. Old storyboards keep their original contract; delivery requires a new render, QA, and review. Do not overwrite your project with a new example storyboard. To roll back, use the retained installation and its original outputs.

To keep following `main`, run `git pull --ff-only` in an installation without source changes, then run `npm ci` and the sample checks below. If Git reports conflicts or local changes, keep that directory and install into a new one instead of forcing a reset.

## 3. Confirm that rendering works

Render the prepared document-only public storyboard into a 20-second landscape sample. No coding agent, TTS configuration, or API key is needed for this step:

```bash
npm run render:storyboard -- examples/creator-production-pilot/storyboard.json .tmp/quick-start/preview-silent.mp4 --mode fast
npm run inspect:output -- .tmp/quick-start/preview-silent.mp4 examples/creator-production-pilot/storyboard.json
```

After `OUTPUT OK`, open `.tmp/quick-start/preview-silent.mp4` in a local player. Expect 1920×1080, 30 fps, 20 seconds, a review marker, and no audio. The inspection checks media properties; watch the actual pictures as well. The output directory is created automatically. Use another filename when repeating the sample; existing videos are protected from overwriting.

## 4. Use a coding agent

Open the entire `frame-loom` repository in your coding agent. Agent access and local rendering tools are separate prerequisites.

| Agent | Load and invoke the Skill |
| --- | --- |
| Codex | Start a session in this repository and ask it to use the frame-loom Skill. `.agents/skills/frame-loom/SKILL.md` points to the shared workflow |
| Claude Code | Run `claude --plugin-dir .` from the repository root, then invoke `/frame-loom:frame-loom`. The manifest explicitly registers the same Skill entry; see the [official plugin reference](https://code.claude.com/docs/en/plugins-reference) |
| Other coding agents | Ask the agent to read the root `SKILL.md` first and execute commands from the repository root |

Continue with the [bundled document prompt in the README](../README.en.md#quick-start). The agent creates a `projects/YYYYMMDD-topic/` project and reports its `output/preview-silent.mp4` path and checks. Rendering runs locally. Network requests and charges for the coding agent and optional TTS depend on the services you choose. The first silent preview needs no TTS key.

## Troubleshooting

| Symptom | Next step |
| --- | --- |
| Node.js below 24 or `EBADENGINE` | Switch to Node.js 24+, open a new terminal, verify the version, and run `npm ci` |
| `ffmpeg` or `ffprobe` not found | Install FFmpeg and check `PATH`. Restart both the terminal and agent, then confirm the versions in each environment |
| The agent cannot find the Skill | Open the whole repository. Start Claude Code with `--plugin-dir .`; other agents can explicitly read `SKILL.md` |
| Browser download stalls or fails | Keep the download error, check terminal networking and proxy settings, and retry after connectivity is restored |
| Missing packages or `package.json` | Run commands from the directory containing `package.json` and install dependencies with `npm ci` |
| Output already exists | Choose a new output filename. To replace a file, check the target first and explicitly use the renderer's `--force` option |
| Review mode rejects an unapproved storyboard | Use `--mode fast` for this first run; follow the [usage guide (Chinese)](usage-guide.md) for review approval |
| The preview has no sound | Silent previews intentionally have no audio. Configure [TTS (Chinese)](tts-setup.md) or provide matching external voiceover to continue |

If you are still blocked, open a [setup or runtime issue](https://github.com/Acorn2/frame-loom/issues/new?template=setup-problem.yml). Include your OS, tool versions, exact command, and error output. Remove credentials, private paths, and private source material.
