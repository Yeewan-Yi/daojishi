import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.geojson': 'application/geo+json', '.woff2': 'font/woff2' };
const allowed = new Set(['/index.html', '/styles.css', '/flight.css', '/refined.css', '/scene.css', '/fonts.css', '/globe-3d.js', '/globe-math.js', '/globe-labels.js', '/land.geojson', '/vendor/three.module.js', '/vendor/FZSongKeBenXiuKaiS.woff2', '/flight.js', '/flip-clock.js', '/app.js', '/countdown.js', '/cloud.js', '/config.js', '/favicon.svg', '/experiments/golden-wheel.html', '/experiments/golden-wheel.css', '/experiments/golden-wheel.js']);
for (const file of ['/release-notes.js','/release-notes.css','/memory-map.js','/memory-map.css','/countries.geojson','/visited-cities.geojson','/journey-data.js','/symbols.js','/memories.html','/memories.css','/memories.js','/boot.js','/motion.js','/date-picker.js','/letter-media.js','/experience.css','/letters.js', '/letters-ui.js', '/letters.css']) allowed.add(file);
const port = Number(process.argv[2] || 4173);
http.createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path === '/' ? '/index.html' : path;
    const target = resolve(root, '.' + file);
    if (!allowed.has(file)&&!/^\/map-data\/(?:[A-Z]{3}|cities-\d{6})\.json$/.test(file) || !target.startsWith(root + sep)) { res.writeHead(404); res.end('Not found'); return; }
    const body = await readFile(target);
    res.writeHead(200, { 'Content-Type': types[extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Youqi preview: http://127.0.0.1:${port}`));
