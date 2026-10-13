# Contributing

[Project home](README.en.md) · [Documentation index (Chinese)](references/README.md)

FrameLoom favors small, deterministic changes that keep the storyboard contract, validator and renderer aligned.

For first-time setup and troubleshooting, see the [installation guide](references/installation.en.md). To produce your first video, start with the [README](README.en.md#quick-start).

## Report a problem

Use the [setup issue form](https://github.com/Acorn2/frame-loom/issues/new?template=setup-problem.yml) for installation, Skill loading, or rendering failures, and the [video feedback form](https://github.com/Acorn2/frame-loom/issues/new?template=video-feedback.yml) for visual or narration problems. Include the commit ID (`git rev-parse --short HEAD`), relevant tool versions, steps, and a minimal public-safe example. Report suspected vulnerabilities through [Security](SECURITY.md).

## Prepare a change

Keep each pull request focused on one problem. Explain larger contract or workflow changes in an issue before implementation so their scope can be reviewed.

- Keep schema, capability manifest, validator fixtures, and renderer aligned when adding runtime behavior. Recipes use static registration, not dynamic user-supplied code.
- Preserve legacy storyboards unless the change explicitly requires a reviewed migration. Do not put example copy, paths, or product facts into system renderers.
- Record asset and method sources with their licenses. Do not commit user projects, private assets, credentials, or unlicensed media. Generated production videos stay local; public demonstration assets need explicit source records.
- Update the relevant current guide when behavior changes. Keep README focused on discovery and first use; put detailed procedures in `references/` and link them from the [documentation index](references/README.md). Preserve dated validation records as historical evidence.

## Local checks

Use Node.js 24 or later (Node.js 24 LTS recommended), plus FFmpeg/ffprobe. CI and the Pages workflow use Node.js 24.

```bash
npm ci
npm run check:docs
npm run validate:styles
npm run validate:shots
npm run typecheck
npm run lint
npm test
npm run build
```

When schema definitions change, also run `npm run generate:schemas` and include the resulting contract updates.

For runtime changes, validate and render the relevant example, then run `qa:storyboard` and inspect all contact-sheet pages. For layout changes, run `npm run test:content-layout -- --all --only <sample-id,...>` against relevant library samples. It preserves each fixture's font and checks required event and handoff frames.

CI is configured to validate, render, inspect, and QA the README's bundled silent preview. It also checks shared Codex / Claude Skill registration and code-title / barn-door layouts across six styles with the same Linux font packages as Pages. These checks do not prove actual agent loading, document planning, or complete human playback.

## Open a pull request

Describe the problem, the resulting behavior, and the checks you actually ran. Include affected contract versions or compatibility limits when relevant. For visual changes, attach public-safe representative frames and identify the tested sample and font. State any remaining playback or platform checks; automated QA alone is not a delivery approval.

Keep secrets and private production artifacts out of diffs, logs, and attachments. Publishing, deploying Pages, and creating a Release are separate maintainer actions.

## Release maintenance

For a public beta release, review the [release notes draft and publication checks](references/release-notes-v0.5.md) against the actual release commit and deployed library.
