import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {filterStyles, getOption, loadStyleIndex} from './lib/style-catalog.mjs';

export function listStyles(args = process.argv.slice(2)) {
  const index = loadStyleIndex();
  const styles = filterStyles(index.styles, {
    content: getOption(args, '--content'),
    canvas: getOption(args, '--canvas'),
    status: getOption(args, '--status')
  });

  if (args.includes('--json')) {
    console.log(JSON.stringify({styles}, null, 2));
    return styles;
  }

  if (styles.length === 0) {
    console.log('没有匹配的 Style Pack。可用过滤项：--content、--canvas、--status。');
    return styles;
  }

  for (const style of styles) {
    console.log(`${style.id}\t${style.name}\t${style.status}`);
    console.log(`  bestFor: ${style.bestFor.join(', ')}`);
    console.log(`  mood: ${style.mood.join(', ')} | canvas: ${style.canvas.join(', ')} | templates: ${style.templates.join(', ')}`);
    console.log(`  preview: ${style.preview}`);
  }
  return styles;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  try {
    listStyles();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
