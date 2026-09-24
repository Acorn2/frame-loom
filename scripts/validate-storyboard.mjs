import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateStoryboard} from '../src/validation/storyboard-validator.ts';

const args = process.argv.slice(2);
const modeIndex = args.indexOf('--mode');
const executionMode = modeIndex >= 0 ? args[modeIndex + 1] : 'review';
const positional = modeIndex >= 0
  ? args.filter((_item, index) => index !== modeIndex && index !== modeIndex + 1)
  : args;
const inputPath = positional[0];
if (!inputPath) {
  console.error('Usage: npm run validate:storyboard -- <storyboard.json> [--mode review|fast]');
  process.exit(1);
}
if (!['review', 'fast'].includes(executionMode)) {
  console.error('--mode 只能是 review 或 fast。');
  process.exit(1);
}

const resolvedPath = path.resolve(process.cwd(), inputPath);
let value;
try {
  value = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
} catch (error) {
  console.error(`无法读取 storyboard：${resolvedPath}`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const issues = validateStoryboard(value, {
  storyboardPath: resolvedPath,
  styleRoot: path.join(projectRoot, 'styles'),
  executionMode
});
const errors = issues.filter((item) => item.severity === 'error');
for (const item of issues) {
  console.log(`${item.severity.toUpperCase()} ${item.path}: ${item.message}`);
}

if (errors.length > 0) {
  process.exit(1);
}

console.log(`VALID storyboard: ${resolvedPath}`);
