# Contributing

FrameLoom favors small, deterministic changes that keep the storyboard contract, validator and renderer aligned.

For first-time setup and troubleshooting, see the [installation guide](references/installation.en.md). To produce your first video, start with the [README](README.en.md#quick-start).

CI runs the README's bundled silent preview through validation, rendering, output inspection and automated QA. The shared Codex / Claude Skill registration is checked by the test suite; actual agent loading and document planning still need a separate end-to-end run.

For layout changes, run `npm run test:content-layout -- --all --only <sample-id,...>` against the relevant library samples. It preserves each fixture's font and checks all required event and handoff frames; explicit font cases still test their selected family. CI covers code titles and barn-door chapter transitions across all six styles with the same Linux font packages as Pages.

## Local checks

Use Node.js 24 or later (Node.js 24 LTS recommended), plus FFmpeg/ffprobe. CI and the Pages workflow use Node.js 24.

```bash
npm ci
npm run generate:schemas
npm run check:docs
npm run validate:styles
npm run validate:shots
npm run typecheck
npm run lint
npm test
npm run build
```

For runtime changes, validate and render the relevant example, then run `qa:storyboard` and inspect the contact sheet. Do not commit generated videos, user projects, private assets, credentials or unlicensed media.

New templates and visual packs must follow the contracts and conventions documented in the public repository. Update public documentation when a capability moves from planned to implemented.

For a public beta release, review the [release notes draft and publication checks](references/release-notes-v0.5.md) against the actual release commit and deployed library.
