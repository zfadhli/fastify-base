import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

const __dirname = import.meta.dir;

async function loadRouteDir(fastify: FastifyInstance, dir: string, routesRoot: string) {
  try {
    const mod = await import(path.join(dir, 'index.js'));
    const relative = path.relative(routesRoot, dir);
    const parts = relative
      .split(path.sep)
      .map((p) => (p.startsWith('[') && p.endsWith(']') ? `:${p.slice(1, -1)}` : p));
    const prefix = `/api/${parts.join('/')}`;
    await fastify.register(mod.default ?? mod, { prefix });
  } catch {
    // skip directories without a route module
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    await loadRouteDir(fastify, path.join(dir, entry.name), routesRoot);
  }
}

export async function loadRoutes(fastify: FastifyInstance) {
  const routesDir = path.join(__dirname, '..', 'routes');
  await loadRouteDir(fastify, routesDir, routesDir);
}
