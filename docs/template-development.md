# Template Development

Templates express recurring semantic structures. Add one only when existing templates cannot represent the meaning cleanly.

## Change set

1. Add the ID to `TEMPLATE_IDS` in `src/schemas/storyboard.ts`.
2. Implement the component under `src/templates/<template-id>/` and route it from `src/renderer/render-scene.tsx`.
3. Add the template to `src/renderer/capability-manifest.ts` only after it renders.
4. Define semantic requirements in `src/validation/mapping-validator.ts`.
5. Update Style Pack support declarations and renderer maps only for compatible packs.
6. Add a representative fixture and validator/render regression.
7. Regenerate JSON schemas and update the storyboard reference.

Do not use free-text motion or style metadata as an executable escape hatch. Schema, renderer, capability manifest, validation and fixtures must move together.
