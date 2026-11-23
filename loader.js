// HaqSetu AI — Node-only data loader. Browsers must not import this file.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(HERE, 'data');

function readJson(name) {
  return JSON.parse(readFileSync(path.join(DATA_DIR, name), 'utf8'));
}

export function loadCatalog() {
  const data = readJson('schemes.json');
  return Array.isArray(data?.schemes) ? data.schemes : [];
}

export function loadPersonas() {
  const data = readJson('personas.json');
  return Array.isArray(data?.personas) ? data.personas : [];
}

// Backward-compatible export.
export const demoPersonas = loadPersonas();
