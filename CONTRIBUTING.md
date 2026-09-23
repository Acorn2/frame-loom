# Contributing

FrameLoom favors small, deterministic changes that keep the storyboard contract, validator and renderer aligned.

## Local checks

```bash
npm ci
npm run generate:schemas
npm run validate:styles
npm run typecheck
npm run lint
npm test
npm run build
```

For runtime changes, validate and render the relevant example, then run `qa:storyboard` and inspect the contact sheet. Do not commit generated videos, user projects, private assets, credentials or unlicensed media.

New templates must follow `docs/template-development.md`; new visual packs must follow `docs/style-pack-development.md`. Update public documentation when a capability moves from planned to implemented.
