# Review Checklist

Use this checklist after the storyboard is reviewed and again after rendering. A pass in one section does not imply a pass in another.

## Storyboard review

- [ ] Claims match the source; uncertainty is visible.
- [ ] Every scene has one clear job.
- [ ] Key scenes name one `primaryClaim` and a visible `attentionTarget`.
- [ ] Every important meaning maps to a visible layer, relationship, beat or caption.
- [ ] Reading order is clear without narration.
- [ ] Beat and caption timing stays inside each scene.
- [ ] The last important beat leaves a visible hold before the transition.
- [ ] No scene has two competing `current` nodes; completed steps remain traceable.
- [ ] Only renderer-supported templates and actions are used.
- [ ] `storyboard.draft.json` remains separate from reviewed `storyboard.json`.

## Asset review

- [ ] Every screenshot or image path resolves relative to the storyboard.
- [ ] `asset-manifest.json` records source, license/permission and intended use.
- [ ] Real product states are not replaced with invented UI.
- [ ] No private data, credentials or unlicensed bundled assets are present.

## Automated QA

```bash
npm run validate:storyboard -- <storyboard.json>
npm run validate:assets -- <storyboard.json>
npm run check:safe-area -- <storyboard.json>
npm run qa:storyboard -- <storyboard.json> <preview.mp4> [output-dir]
```

- [ ] Validator returns no errors.
- [ ] Safe-area checker returns no errors for the target orientation.
- [ ] Text-layout check reports no estimated card or caption overflow; inspect titles and line breaks in rendered frames.
- [ ] Resolution, fps and duration match the storyboard.
- [ ] Silent preview contains exactly one H.264 video stream and no audio stream.
- [ ] A video of at least 20 seconds produces at least six review frames.
- [ ] `qa-report.json` records automated checks and leaves manual review pending.

## Audio QA when enabled

- [ ] `audio-config.json` records source and license for every enabled track.
- [ ] `inspect:audio` reports no voiceover, SFX or subtitle overflow.
- [ ] Narration pronunciation and pacing were checked by listening to the full video.
- [ ] Music and SFX do not mask narration.
- [ ] Subtitle timing, line length and safe-area readability were reviewed.

## Visual QA

- [ ] Contact sheet includes opening, content, transitions and ending.
- [ ] Overlap handoffs show the incoming subject before the old scene disappears, without unreadable double titles.
- [ ] An illustrative object is labelled as a diagram; real product evidence is identified separately.
- [ ] The final claim remains stable for the declared `outro.holdFrames` before fade.
- [ ] Titles, captions and content stay readable on the target canvas.
- [ ] No text, card or screenshot crosses the visual safe area.
- [ ] Style differences affect surface, type, layout character and emphasis—not only color.
- [ ] No scene becomes static for longer than its content requires.
- [ ] Transitions do not hide the final meaning of the outgoing scene.
- [ ] Full video was watched at normal speed.

## Delivery statement

Report exactly what was checked and what remains provisional. Call the default output a **silent visual preview** and optional audio output an **audio pilot** until manual review is complete.
