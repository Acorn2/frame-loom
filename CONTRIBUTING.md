# Contributing

FrameLoom favors small, deterministic changes that keep the storyboard contract, validator and renderer aligned.

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
