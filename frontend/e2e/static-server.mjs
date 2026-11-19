// Serves the built HR Ops app. /hr-ops -> index.html; other paths -> files in public/frontend.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { DEFAULTS } from './mock-data.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'st_automation', 'public', 'frontend');
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml' };

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/method/')) {
    // Mock API (used by the Lighthouse run; Playwright tests mock via page.route instead).
    const key = url.pathname.split('/api/method/')[1].replace(/^st_automation\.api\./, '');
    const handler = DEFAULTS[key];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: { status: 'success', message: '', data: handler ? handler({}) : {} } }));
    return;
  }
  const file = url.pathname.startsWith('/hr-ops') || url.pathname === '/' ? 'index.html' : path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, '');
  try {
    const body = await readFile(path.join(root, file));
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
}).listen(4173, '127.0.0.1');
