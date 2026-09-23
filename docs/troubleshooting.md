# Troubleshooting

## Storyboard is rejected

- `project.status` must be `reviewed` or `approved`; never rename a draft only to bypass review.
- `durationFrames` must equal `durationSec × fps`, and scene durations must sum to it.
- Beat targets must reference a layer or connection in the same scene.
- Run `npm run validate:storyboard -- <storyboard.json>` and fix errors before warnings.

## Render refuses to write

The renderer protects existing output. Choose a new path, or use `--force` only after confirming the exact target. Input and output paths cannot be identical.

## Screenshot is missing

Paths are relative to the storyboard. Register each screenshot in `asset-manifest.json` with `type: "screenshot"`, keep relative manifest paths inside the project directory, then run `npm run validate:assets -- <storyboard.json>`.

## FFmpeg or ffprobe is missing

Install FFmpeg and make both commands available on `PATH`. Rendering uses Remotion, while metadata inspection, audio measurement and contact sheets use FFmpeg tools.

## Browser or bundle failure

Run `npm run build` first to separate TypeScript/bundling errors from rendering errors. On a clean machine Remotion may need to download its supported browser; ensure the machine has network access and the browser cache is writable.

## QA passes but the video still looks wrong

Automated QA checks contracts, metadata, safe areas and evidence generation. It cannot judge pacing, hierarchy, pronunciation or visual polish. Open `contact-sheet.png`, then watch the entire video at normal speed and complete the manual fields in `qa-report.json`.
