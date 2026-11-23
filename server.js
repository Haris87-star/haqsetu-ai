// HaqSetu AI — tiny static server (plain Node, no npm dependencies).
// Serves ONLY the explicit allowlist below; every other URL returns 404.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 3000);

// URL path -> file name (relative to ROOT). Files are never derived from user input.
const ALLOWED = new Map([
  ['/', 'index.html'],
  ['/index.html', 'index.html'],
  ['/app.js', 'app.js'],
  ['/persistence.js', 'persistence.js'],
  ['/engine.js', 'engine.js'],
  ['/style.css', 'style.css'],
  ['/sw.js', 'sw.js'],
  ['/manifest.webmanifest', 'manifest.webmanifest'],
  ['/icon-192.png', 'icon-192.png'],
  ['/icon-512.png', 'icon-512.png'],
  ['/icon.svg', 'icon.svg'],
  ['/data/schemes.json', 'data/schemes.json'],
  ['/data/personas.json', 'data/personas.json'],
  ['/data/ui-languages.json', 'data/ui-languages.json'],
]);

const TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript'],
  ['.css', 'text/css'],
  ['.json', 'application/json'],
  ['.webmanifest', 'application/manifest+json'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
]);

// Text-like assets are always revalidated; sw.js is covered by the .js rule.
const NO_CACHE_EXT = new Set(['.html', '.js', '.css', '.json']);

function sendText(res, status, message, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(message),
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  });
  res.end(message);
}

async function handler(req, res) {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return sendText(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
    }

    let pathname;
    try {
      pathname = new URL(req.url || '/', `http://${HOST}`).pathname;
    } catch {
      return sendText(res, 404, 'Not Found');
    }

    const file = ALLOWED.get(pathname);
    if (!file) return sendText(res, 404, 'Not Found');

    const ext = path.extname(file);
    const data = await fs.promises.readFile(path.join(ROOT, file));

    const headers = {
      'Content-Type': TYPES.get(ext) || 'application/octet-stream',
      'Content-Length': data.length,
      'X-Content-Type-Options': 'nosniff',
    };
    if (NO_CACHE_EXT.has(ext)) headers['Cache-Control'] = 'no-cache';

    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    // Missing file on disk or unexpected error: never leak details.
    if (!res.headersSent) sendText(res, 404, 'Not Found');
    else res.end();
  }
}

export function createServer() {
  return http.createServer((req, res) => {
    void handler(req, res);
  });
}

// Start listening only when executed directly (`node server.js`), not on import.
const isMain = (() => {
  try {
    return import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
})();

if (isMain) {
  const server = createServer();
  server.listen(PORT, HOST, () => {
    console.log(`HaqSetu AI running at http://${HOST}:${PORT}`);
  });
  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Another HaqSetu server (or other program) is running. Stop it, or run on another port, e.g. set PORT=3001 and open http://localhost:3001`);
    } else {
      console.error('Server failed to start:', err && err.message ? err.message : err);
    }
    process.exit(1);
  });
}
