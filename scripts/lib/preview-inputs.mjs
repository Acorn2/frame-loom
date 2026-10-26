import fs from 'node:fs';
import path from 'node:path';

// Both public preview routes depend on these runtime/validation helpers and the
// actual bundled fonts. Prefer harmless invalidation to reusing unchecked media.
export function previewRuntimeFiles(root) {
  const walk = directory => fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : entry.isFile() ? [file] : [];
  });
  return [
    ...walk(path.join(root, 'scripts/lib')),
    ...walk(path.join(root, 'public/fonts')),
    ...['fonts/font-index.json', 'tsconfig.json', 'scripts/validate-assets.mjs', 'scripts/check-safe-area.mjs'].map(file => path.join(root, file))
  ].sort();
}
