// Direct rendering and workflow production use the same feedback confirmation.
// The rendering implementation stays independently fingerprinted in production locks.
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {confirmBeforeRender} from './lib/preview-gate.mjs';
import {readEpisode} from './lib/series.mjs';
import {ledgerName} from './lib/review-ledger.mjs';
import {acquireProjectLock} from './lib/project-files.mjs';

const {positionals, values} = parseArgs({allowPositionals:true, options:{
  mode:{type:'string'}, 'audio-config':{type:'string'}, 'output-purpose':{type:'string'},
  force:{type:'boolean'}, 'no-scene-cache':{type:'boolean'}
}});
let release;
try {
  if (positionals[0]) {
    const board = path.resolve(positionals[0]);
    const project = path.dirname(board);
    const audio = values['audio-config'] ? path.resolve(values['audio-config']) : null;
    const episode = readEpisode(project);
    const purpose = values['output-purpose'] ?? episode?.outputPurpose ?? (audio ? 'in-project-video' : 'visual-preview');
    if (episode && !values['output-purpose']) process.argv.push('--output-purpose', purpose);
    const route = {audio, purpose};
    if (fs.existsSync(path.join(project, 'run.json')) || fs.existsSync(path.join(project, ledgerName))) {
      release = acquireProjectLock(project, 'production');
      process.once('exit', release);
      const approved = confirmBeforeRender(project, route);
      if (approved.length && path.basename(board) !== 'storyboard.json') throw new Error('本轮确认绑定当前 storyboard.json。');
    }
  }
  await import('./render-storyboard-runtime.mjs');
} finally {
  if (release) {process.off('exit',release); release();}
}
