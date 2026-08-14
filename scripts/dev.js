#!/usr/bin/env node
/**
 * Zero-dependency static server.
 *
 * Binds 0.0.0.0 and prints the LAN address so you can open the app on your
 * phone while it's running on your laptop — which is the only way to actually
 * test this thing, since it's a phone app.
 *
 *   npm run dev
 *
 * Note: iOS won't let a page use the camera over plain http from another
 * host. Localhost is exempt; your LAN IP is not. When you get to the label
 * -photo feature you'll need https — easiest path is a tunnel (cloudflared,
 * ngrok) or a locally-trusted cert via mkcert.
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { networkInterfaces } from 'node:os';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = Number(process.env.PORT) || 5173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};

createServer(async (req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  // normalize + strip leading separators so ../ can't escape ROOT
  const rel = normalize(url === '/' ? 'index.html' : url).replace(/^(\.\.[/\\])+/, '');
  const file = join(ROOT, rel);

  try {
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}).listen(PORT, '0.0.0.0', () => {
  const lan = Object.values(networkInterfaces())
    .flat()
    .find((n) => n.family === 'IPv4' && !n.internal);
  console.log(`\n  Sous Chef`);
  console.log(`  local    http://localhost:${PORT}`);
  if (lan) console.log(`  network  http://${lan.address}:${PORT}   ← open this on your phone`);
  console.log('');
});
