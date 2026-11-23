// HaqSetu AI — static build script
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

const ASSETS = [
  'index.html',
  'app.js',
  'engine.js',
  'persistence.js',
  'style.css',
  'sw.js',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'icon.svg',
  'data',
];

for (const asset of ASSETS) {
  const src = path.join(ROOT, asset);
  const dest = path.join(DIST, asset);
  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, { recursive: true });
  }
}

console.log('Build complete: static assets written to dist/');
