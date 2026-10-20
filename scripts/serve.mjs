import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
const allowed = new Set(['/index.html', '/styles.css', '/app.js', '/countdown.js', '/cloud.js', '/config.js', '/favicon.svg']);
const port = Number(process.argv[2] || 4173);
http.createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path === '/' ? '/index.html' : path;
    const target = resolve(root, '.' + file);
    if (!allowed.has(file) || !target.startsWith(root + sep)) { res.writeHead(404); res.end('Not found'); return; }
    const body = await readFile(target);
    res.writeHead(200, { 'Content-Type': types[extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Youqi preview: http://127.0.0.1:${port}`));
