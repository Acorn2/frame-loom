import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const skippedDirectories = new Set(['.git', '.tmp', 'node_modules']);
const skippedRootDirectories = new Set(['dist', 'dist-types', 'docs', 'mydoc', 'projects']);

function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory() && !skippedDirectories.has(entry.name)
      && !(directory === root && skippedRootDirectories.has(entry.name))) {
      return markdownFiles(fullPath);
    }
    return entry.isFile() && entry.name.endsWith('.md') ? [fullPath] : [];
  });
}

let checked = 0;
const missing = [];
const files = markdownFiles(root);

for (const file of files) {
  let fenced = false;
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;

    for (const match of line.matchAll(/!?\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+"[^"]*")?\)/g)) {
      const target = match[1] ?? match[2];
      if (/^(?:#|[a-z][a-z\d+.-]*:|\/\/)/i.test(target)) continue;
      const pathname = target.split(/[?#]/, 1)[0];
      if (!pathname) continue;
      checked += 1;

      let decoded;
      try {
        decoded = decodeURIComponent(pathname);
      } catch {
        missing.push(`${path.relative(root, file)}:${index + 1}: invalid URL encoding: ${target}`);
        continue;
      }
      const resolved = path.resolve(path.dirname(file), decoded);
      if (!resolved.startsWith(`${root}${path.sep}`) || !existsSync(resolved)) {
        missing.push(`${path.relative(root, file)}:${index + 1}: ${target}`);
      }
    }
  }
}

if (missing.length > 0) {
  console.error(`Checked ${files.length} Markdown files and ${checked} local links; ${missing.length} target(s) missing or outside the repository:`);
  missing.forEach((entry) => console.error(`- ${entry}`));
  process.exitCode = 1;
} else {
  console.log(`Checked ${files.length} Markdown files and ${checked} local links; all targets exist.`);
}
