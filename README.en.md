<div align="center">

[简体中文](README.md) · [English](README.en.md)

<img src="./library/brand/logo.svg" alt="FrameLoom: document and play symbols" width="112" height="112">

<h1>FrameLoom</h1>

**Give your agent a document. Turn it into a video with diagrams and animation.**

A document-to-video Skill for Codex, Claude Code, and other coding agents

[![Library](https://img.shields.io/badge/Library-live%20previews-2855d9)](https://acorn2.github.io/frame-loom/)
[![CI](https://github.com/Acorn2/frame-loom/actions/workflows/ci.yml/badge.svg)](https://github.com/Acorn2/frame-loom/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-24%2B-339933)](package.json)

[See the results](#see-the-results) · [Make your first video](#quick-start) · [Browse styles](https://acorn2.github.io/frame-loom/) · [Installation and troubleshooting](references/installation.en.md)

</div>

**FrameLoom** lets a coding agent turn articles, scripts, and product documents into videos. The agent interprets your content and writes a script and storyboard; Remotion renders diagrams and animation on your computer. Start with a silent preview, then export clean visuals for an external editor or add voiceover to make a narrated video.

## See the results

**Real case: a children's nature museum promotional document becomes a narrated whiteboard video.** One document supplies the content for illustrations, line-by-line writing, and a four-stage diagram; the silent 10-second GIF below previews the result.

![Actual FrameLoom case: open whiteboard, four life stages, nature illustrations, and a closing website address](examples/nature-museum-case/previews/highlights.gif)

[Watch the full case · 68 seconds · with narration](examples/nature-museum-case/previews/nature-museum-narrated.mp4) · [Case and sources](examples/nature-museum-case/README.en.md) · [Diagram animation example](examples/template-families/README.md) · [Browse styles and shots online](https://acorn2.github.io/frame-loom/)

The full video has 7 whiteboard scenes, LXGW WenKai text, natural-speed Chinese narration, and `https://naturemuseum.top/` on the closing screen. The illustrations explain concepts; they are not product screenshots or actual 3D models. Automated QA passed; full playback and public asset-use terms still need review.

## What can you make?

| Your source | Possible videos |
| --- | --- |
| Articles, notes, scripts | Knowledge explainers, viewpoints, and methods |
| Product documents and real screenshots | Feature explanations, steps, and workflows |
| Reports and sourced data | Summaries, comparisons, processes, and data diagrams |

For creators who already use Codex, Claude Code, or another coding agent and want to turn written material into explainers. **v0.5 is a public beta.** The supported visuals focus on text, diagrams, and real assets; live action, narrative films, and complex 3D scenes are outside the current scope.

## Quick start

### 1. Install and open your agent

Prepare **Git, Node.js 24+, and FFmpeg / ffprobe**. Node.js 24 LTS is recommended. Follow the [installation guide](references/installation.en.md) if you need setup commands or version checks.

```bash
git clone --depth 1 https://github.com/Acorn2/frame-loom.git
cd frame-loom
npm ci
```

Open the entire `frame-loom` repository in your coding agent:

| Agent | How to use it |
| --- | --- |
| Codex | Start a session in this repository and ask it to use the frame-loom Skill |
| Claude Code | Run `claude --plugin-dir .` from the repository root, then invoke `/frame-loom:frame-loom` |
| Other coding agents | Ask it to read the root [SKILL.md](SKILL.md) and execute commands from this directory |

The first silent preview needs no TTS configuration or API key. The first render may download a browser. Prepare access to your chosen coding agent separately; its charges depend on that service.

<details>
<summary>Check rendering first: use the prepared sample without an agent</summary>

Run in your terminal:

```bash
npm run render:storyboard -- examples/creator-production-pilot/storyboard.json .tmp/quick-start/preview-silent.mp4 --mode fast
npm run inspect:output -- .tmp/quick-start/preview-silent.mp4 examples/creator-production-pilot/storyboard.json
```

After `OUTPUT OK`, open `.tmp/quick-start/preview-silent.mp4` in a local player. Expect a 1920×1080, 30 fps, 20-second silent video. The output directory is created automatically. Use a new filename when repeating this run. This route uses an existing storyboard; continue below to try document planning.

</details>

### 2. Try the bundled document

You do not need your own source file yet. Paste this into the **agent chat**:

```text
Use the frame-loom Skill to read examples/creator-production-pilot/source/source.md.
Make a 16:9 silent preview in Editorial Ink style (retro-zine).
Use fast mode, recommend shots from the document, and continue production directly.
Report the actual video path, duration, and check results, then open it for me to watch.
```

The agent creates a `projects/YYYYMMDD-topic/` project, preserves the source, writes the script and storyboard, renders, and runs QA. **The successful result is that project's `output/preview-silent.mp4`, with its actual duration and check results.** It has a review marker and no audio; the new video's content and duration depend on the agent's plan.

You do not need to write JSON, create project directories, or select every shot. After watching, tell the agent which scene to change and continue in the same project.

### 3. Use your own material

Replace the placeholder with a path to an existing Markdown or plain-text document, or attach the file:

```text
Use the frame-loom Skill to turn <document path> into a landscape silent preview.
Recommend a style and shots from the content, use fast mode, and continue production.
Report the video path, duration, and check results.
```

Attach product screenshots if available, or provide an exact URL for the agent to capture. Subject-product screenshots guide the colors by default, while the style controls composition and motion. Ask to “use the style's default colors” if you prefer. To review before rendering, request “review mode: show the script and storyboard, then wait for my approval.”

## Choose a style

The nine video styles fall into two groups based on how their visuals are built:

- **AI illustration styles**: Whiteboard (`whiteboard`), Annotated Reasoning (`annotated-reasoning`), and Editorial Typography (`editorial-typography`). For document-only production, the agent generates illustrations to support text and diagrams. Supplied screenshots are used directly without automatic image generation. Each style has a [fixed built-in shot workflow (Chinese)](references/primary-style-production.md).
- **Text and graphics motion styles**: Editorial Ink, Signal, Sketch Notes, Swiss Blue, Blueprint, and Product Frame. They compose typography, shapes, charts, and interface assets with shot animation, and can also use real images and screenshots. The agent can recommend shots, or you can restrict the selection manually.

These groups describe visual construction; explainers, product introductions, tutorials, and stories are content uses.

### Three AI illustration styles

The three AI illustration samples share the original Chinese copy “好问题，从观察开始” (“Good questions begin with observation”). Each is an 18-second landscape silent preview. These frames come from the actual videos; click a cover or “Watch sample” to see the animation. Text and diagrams lead, with illustrations supporting the explanation.

| Whiteboard | Annotated Reasoning | Editorial Typography |
| --- | --- | --- |
| [![Whiteboard sample: good questions begin with observation](examples/template-families/previews/whiteboard-original.png)](examples/template-families/previews/whiteboard-original.mp4) | [![Annotated Reasoning sample: good questions begin with observation](examples/template-families/previews/annotated-reasoning-text-led.png)](examples/template-families/previews/annotated-reasoning-text-led.mp4) | [![Editorial Typography sample: good questions begin with observation](examples/template-families/previews/editorial-typography-text-led.png)](examples/template-families/previews/editorial-typography-text-led.mp4) |
| Line-by-line writing · synchronized pencil · Xiaolai | Phrase annotations · cumulative relations · Source Han Serif | Persistent word rearrangement · unfolding relations · Source Han Sans |
| [Watch sample](examples/template-families/previews/whiteboard-original.mp4) | [Watch sample](examples/template-families/previews/annotated-reasoning-text-led.mp4) | [Watch sample](examples/template-families/previews/editorial-typography-text-led.mp4) |

All three support landscape video and require no manual shot selection. Text, numbers, and relations lead in Annotated Reasoning and Editorial Typography; auxiliary illustration boxes occupy at most 8% of the canvas. Select a project-wide font independently from the [font catalog (Chinese)](fonts/README.md). See [illustration production](references/illustrated-production.md) and [text-led production](references/text-led-production.md) for detailed steps (Chinese).

### Six text and graphics motion styles

The six text and graphics motion styles below use the same storyboard for comparison. These frames show the completed diagrams; the links open actual silent samples.

| Editorial Ink | Signal | Sketch Notes |
| --- | --- | --- |
| ![Editorial Ink relationship diagram](examples/template-families/previews/retro-zine-semantic-process.png) | ![Signal relationship diagram](examples/template-families/previews/signal-semantic-process.png) | ![Sketch Notes relationship diagram](examples/template-families/previews/scatterbrain-semantic-process.png) |
| [Watch sample](examples/template-families/previews/retro-zine-semantic.mp4) | [Watch sample](examples/template-families/previews/signal-semantic.mp4) | [Watch sample](examples/template-families/previews/scatterbrain-semantic.mp4) |

| Swiss Blue | Blueprint | Product Frame |
| --- | --- | --- |
| ![Swiss Blue relationship diagram](examples/template-families/previews/archive-grid-semantic-process.png) | ![Blueprint relationship diagram](examples/template-families/previews/signal-noir-semantic-process.png) | ![Product Frame relationship diagram](examples/template-families/previews/studio-frame-semantic-process.png) |
| [Watch sample](examples/template-families/previews/archive-grid-semantic.mp4) | [Watch sample](examples/template-families/previews/signal-noir-semantic.mp4) | [Watch sample](examples/template-families/previews/studio-frame-semantic.mp4) |

Choose a style in the [online library](https://acorn2.github.io/frame-loom/), copy its production prompt, and give it to your local agent with a document. The agent recommends shots from the content by default; manual selection is available. The website displays public samples; production runs in your local project.

## Continue from preview to finished video

| Desired result | Next step and output |
| --- | --- |
| A narrated video | Configure one of [Doubao TTS (provided through Volcengine), OpenAI, ElevenLabs, Alibaba, or MiniMax (Chinese guide)](references/tts-setup.md), or provide matching external voiceover; output: `output/pilot-audio.mp4` |
| Clean visuals for an external editor | Ask for a visual master; output: `output/visual-master-vNNN.mp4`, without audio, narration captions, or review markers, plus script and shot timings |
| Record voiceover before making visuals | Ask for a script handoff; output: `output/script-handoff/`, then bring your recording back |

Once TTS is configured, continue in the same project:

```text
Continue with a narrated version in the project we just created, using configured real TTS.
If several configurations are available, let me choose one.
Align the visuals to the measured voiceover duration, render, and run QA.
```

See the [usage guide (Chinese)](references/usage-guide.md) for configuration, external voiceover, and approval. Narrated deliveries and visual handoffs require your full playback review. Automated QA does not verify every fact, pronunciation, or visual decision.

For further adjustments, ask the agent to arrange captions and shots using [measured speech timing (Chinese)](references/speech-driven-production.md). The three AI illustration styles also support a top-right brand name or local logo, shared by the video and its cover; see [brand settings (Chinese)](references/branding.md).

## Common questions

**Do I need to write code or storyboard JSON?** No manual authoring is required. You need to install local tools, use a coding agent, and check its output. The CLI and JSON are the agent's working interface.

**Do I need voiceover? Are there charges?** The first silent preview needs no voiceover. Configure just one TTS provider if you want narration. Agent and TTS charges depend on their services; local rendering does not call a generative video API.

**Does it support portrait video?** The six text and graphics motion styles support both 16:9 landscape and 9:16 portrait: each has 43 landscape scene recipes, while portrait supports semantic diagrams, type and filter, AI response generation, and unit-dot regrouping. The three AI illustration styles currently support landscape only and follow their built-in workflows. See the [shot catalog (Chinese)](shots/README.md) for compatibility.

**Are documents uploaded to the library website?** The website does not receive documents. Rendering is local; your chosen agent or TTS service may receive source content or narration according to its configuration and terms.

**What if setup fails or the result needs improvement?** Start with [troubleshooting](references/installation.en.md#troubleshooting). Then submit a [setup or runtime issue](https://github.com/Acorn2/frame-loom/issues/new?template=setup-problem.yml) or [video feedback](https://github.com/Acorn2/frame-loom/issues/new?template=video-feedback.yml).

## Guides and contributions

- [Documentation index (Chinese)](references/README.md): installation, production, technical references, and maintenance.
- [Installation and troubleshooting](references/installation.en.md): English instructions for local tools, the first render, and agent loading.
- [Usage guide](references/usage-guide.md), [TTS setup](references/tts-setup.md), and [screenshot colors](references/project-palette.md): detailed guides, currently in Chinese.
- [Shared Skill](SKILL.md): agent workflow, primarily in English. [Shot catalog](shots/README.md) and [storyboard contract](references/storyboard-schema.md): technical references, currently in Chinese.
- [Contributing](CONTRIBUTING.md), [changelog (Chinese)](CHANGELOG.md), and [security reporting (Chinese)](SECURITY.md).

<details>
<summary>Developers: current shot capabilities</summary>

The runtime registers 52 scene recipes, 9 hosted actions, and 5 chapter transitions; 48/48 shortlist candidates are adapted. The registered total includes historical compatibility recipes; style support and fixed new-project workflows constrain actual selection. Scene recipes and presets remain experimental. The [capability manifest](src/renderer/capability-manifest.ts) defines supported combinations. See the [optional explainer preset](video-templates/retro-zine-explainer/guide.md) and [local library guide](library/README.md) for technical details (Chinese).

</details>

## Credits and licenses

- [Remotion](https://www.remotion.dev/) provides deterministic video rendering with React.
- [video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft) informed shot recipe methods and the presentation structure. Individual `provenance.json` files and the [coverage ledger](shots/shortlist-coverage.json) record sources and adaptation licenses.
- [whiteboard-video](https://github.com/trustfuture/simon-skills/tree/3ad0a25127c17da48a0e869c9efbf4136c40848b/skills/whiteboard-video) informed whiteboard drawing and production methods; the [original MIT notice](references/licenses/simon-whiteboard-MIT.txt) is retained.
- Bundled fonts retain original copyright notices and SIL OFL 1.1 licenses; see the [font directory](fonts/README.md).

FrameLoom's own code is [MIT licensed](LICENSE). Remotion has a separate [official license](https://www.remotion.dev/license). Fonts, images, music, and TTS output follow their own terms; FrameLoom's MIT license does not replace them.

Maintained by **Hresh赫什**, an independent developer building products with AI. See other projects and experiments on the [personal website](https://hreshhao.com/).
