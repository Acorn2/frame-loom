import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {MotionPackSchema, StyleIndexSchema, StylePackSchema} from '../src/schemas/style-pack.ts';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const styleRoot = path.join(projectRoot, 'styles');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assertParsed(schema, value, label) {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(`${label}: ${result.error.issues.map((item) => `${item.path.join('.')}: ${item.message}`).join('; ')}`);
  }
  return result.data;
}

try {
  const index = assertParsed(StyleIndexSchema, readJson(path.join(styleRoot, 'style-index.json')), 'style-index.json');
  const ids = new Set();
  for (const entry of index.styles) {
    if (ids.has(entry.id)) throw new Error(`重复 Style Pack id：${entry.id}`);
    ids.add(entry.id);
    const directory = path.join(styleRoot, entry.id);
    const style = assertParsed(StylePackSchema, readJson(path.join(directory, 'style.json')), `${entry.id}/style.json`);
    assertParsed(MotionPackSchema, readJson(path.join(directory, 'motion.json')), `${entry.id}/motion.json`);
    if (style.id !== entry.id || style.version !== entry.version) throw new Error(`${entry.id}: index 与 style.json 的 id/version 不一致。`);
    if (!fs.existsSync(path.resolve(projectRoot, entry.preview))) throw new Error(`${entry.id}: preview 不存在：${entry.preview}`);
    console.log(`VALID STYLE ${entry.id}@${entry.version}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
