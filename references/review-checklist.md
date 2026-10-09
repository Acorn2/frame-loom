# Review Checklist

Use this checklist after the storyboard is reviewed and again after rendering. A pass in one section does not imply a pass in another.

## Storyboard review

- [ ] For a new project, `project-input.json` records the creator's selected `document` or `document-images` mode; the storyboard follows it.
- [ ] `route-card.md` compares document-supported narrative and visual routes; the selected route has original text support.
- [ ] `content-gaps.md` names any unsupported claim or unclear relationship by claim and shot, with a narrower wording or visual revision.
- [ ] Each key claim in `shot-map.md` points to a source excerpt and an existing storyboard scene ID.
- [ ] The mapped scene visibly supports its claim, and replacing one scene does not silently change the others.
- [ ] Claims match the source; uncertainty is visible.
- [ ] Every scene has one clear job.
- [ ] Each new 2.3 scene has one conclusion and a `visual.kind` that visibly explains the actual difference, order, relationship, change, sourced number or media content; the shot does more than attach an icon to text.
- [ ] `visual.representation` distinguishes diagrams from source media; each metric has a traceable `visual.source`.
- [ ] Key scenes name one `primaryClaim` and a visible `attentionTarget`.
- [ ] Every important meaning maps to a visible layer, relationship, beat or caption.
- [ ] Reading order is clear without narration.
- [ ] Beat and caption timing stays inside each scene.
- [ ] The last important beat leaves a visible hold before the transition.
- [ ] Every scene boundary has an intentional hard cut or a timed handoff; a repeated hard-cut pattern is checked at normal speed rather than assumed acceptable.
- [ ] No scene has two competing `current` nodes; completed steps remain traceable.
- [ ] Only renderer-supported templates and actions are used.
- [ ] `storyboard.draft.json` remains separate from reviewed `storyboard.json`.
- [ ] `script.md` contains the exact `scene.narration` for every scene ID before a script or visual handoff.
- [ ] Planned facecam and subtitle overlays are recorded in `visual-handoff.json` before `review` approval.
- [ ] In `review` mode, the creator's storyboard review is recorded with `approve:storyboard`; later script, timing or overlay changes require renewed approval.

## Image source review

For `document` mode, `asset-manifest.json` may be empty and the storyboard contains no image/screenshot layers. For `document-images`, review all checks below.

- [ ] At least one image/screenshot is visible in a Storyboard 2.3 `visual.kind: media` scene (or a compatible 2.2 `media` scene).
- [ ] Every used screenshot or image resolves to a nonempty local file and is registered with the matching type in `asset-manifest.json`.
- [ ] `visual-sources.md` connects each used visual to the creator's path or exact URL, claim and shot. For URLs, it records the final URL, capture time, viewport and visible state.
- [ ] `asset-manifest.json` records source, actual license/permission state and intended use; unverified publication rights remain marked unverified.
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
- [ ] Silent preview or visual master contains exactly one H.264 video stream and no audio stream.
- [ ] A video of at least 20 seconds produces at least six review frames.
- [ ] For a 2.3 long video, every scene has a completed-state and pre-cut frame; `review-frames.json.pages` covers every numbered frame, with at most 48 frames per contact-sheet page.
- [ ] `qa-report.json` records automated checks and leaves manual review pending.

## Audio QA when enabled

- [ ] `audio-config.json` records source and license for every enabled track.
- [ ] `inspect:audio` reports no voiceover, SFX or subtitle overflow.
- [ ] Narration pronunciation and pacing were checked by listening to the full video.
- [ ] Music and SFX do not mask narration.
- [ ] If the ending contains a long silent card, decide whether a spoken close, licensed music tail or shorter hold makes the finish clearer; review any `audioTail` warning.
- [ ] If music is enabled, listen through its intro, ducking release and final fade on headphones and phone speakers.
- [ ] Subtitle timing, line length and safe-area readability were reviewed.

## Visual QA

- [ ] Every key claim has a visible explanation; steps, comparisons and quantities are not carried only by narration and bottom captions.
- [ ] Repeated layouts and long title holds have a content or creator-constraint reason in `shot-map.md`; content-quality warnings were examined before rendering and after audio retiming.
- [ ] Meaningful cues follow the explanation; decorative motion was not added to hide a warning, and no library-category quota forced unsupported facts.
- [ ] Contact sheet includes opening, content, transitions and ending.
- [ ] Review each scene's entrance midpoint, completed state and frame before the cut; check that relationships are visible after all elements enter.
- [ ] Overlap handoffs fade the old information out, then fade and move the new information in; no frame shows competing titles. For narrated scenes, check speech begins when the new shot is visible.
- [ ] An illustrative object is labelled as a diagram; real product evidence is identified separately.
- [ ] The final claim remains stable for the declared `outro.holdFrames` before fade.
- [ ] Titles, captions and content stay readable on the target canvas.
- [ ] Captions use transparent backgrounds in every Style Pack; no colored or translucent subtitle panel covers the picture.
- [ ] Caption text uses the effective palette's distinct `captionInk` color and remains readable against the canvas.
- [ ] Bottom narration captions appear as short, single-line phrases; they change during speech, and the shot changes promptly when narration ends.
- [ ] Every bottom narration cue omits pause punctuation at its start and end; punctuation inside one cue remains only where it helps separate clauses, and final question or exclamation marks carry tone.
- [ ] No text, card or screenshot crosses the visual safe area.
- [ ] Style differences affect surface, type, layout character and emphasis—not only color.
- [ ] No scene becomes static for longer than its content requires.
- [ ] Transitions do not hide the final meaning of the outgoing scene.
- [ ] Full video was watched at normal speed.

For a `visual-master` handoff, also check the entire video with the actual
facecam and subtitle overlay rectangles in mind:

- [ ] No narration subtitle or `SILENT PREVIEW` marker is burned in; intentional titles and graphic labels remain.
- [ ] Titles, numbers, screenshots and other key content remain outside the reserved right column and bottom band for every scene.
- [ ] The output version, `narration-script.md`, `shot-timing.json` and picture-lock policy are included in the handoff package.
- [ ] The creator records full visual review with `approve:visual-handoff` before calling the picture delivery ready.

## Delivery statement

Report exactly what was checked and what remains provisional. Call the default
output a **silent visual preview**. A clean silent picture master can become
`visual-handoff-ready` after full visual review and can finish FrameLoom's
picture handoff to an external editor. For an in-project narrated video,
record the creator's full playback review and run `approve:delivery`; check
`deliveryStatus=release-ready` and `qa-report.json` `releaseReady=true`.

## Project palette, when enabled

- [ ] The subject product and reference roles are supported by supplied sources; citation/competitor colors did not silently replace the video palette.
- [ ] Reference pixels and URLs are recorded; source images are unchanged and local.
- [ ] Adopted palette uses current supported shots; light/dark stages, cards, accent foreground and both subtitle routes are readable.
- [ ] Actual project preview uses adopted colors; default library samples are not presented as this project preview.
- [ ] Palette/source changes invalidate prior production and approval.
