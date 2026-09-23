import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`无法读取 JSON：${filePath}\n${error instanceof Error ? error.message : String(error)}`);
  }
}

export function loadStyleIndex(indexPath = path.join(projectRoot, 'styles/style-index.json')) {
  const index = readJson(indexPath);
  if (index?.schemaVersion !== '1.0' || !Array.isArray(index.styles)) {
    throw new Error(`Style index 格式无效：${indexPath}`);
  }

  const ids = new Set();
  for (const style of index.styles) {
    if (!style?.id || !style.name || !style.version || !Array.isArray(style.bestFor) || !Array.isArray(style.canvas)) {
      throw new Error(`Style index 包含缺少必填字段的条目：${JSON.stringify(style)}`);
    }
    if (ids.has(style.id)) {
      throw new Error(`Style index 包含重复 id：${style.id}`);
    }
    ids.add(style.id);

    const styleFile = path.join(projectRoot, 'styles', style.id, 'style.json');
    const previewFile = path.resolve(projectRoot, style.preview);
    if (!fs.existsSync(styleFile) || !fs.existsSync(previewFile)) {
      throw new Error(`Style Pack "${style.id}" 缺少 style.json 或 preview.md。`);
    }
    const pack = readJson(styleFile);
    if (pack.id !== style.id || pack.version !== style.version) {
      throw new Error(`Style Pack "${style.id}" 的 id/version 与 style index 不一致。`);
    }
  }
  return index;
}

export function loadStylePack(styleId) {
  return readJson(path.join(projectRoot, 'styles', styleId, 'style.json'));
}

export function filterStyles(styles, filters = {}) {
  const content = filters.content?.toLowerCase();
  const canvas = filters.canvas?.toLowerCase();
  const status = filters.status?.toLowerCase();
  return styles.filter((style) => {
    const contentMatches = !content || style.bestFor.some((value) => value.toLowerCase() === content);
    const canvasMatches = !canvas || style.canvas.some((value) => value.toLowerCase() === canvas);
    const statusMatches = !status || style.status.toLowerCase() === status;
    return contentMatches && canvasMatches && statusMatches;
  });
}

export function getOption(args, optionName) {
  const index = args.indexOf(optionName);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${optionName} 需要一个值。`);
  }
  return value;
}
