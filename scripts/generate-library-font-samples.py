"""Regenerate the tiny, display-only font samples used by the public library.

Requires fonttools and brotli in the invoking Python environment. Production
rendering continues to use the complete, pinned fonts in public/fonts/.
"""

import hashlib
import json
from pathlib import Path

try:
    from fontTools import subset
    from fontTools.ttLib import TTFont
except ImportError as error:
    raise SystemExit("Install fonttools and brotli in an isolated Python environment to regenerate library font samples.") from error


ROOT = Path(__file__).resolve().parents[1]
SAMPLES = ROOT / "library/font-samples"
text = (SAMPLES / "sample.txt").read_text(encoding="utf-8").strip()
fonts = json.loads((ROOT / "fonts/font-index.json").read_text(encoding="utf-8"))["fonts"]
records = []

for item in fonts:
    face = item["faces"][0]
    source = ROOT / "public" / face["file"]
    if hashlib.sha256(source.read_bytes()).hexdigest() != face["sha256"]:
        raise SystemExit(f"Source font fingerprint changed: {item['id']}")
    font = TTFont(source)
    missing = set(text) - {chr(codepoint) for codepoint in font.getBestCmap()}
    if missing:
        raise SystemExit(f"Sample text has unsupported characters in {item['id']}: {''.join(sorted(missing))}")
    subsetter = subset.Subsetter()
    subsetter.populate(text=text)
    subsetter.subset(font)
    font.flavor = "woff2"
    output = SAMPLES / f"{item['id']}.woff2"
    font.save(output)
    data = output.read_bytes()
    records.append({"id": item["id"], "sourceSha256": face["sha256"], "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)})
    print(f"FONT SAMPLE {item['id']} {len(data)} bytes")

(SAMPLES / "manifest.json").write_text(json.dumps({"sampleText": text, "fonts": records}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
