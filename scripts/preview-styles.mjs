import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {filterStyles, getOption, loadStyleIndex, loadStylePack, projectRoot} from './lib/style-catalog.mjs';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function previewSummary(previewPath) {
  return fs.readFileSync(path.resolve(projectRoot, previewPath), 'utf8')
    .split('\n')
    .filter((line) => line.trim() && !line.startsWith('#'))
    .join(' ')
    .trim();
}

function renderCard(style) {
  const pack = loadStylePack(style.id);
  const tokens = pack.tokens;
  const summary = previewSummary(style.preview);
  const radius = `${tokens.surfaceRadius}px`;
  const previewStyle = `background:${tokens.background};color:${tokens.ink};font-family:${tokens.bodyFont};`;
  const surfaceStyle = `background:${tokens.paper};border:${tokens.surfaceBorder};border-radius:${radius};box-shadow:${tokens.surfaceShadow};`;
  return `
    <article class="style-card">
      <header>
        <div><span class="status">${escapeHtml(style.status)}</span><h2>${escapeHtml(style.name)}</h2></div>
        <code>${escapeHtml(style.id)}@${escapeHtml(style.version)}</code>
      </header>
      <p>${escapeHtml(summary)}</p>
      <div class="frames">
        <section class="frame" style="${previewStyle}">
          <span style="background:${tokens.accent};color:${tokens.paper}">HOOK</span>
          <strong style="font-family:${tokens.displayFont}">A visible idea starts here.</strong>
        </section>
        <section class="frame" style="${previewStyle}">
          <div class="surface" style="${surfaceStyle}"><small>CONTENT</small><b>Meaning → target</b></div>
        </section>
        <section class="frame" style="${previewStyle}">
          <div class="surface metric" style="${surfaceStyle}"><small>REVIEWABLE</small><b>100%</b></div>
        </section>
      </div>
      <footer>${style.bestFor.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}</footer>
    </article>`;
}

export function buildStyleGallery(args = process.argv.slice(2)) {
  const outputArg = args.find((arg) => !arg.startsWith('--') && args[args.indexOf(arg) - 1]?.startsWith('--') !== true);
  const outputPath = path.resolve(process.cwd(), outputArg ?? 'style-gallery.html');
  const styles = filterStyles(loadStyleIndex().styles, {
    content: getOption(args, '--content'),
    canvas: getOption(args, '--canvas'),
    status: getOption(args, '--status')
  });
  if (styles.length === 0) {
    throw new Error('没有匹配的 Style Pack，未生成画廊。');
  }

  const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>FrameLoom Style Gallery</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#111;color:#f5f5f5;font:16px/1.5 Arial,sans-serif}main{max-width:1440px;margin:auto;padding:48px 28px}h1{font-size:42px;margin:0 0 8px}.intro{color:#aaa;margin:0 0 40px}.grid{display:grid;gap:28px}.style-card{background:#1b1b1b;border:1px solid #353535;border-radius:18px;padding:24px}.style-card header{display:flex;justify-content:space-between;gap:24px;align-items:start}.style-card h2{font-size:28px;margin:8px 0 0}.style-card code{color:#aaa}.status{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#82d6ac}.frames{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:22px}.frame{aspect-ratio:16/9;padding:22px;position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:center;gap:18px}.frame>span{align-self:flex-start;padding:6px 10px;font-size:11px;font-weight:800}.frame>strong{font-size:clamp(19px,2.3vw,34px);line-height:1.05}.surface{padding:20px;display:flex;flex-direction:column;gap:10px}.surface small{opacity:.65;letter-spacing:.12em}.surface b{font-size:24px}.metric b{font-size:42px}.style-card footer{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}.style-card footer span{border:1px solid #444;border-radius:999px;padding:4px 10px;color:#bbb;font-size:13px}@media(max-width:800px){main{padding:30px 16px}.frames{grid-template-columns:1fr}.style-card header{display:block}.style-card code{display:block;margin-top:8px}}
</style></head><body><main><h1>FrameLoom Style Gallery</h1><p class="intro">Compact previews for selection. Load the full design notes only after choosing a Style Pack.</p><div class="grid">${styles.map(renderCard).join('')}</div></main></body></html>`;

  fs.mkdirSync(path.dirname(outputPath), {recursive: true});
  fs.writeFileSync(outputPath, html);
  console.log(`STYLE GALLERY ${outputPath} (${styles.length} styles)`);
  return outputPath;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  try {
    buildStyleGallery();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
