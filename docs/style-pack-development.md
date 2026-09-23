# Style Pack Development

A Style Pack changes visual tokens, safe areas and motion character without adding content facts or project-specific paths.

## Required files

Create `styles/<style-id>/` with `style.json`, `motion.json`, `renderer-map.json`, `preview.md` and `design.md`, then add a compact entry to `styles/style-index.json`. IDs use lowercase kebab-case and versions use semantic versioning.

`style.json` must declare both landscape and portrait safe areas, all supported runtime capabilities, and provenance for fonts and assets. `motion.json` tunes the shared renderer primitives. A pack may support a subset of the capability manifest, but its index entry and runtime declaration must agree.

## Verification

```bash
npm run generate:schemas
npm run validate:styles
npm run preview:styles -- /tmp/frame-loom-style-gallery.html
npm test
```

Finally render at least one landscape and one portrait fixture when the pack claims both orientations. Review actual frames; token differences alone do not prove a visually distinct, readable style.
