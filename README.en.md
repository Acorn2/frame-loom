<div align="center">

[简体中文](README.md) · [English](README.en.md)

<img src="./library/brand/logo.svg" alt="FrameLoom logo: document and play symbols" width="112" height="112">

<h1>FrameLoom</h1>

**Turn documents into videos with a coding agent**

A local document-to-video Skill for Codex, Claude Code, and other coding agents

[![Recipe library](https://img.shields.io/badge/Library-live%20previews-2855d9)](https://acorn2.github.io/frame-loom/)
[![CI](https://github.com/Acorn2/frame-loom/actions/workflows/ci.yml/badge.svg)](https://github.com/Acorn2/frame-loom/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-24%2B-339933)](package.json)
[![GitHub stars](https://img.shields.io/github/stars/Acorn2/frame-loom)](https://github.com/Acorn2/frame-loom/stargazers)

**6 video styles · 40 scene recipes · 5 Chinese font families · silent previews / clean visual masters / narrated videos**

[Browse the library](https://acorn2.github.io/frame-loom/) · [Quick start](#quick-start) · [Usage guide](references/usage-guide.md) · [Contribute](CONTRIBUTING.md)

</div>

**FrameLoom** is a local video production Skill built primarily for Codex and compatible with Claude Code and other coding agents. Give the agent an article, script, or product document. It interprets the content and writes the script and storyboard; Remotion validates and renders the visuals. Start with a silent preview, then export a clean visual master for an external editor or make a narrated video in the project with TTS or existing voiceover.

**When you provide screenshots, the video prioritizes their colors over the selected style's default palette.** Backgrounds, text, cards, and accents follow the subject screenshots; the style still controls composition, decoration, and motion. See [screenshot colors](#how-screenshots-affect-video-colors).

It is suited to knowledge explainers, product walkthroughs, report summaries, and data explanations. **v0.5 is a public beta.** The creator must review generated claims and facts. A clean visual handoff or narrated delivery also requires a full human playback review after automated QA.

**[Explore styles and shot recipes →](https://acorn2.github.io/frame-loom/)** Choose a style, copy the production prompt, and give your document to a local agent. It recommends recipes from the document by default; manual pools remain available. The website does not upload documents or produce videos.

```text
Document / document + images → Agent-written script and storyboard → validation and Remotion render → preview / visual master / narrated video → QA and human review
```

## See the results

These six styles were rendered by Remotion from [the same public storyboard](examples/template-families/storyboard.semantic.json). Each silent sample has seven shots and runs for 50.8 seconds.

| Editorial Ink | Signal | Sketch Notes |
| --- | --- | --- |
| ![Editorial Ink opening frame](examples/template-families/previews/retro-zine-semantic-opening.png) | ![Signal opening frame](examples/template-families/previews/signal-semantic-opening.png) | ![Sketch Notes opening frame](examples/template-families/previews/scatterbrain-semantic-opening.png) |
| [Watch silent sample](examples/template-families/previews/retro-zine-semantic.mp4) | [Watch silent sample](examples/template-families/previews/signal-semantic.mp4) | [Watch silent sample](examples/template-families/previews/scatterbrain-semantic.mp4) |

| Swiss Blue | Blueprint | Product Frame |
| --- | --- | --- |
| ![Swiss Blue opening frame](examples/template-families/previews/archive-grid-semantic-opening.png) | ![Blueprint opening frame](examples/template-families/previews/signal-noir-semantic-opening.png) | ![Product Frame opening frame](examples/template-families/previews/studio-frame-semantic-opening.png) |
| [Watch silent sample](examples/template-families/previews/archive-grid-semantic.mp4) | [Watch silent sample](examples/template-families/previews/signal-noir-semantic.mp4) | [Watch silent sample](examples/template-families/previews/studio-frame-semantic.mp4) |

For more inputs and outcomes, see the [document-only pilot](examples/creator-production-pilot/README.md), [knowledge notes](examples/video-templates/knowledge-notes/README.md), and [product update demo](examples/video-templates/product-update/README.md). These public samples help you choose a look; your document gets its own project and storyboard.

## Quick start

### 1. Install

You need **Node.js 24+** (Node.js 24 LTS recommended) and **FFmpeg / ffprobe**.

```bash
git clone https://github.com/Acorn2/frame-loom.git
cd frame-loom
npm ci
```

Open a coding agent in this repository:

- **Codex:** Ask it to “use the frame-loom Skill.” The repository's [Skill entry point](.agents/skills/frame-loom/SKILL.md) loads the shared workflow.
- **Claude Code:** Run `claude --plugin-dir .` from the repository root; see the [plugin manifest](.claude-plugin/plugin.json).
- **Other coding agents:** Ask the agent to read the root [SKILL.md](SKILL.md) first and run commands from the repository root.

The first render may download the browser used by Remotion. For environment checks, see [CONTRIBUTING.md](CONTRIBUTING.md).

### 2. Give the agent a document

Paste this into the **agent chat** and replace the placeholder with the absolute path to an existing Markdown or plain-text document. The example specifies a style and lets the agent choose compatible recipes from the document:

```text
Use the frame-loom Skill to turn <absolute document path> into a 16:9 silent review preview.
Video style: retro-zine
Recommend compatible recipes from the source and plan each scene with its source, visible explanation, and selection reason. Do not fill every library category.
Briefly show the combination and continue production without an additional confirmation.
Use fast mode. Preserve the original source and complete the script, Storyboard 2.4, validation, render, and QA.
Report the project path, preview-silent.mp4 path, actual duration, and QA result.
```

You do not need to write JSON, create a project directory, or configure audio for this first preview. The agent creates a `YYYYMMDD-topic` project and returns the actual path to `preview-silent.mp4`, representative frames, duration, and QA result. The video has a review marker and is for checking visuals. You can continue in the same project to make a visual master or narrated version.

To constrain the agent, provide an explicit “Available shot recipes” list. See [document-driven shot planning](references/shot-planning.md) for selection and content review. Provide local paths for images or exact URLs for screenshots. To review the script and storyboard first, request **review mode** and ask the agent to wait for your approval before rendering.

### Optional: choose a look in the browser

In the [online recipe library](https://acorn2.github.io/frame-loom/), choose **video style → production settings**. Document-driven shot selection is the default; you can optionally choose a manual recipe pool. Copy the production prompt into your local agent chat and provide the document there. You do not need to start the library's local web server to produce a video; your document and video production stay in the local project.

## What is included

### How screenshots affect video colors

Provide subject-product screenshots or an exact URL for the agent to capture. The video uses their background, title/body text, card surfaces, and accent colors, including warm or colored backgrounds. It does more than replace a button color. Original screenshots and their embedded fonts remain unchanged; the chosen style keeps its composition, decoration, and motion, and the project font remains independent.

The default **Auto** mode uses subject screenshots as color references. Citation or competitor screenshots do not automatically determine the subject's palette. Without a color reference, the style and recipe defaults apply. You can explicitly choose **Follow product assets** or **Use style colors**; choosing a video style alone does not disable screenshot color references. Source palettes currently support the six active styles and 40 current landscape scenes; unsupported combinations are reported.

Ask the agent to “use the screenshots' background, text, card, and accent colors while keeping my chosen style's composition and motion.” It records the color sources and compares representative rendered shots with the screenshots. Public library samples show default colors, not the final palette after your screenshots are added. See the [project color workflow](references/project-palette.md).

### Capabilities

| Area | Current capability |
| --- | --- |
| Video styles | 6 Style Packs for default colors, composition, and base motion; [browse styles](#six-video-styles) |
| Screenshot colors | Subject screenshots guide backgrounds, text, cards, and accents independently of style, font, and shots; [how it works](#how-screenshots-affect-video-colors) |
| Scene recipes | 40 independent scenes for titles, key points, comparisons, relationships, processes, and data; [recipe catalog](shots/README.md) |
| Supporting effects | 9 hosted actions and 5 chapter transitions; hosted actions require compatible scenes |
| Project-wide fonts | Source Han Sans, Source Han Serif, LXGW WenKai, Smiley Sans, and Xiaolai; one family per video, with 30 landscape style × font references |
| Optional preset | `retro-zine-explainer`, a landscape knowledge explainer combination; [guide](video-templates/retro-zine-explainer/guide.md) |
| Output routes | Silent review preview, clean visual master, script handoff, and in-project narrated video using TTS or external voiceover |
| Local production | Storyboard contract, asset provenance checks, render receipts, QA reports, and approval fingerprints; [shared workflow](SKILL.md) |
| Recipe library | Real samples, combination selection, and a copyable production prompt; runs locally or on GitHub Pages |

The runtime currently registers **40 scene recipes, 9 hosted actions, and 5 chapter transitions**, with **48/48 shortlist candidates** adapted. All 40 current scenes support all six active styles in 16:9 landscape. In 9:16 portrait, `semantic-default`, `type-and-filter`, `ai-stream-response`, and `unit-dot-regroup` are available. Scene recipes and presets remain experimental; the [capability manifest](src/renderer/capability-manifest.ts) is the authority for supported combinations.

## Six video styles

| Style | ID | Good for |
| --- | --- | --- |
| [Editorial Ink](styles/retro-zine/preview.md) | `retro-zine` | Essays, knowledge explainers, stories |
| [Signal](styles/signal/preview.md) | `signal` | Main arguments, turning points, emphasis |
| [Sketch Notes](styles/scatterbrain/preview.md) | `scatterbrain` | Study notes, methods, idea mapping |
| [Swiss Blue](styles/archive-grid/preview.md) | `archive-grid` | Reports, analysis, structured methods |
| [Blueprint](styles/signal-noir/preview.md) | `signal-noir` | Systems, mechanisms, technical processes |
| [Product Frame](styles/studio-frame/preview.md) | `studio-frame` | Product explanations, tutorials, workflows |

Style and font are independent choices. The selected shot pool limits what the agent may use: it may repeat, reorder, or omit recipes, but must not add an unselected recipe. See the [font catalog](fonts/README.md) for sources and pinned versions, and the [usage guide](references/usage-guide.md) for manual initialization.

## Choose an output

| Goal | Artifact and completion condition |
| --- | --- |
| Check the visuals first | `preview-silent.mp4`: silent preview with a review marker |
| Continue in an external editor | `visual-master-vNNN.mp4`: no audio track, narration captions, or review marker; includes script and shot timing handoff; requires a full visual playback review |
| Record voiceover before rendering | `output/script-handoff/`: script and storyboard; no MP4 in this first stage |
| Finish a narrated video in FrameLoom | `pilot-audio.mp4`: uses configured TTS or matching external voiceover; requires a full playback review after automated QA |

`fast` proceeds through the selected stage without a storyboard approval stop. `review` requires script and storyboard approval before production. Both modes support the outputs above. Passing automated QA does not mean the video has passed human review. Videos finished later in an external editor are reviewed there.

TTS integrations cover Doubao, OpenAI, ElevenLabs, Alibaba Cloud Model Studio, and MiniMax. Configure only the provider you use, or supply existing voiceover with optional SRT/VTT subtitles. The example profiles are disabled by default and credentials are read from environment variables. Missing or mismatched audio is reported rather than treated as a narrated delivery. See the [usage guide](references/usage-guide.md) and [audio integration guide](references/audio-integration.md).

TTS settings are validated per provider; `list:tts-profiles` reports readiness and missing configuration. Use `preview:tts` for an explicit short audition before full synthesis. Supported reading instructions, pronunciation dictionaries, scene context and final sample rates are described in the [voice controls guide](references/audio-integration.md#validated-voice-controls).

### Configure TTS

Choose one provider. Copy its preset to your existing project's `audio/tts-config.json`, set `enabled` to `true`, and supply the required process environment variables. Follow the [provider setup guide (Chinese)](references/tts-setup.md) for complete JSON examples and credential locations; the [audio integration guide](references/audio-integration.md#built-in-tts-contract) describes the contract in English.

| Provider | Repository preset | Required environment variables | Preset model / voice |
| --- | --- | --- | --- |
| [Doubao](references/tts-setup.md#豆包) | [doubao.json](examples/tts-profiles/doubao.json) | `VOLC_TTS_API_KEY`, `VOLC_TTS_RESOURCE_ID`, `VOLC_TTS_SPEAKER` | v3 / environment voice |
| [OpenAI](references/tts-setup.md#openai) | [openai.json](examples/tts-profiles/openai.json) | `OPENAI_API_KEY` | `gpt-4o-mini-tts` / `alloy` |
| [ElevenLabs](references/tts-setup.md#elevenlabs) | [elevenlabs.json](examples/tts-profiles/elevenlabs.json) | `ELEVENLABS_API_KEY` | `eleven_multilingual_v2` / `JBFqnCBsd6RMkjVDRZzb` |
| [Alibaba Cloud](references/tts-setup.md#阿里百炼) | [aliyun.json](examples/tts-profiles/aliyun.json) | `DASHSCOPE_API_KEY` (Beijing) | `qwen3-tts-flash` / `Cherry` |
| [MiniMax](references/tts-setup.md#minimax) | [minimax.json](examples/tts-profiles/minimax.json) | `MINIMAX_API_KEY` | `speech-2.8-hd` / `male-qn-qingse` |

For a first MiniMax setup, run from the repository root and replace `projects/my-video` with an existing project path:

```bash
cp -n examples/tts-profiles/minimax.json projects/my-video/audio/tts-config.json
```

Edit the target JSON to set `"enabled": true`. `cp -n` keeps an existing target, so inspect that file if you already configured another provider. Set the key in the same terminal that runs FrameLoom, then check locally:

```bash
export MINIMAX_API_KEY='<your MiniMax API key>'
npm run list:tts-profiles -- projects/my-video
```

`ready` confirms local settings and environment presence only. To explicitly audition the voice, run the following command; it calls the provider and may incur charges:

```bash
npm run preview:tts -- projects/my-video --tts-config projects/my-video/audio/tts-config.json --text "Hello, please check this voice and speaking speed."
```

The original audio is saved under `audio/previews/`. For PowerShell, set keys with `$env:MINIMAX_API_KEY = '<your key>'` and copy with `Copy-Item` only when the target does not exist. FrameLoom does not automatically load `.env` files, and web presets do not configure credentials. Keep actual keys out of JSON and Git. The [setup guide](references/tts-setup.md#检查与制作) covers production commands, multiple profiles and troubleshooting.

## Repository layout

```text
frame-loom/
├── SKILL.md                 # Shared production workflow for coding agents
├── .agents/skills/          # Codex discovery entry point
├── .claude-plugin/          # Claude Code plugin metadata
├── src/                     # Remotion, storyboard types, validation, renderer
├── schemas/                 # Public JSON Schema contracts
├── shots/                   # Scene, hosted-action, and transition recipes
├── video-templates/         # Optional preset combinations
├── styles/                  # Style Packs
├── fonts/ & public/fonts/   # Font catalog, files, and original licenses
├── library/                 # Recipe library website and public samples
├── examples/                # Public documents, storyboards, and visuals
├── scripts/                 # Validation, initialization, rendering, and QA
├── references/              # Guides and production contracts
└── projects/                # Local user projects; not committed to Git
```

## Docs and development

Some linked reference guides are in Chinese. The shared Skill, audio integration guide, and contributing guide are in English.

- [Usage guide](references/usage-guide.md): production routes, fonts, CLI, audio, and delivery review.
- [TTS setup guide (Chinese)](references/tts-setup.md): credentials, complete profiles, environment variables, checks, auditions, and troubleshooting for all five providers.
- [Shared Skill](SKILL.md) and [Storyboard contract](references/storyboard-schema.md): agent workflow and rendering inputs.
- [Quality production guide](references/quality-production.md): measured audio timing, captions, and shot quality.
- [Local library and Pages guide](library/README.md): server setup, sample generation, and static deployment for local browsing or library maintenance.
- [Contributing](CONTRIBUTING.md), [changelog](CHANGELOG.md), and [security reporting](SECURITY.md).

For local changes, run `npm run check:docs`, `npm run validate:shots`, `npm run typecheck`, `npm run lint`, and `npm test` as relevant. Runtime changes also require rendering the affected examples and reviewing the actual visuals. See [CONTRIBUTING.md](CONTRIBUTING.md) for the complete development checks.

## Credits and licenses

- [Remotion](https://www.remotion.dev/) provides deterministic video rendering with React.
- [video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft) informed the shot recipe method and this README's presentation structure. Individual `provenance.json` files and the [shortlist coverage ledger](shots/shortlist-coverage.json) record the adaptation and license details.
- The bundled open-source Chinese fonts retain original copyright notices and SIL OFL 1.1 licenses in the [font directory](fonts/README.md).

FrameLoom's own code is [MIT licensed](LICENSE). Remotion has a separate [official license](https://www.remotion.dev/license). Fonts, images, music, and TTS output follow their own source terms; FrameLoom's MIT license does not replace them.

## Maintainer

Maintained by **Hresh赫什**, an independent developer building products with AI. Follow the project and other work on the [personal website](https://hreshhao.com/). Report problems in [Issues](https://github.com/Acorn2/frame-loom/issues) or contribute using the [contributing guide](CONTRIBUTING.md).

## Layout reliability

New 2.4 projects explicitly enable content-first layout; older storyboards retain their original pictures. Production measures rendered text, nodes and fitted image bounds before publishing a candidate. Completed-state clipping and collisions fail the render; small media and repeated compositions require review. See the [layout contract](references/content-layout.md). Automated QA does not replace full playback or checking text embedded in source images.
