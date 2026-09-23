import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadStylePack} from './lib/style-catalog.mjs';

function issue(severity, sceneId, layerId, message) {
  return {severity, sceneId, layerId, message};
}

export function checkSafeArea(storyboard, stylePack = loadStylePack(storyboard.style.id)) {
  const {width, height} = storyboard.project;
  const orientation = width < height ? 'portrait' : 'landscape';
  const safeArea = stylePack.safeArea?.[orientation];
  if (!safeArea) {
    throw new Error(`Style Pack "${storyboard.style.id}" 没有 ${orientation} safeArea。`);
  }

  const contentWidth = width - safeArea.left - safeArea.right;
  const contentHeight = height - safeArea.top - safeArea.bottom;
  const issues = [];
  for (const scene of storyboard.scenes) {
    for (const layer of scene.layers) {
      const x = layer.x ?? 0;
      const y = layer.y ?? 0;
      if (x < 0 || y < 0) {
        issues.push(issue('error', scene.id, layer.id, `起点 (${x}, ${y}) 超出内容安全区。`));
      }
      if (typeof layer.width === 'number' && x + layer.width > contentWidth) {
        issues.push(issue('error', scene.id, layer.id, `右边界 ${x + layer.width}px 超出可用宽度 ${contentWidth}px。`));
      }
      if (typeof layer.height === 'number' && y + layer.height > contentHeight) {
        issues.push(issue('error', scene.id, layer.id, `下边界 ${y + layer.height}px 超出可用高度 ${contentHeight}px。`));
      }
      if (typeof layer.width !== 'number' || typeof layer.height !== 'number') {
        issues.push(issue('warning', scene.id, layer.id, '缺少显式 width 或 height，只检查了已声明的边界；视觉尺寸需通过抽帧复核。'));
      }
    }
  }

  return {
    orientation,
    canvas: {width, height},
    safeArea,
    content: {width: contentWidth, height: contentHeight},
    issues
  };
}

export function checkSafeAreaFile(storyboardPath) {
  const resolved = path.resolve(storyboardPath);
  const storyboard = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  const report = checkSafeArea(storyboard);
  for (const item of report.issues) {
    console.log(`${item.severity.toUpperCase()} scene ${item.sceneId}, layer ${item.layerId}: ${item.message}`);
  }
  const errors = report.issues.filter((item) => item.severity === 'error');
  console.log(`SAFE AREA ${errors.length === 0 ? 'OK' : 'FAILED'} ${JSON.stringify({
    orientation: report.orientation,
    canvas: report.canvas,
    safeArea: report.safeArea,
    content: report.content,
    errors: errors.length,
    warnings: report.issues.length - errors.length
  })}`);
  return report;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  const storyboardPath = process.argv[2];
  if (!storyboardPath) {
    console.error('Usage: npm run check:safe-area -- <storyboard.json>');
    process.exit(1);
  }
  try {
    const report = checkSafeAreaFile(storyboardPath);
    if (report.issues.some((item) => item.severity === 'error')) process.exit(1);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
