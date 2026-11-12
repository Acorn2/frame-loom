import fs from 'node:fs';
import http from 'node:http';
import {Buffer} from 'node:buffer';
import path from 'node:path';
import {fileURLToPath, pathToFileURL, URL} from 'node:url';
import {acquireProjectLock} from './lib/project-files.mjs';
import {clipFile} from './lib/review-ledger.mjs';
import {verifyClip} from './lib/preview-gate.mjs';
import {fingerprintFiles} from './lib/input-fingerprint.mjs';
import {playbackCandidate, saveBasis} from './lib/review-candidate.mjs';
import {readFeedback, changeFeedback} from './lib/review-feedback.mjs';

const page = fileURLToPath(new URL('../review/player.html', import.meta.url));
const client = fileURLToPath(new URL('../review/player.js', import.meta.url));

function sendVideo(request, response, candidate) {
  const fd = fs.openSync(candidate.file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  let stream;
  try {
    const stat = fs.fstatSync(fd);
    if (['dev', 'ino', 'size', 'ctimeMs'].some(key => stat[key] !== candidate.stat[key])) throw new Error('视频已换版，请刷新。');
    const {size} = stat;
    let start = 0, end = size - 1;
    const range = request.headers.range;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/u.exec(range);
      if (match && (match[1] || match[2])) {
        start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
        if (match[1] && match[2]) end = Math.min(end, Number(match[2]));
      } else start = size;
      if (start > end || start >= size) {
        response.writeHead(416, {'Content-Range': `bytes */${size}`}).end();
        return;
      }
    }
    response.writeHead(range ? 206 : 200, {'Content-Type': 'video/mp4', 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes',
      ...(range ? {'Content-Range': `bytes ${start}-${end}/${size}`} : {})});
    if (request.method === 'HEAD') return response.end();
    stream = fs.createReadStream(candidate.file, {fd, start, end});
    stream.on('error', () => response.destroy()).pipe(response);
    response.on('close', () => stream.destroy());
  } finally {if (!stream) fs.closeSync(fd);}
}

function playerIssues(project, issues) {
  return issues.map(issue => {
    const latest = issue.previews?.at(-1);
    if (!latest) return issue;
    let stale;
    if (!issue.producedVersion && latest.answer !== 'changes') {
      try {verifyClip(project, latest);} catch (error) {stale = error.message;}
    }
    // The player needs the chosen clip and visible timing evidence. Local
    // production paths and input fingerprints stay in the project ledger.
    const {id, sceneIds, impact, note, answer} = latest;
    return {...issue, previews: [{id, sceneIds, impact, note, answer, stale}]};
  });
}

export function createReviewServer(directory) {
  const project = fs.realpathSync(directory);
  let current;
  return http.createServer(async (req, res) => {
    const host = '127.0.0.1:' + req.socket.localPort;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    if (req.headers.host !== host) return res.writeHead(403).end();
    try {
      if (req.method === 'GET' && ['/', '/player.js'].includes(req.url)) {
        const html = req.url === '/';
        return res.writeHead(200, {'Content-Type': html ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8'}).end(fs.readFileSync(html ? page : client));
      }
      if (['GET', 'HEAD'].includes(req.method) && current && req.url === '/video/' + current.version) {
        return sendVideo(req, res, current);
      }
      if (['HEAD','GET'].includes(req.method) && req.url.startsWith('/clip/')) {
        const id = req.url.slice(6);
        const clip = readFeedback(project).flatMap(i => i.previews ?? []).find(c => c.id === id);
        if (!clip) return res.writeHead(404).end();
        const file = clipFile(project,id);
        const stat = fs.statSync(file);
        if (fingerprintFiles([file],project) !== clip.bytes) throw new Error('预览文件已变化。');
        return sendVideo(req,res,{file,stat});
      }
      if (req.method === 'GET' && req.url === '/session') {
        const release = acquireProjectLock(project, 'production');
        try {
          const {file,title,fps,frames,version,scenes,qaGroups} = playbackCandidate(project);
          const metadata = {title,fps,frames,version,scenes,qaGroups};
          current = {...metadata, file, stat: fs.statSync(file)};
          return res.writeHead(200, {'Content-Type': 'application/json'}).end(JSON.stringify({...metadata, issues: playerIssues(project, readFeedback(project))}));
        } finally {release();}
      }
      if (req.method === 'POST' && req.url === '/feedback') {
        if (req.headers.origin !== 'http://' + host || req.headers['content-type'] !== 'application/json') return res.writeHead(403).end();
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 16384) return res.writeHead(413).end();
          chunks.push(chunk);
        }
        const action = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!['add', 'changes', 'accepted', 'accept-preview', 'change-preview'].includes(action?.type)) return res.writeHead(400).end();
        const release = acquireProjectLock(project, 'production');
        try {
          const candidate = playbackCandidate(project);
          if (action.type === 'add' && action.version === candidate.version) candidate.basisHash = saveBasis(project,candidate);
          const issues = changeFeedback(project, candidate, action);
          return res.writeHead(200, {'Content-Type': 'application/json'}).end(JSON.stringify(playerIssues(project, issues)));
        } finally {release();}
      }
      res.writeHead(404).end();
    } catch (error) {res.writeHead(409, {'Content-Type': 'text/plain; charset=utf-8'}).end(error.message);}
  });
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const [dir, ...extra] = process.argv.slice(2);
  if (!dir || extra.length) throw new Error('Usage: npm run review:player -- <project>');
  const server = createReviewServer(dir);
  server.listen(0, '127.0.0.1', () => console.log(`本地审片 http://127.0.0.1:${server.address().port}/  （Ctrl+C 停止）`));
}
