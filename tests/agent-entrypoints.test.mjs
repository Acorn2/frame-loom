import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, URL} from 'node:url';
import {expect, it} from 'vitest';

const root = fileURLToPath(new URL('../', import.meta.url));

it('registers the Codex discovery entry with Claude and resolves the shared workflow', () => {
  const plugin = JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin/plugin.json'), 'utf8'));
  const entry = path.join(root, '.agents/skills/frame-loom/SKILL.md');
  const source = fs.readFileSync(entry, 'utf8');
  expect(plugin.name).toBe('frame-loom');
  expect(path.resolve(root, plugin.skills, 'frame-loom/SKILL.md')).toBe(entry);
  expect(source).toMatch(/^---\r?\nname: frame-loom\r?\ndescription: .+\r?\n---/u);
  const sharedLink = source.match(/\[shared workflow\]\(([^)]+)\)/u);
  expect(sharedLink).not.toBeNull();
  const shared = path.resolve(path.dirname(entry), sharedLink[1]);
  expect(shared).toBe(path.join(root, 'SKILL.md'));
  expect(fs.readFileSync(shared, 'utf8')).toContain('name: frame-loom');
});
