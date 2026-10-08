import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {pathToFileURL, URL} from 'node:url';
import {buildLibrary} from './build-library.mjs';

const contentTypes = {'.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/vnd.microsoft.icon', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8'};
export function createLibraryServer(root) {
  return http.createServer((request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) {response.writeHead(405); response.end(); return;}
    let pathname;
    try {pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);} catch {response.writeHead(400); response.end(); return;}
    const file = path.resolve(root, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`);
    if (!file.startsWith(`${root}${path.sep}`) || pathname.split('/').some(part => part.startsWith('.'))) {response.writeHead(403); response.end(); return;}
    if (!fs.existsSync(file) || !fs.statSync(file).isFile() || !contentTypes[path.extname(file)]) {response.writeHead(404); response.end(); return;}
    const size = fs.statSync(file).size;
    const headers = {'Content-Type': contentTypes[path.extname(file)], 'Cache-Control': 'no-cache', 'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff'};
    let start = 0; let end = size - 1; let status = 200;
    if (request.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/u.exec(request.headers.range);
      if (!match || !match[1] && !match[2]) {response.writeHead(416, {'Content-Range': `bytes */${size}`}); response.end(); return;}
      start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
      end = match[1] && match[2] ? Math.min(Number(match[2]), end) : end;
      if (start > end || start >= size || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {response.writeHead(416, {'Content-Range': `bytes */${size}`}); response.end(); return;}
      status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
    }
    headers['Content-Length'] = Math.max(0, end - start + 1);
    response.writeHead(status, headers);
    if (request.method === 'HEAD' || !size) {response.end(); return;}
    fs.createReadStream(file, {start, end}).on('error', () => response.destroy()).pipe(response);
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const port = args.length === 0 ? 4318 : args.length === 2 && args[0] === '--port' ? Number(args[1]) : NaN;
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Usage: npm run library -- [--port 4318]');
  const server = createLibraryServer(await buildLibrary());
  server.on('error', (error) => {console.error(`配方库启动失败：${error.message}；可用 --port 指定另一个端口。`); process.exitCode = 1;});
  server.listen(port, '127.0.0.1', () => console.log(`FRAMELOOM LIBRARY http://127.0.0.1:${port}\n仅浏览与选择；Ctrl+C 停止。`));
}
