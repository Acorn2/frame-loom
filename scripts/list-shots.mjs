import {CHAPTER_TRANSITIONS} from '../src/shots/shortlist/chapter-transitions.tsx';
import {pathToFileURL} from 'node:url';
import {SHOT_CATALOG} from '../src/shots/catalog.ts';
import {AUXILIARY_CATALOG} from '../src/shots/auxiliary-catalog.ts';
import {loadStyleIndex, getOption} from './lib/style-catalog.mjs';

export function listShots(args = process.argv.slice(2), {log = console.log} = {}) {
  for (let index = 0; index < args.length; index += 1) {
    if (['--style', '--canvas'].includes(args[index])) {getOption(args, args[index]); index += 1;}
    else if (!['--json', '--auxiliary', '--transitions'].includes(args[index])) throw new Error('Usage: npm run list:shots -- [--style <id>] [--canvas landscape|portrait] [--auxiliary|--transitions] [--json]');
  }
  const styleId = getOption(args, '--style');
  const canvas = getOption(args, '--canvas');
  if (styleId && !loadStyleIndex().styles.some((style) => style.id === styleId)) throw new Error(`未知风格 ${styleId}。`);
  if (canvas && !['landscape', 'portrait'].includes(canvas)) throw new Error('--canvas 只能是 landscape 或 portrait。');
  if (args.includes('--auxiliary') && args.includes('--transitions')) throw new Error('宿主动作与跨场转场需分别查询。');
  const catalog = args.includes('--transitions') ? CHAPTER_TRANSITIONS : args.includes('--auxiliary') ? AUXILIARY_CATALOG : SHOT_CATALOG;
  const choices = catalog.filter((shot) => (!styleId || shot.styles.includes(styleId)) && (!canvas || shot.orientations.includes(canvas)));
  if (args.includes('--json')) log(JSON.stringify(choices, null, 2));
  else for (const shot of choices) {
    if ('type' in shot) {log(`${shot.id}@${shot.version} (${shot.status}): transitionIn=${shot.type}; ${shot.minSec}–${shot.maxSec}s; chapterBoundary=true`); continue;}
    if ('hosts' in shot) {log(`${shot.id}@${shot.version} (${shot.status}): hosted ${shot.action}; hosts=${shot.hosts.join(',')}; slot=${shot.targetSlot}`); continue;}
    log(`${shot.id}@${shot.version} (${shot.status}): ${shot.purpose}`);
    log(`  styles=${shot.styles.join(',')} canvas=${shot.orientations.join(',')} visual=${shot.visualKinds.join(',')}`);
    log(`  slots=${Object.entries(shot.slots).map(([name, budget]) => `${name}:${budget.min}–${budget.max}`).join(',') || 'base semantic content'} recipe=shots/${shot.id}/recipe.md`);
  }
  return choices;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {listShots();} catch (error) {console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1;}
}
