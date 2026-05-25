import path from 'node:path';
import { fileURLToPath } from 'node:url';
import autoload from '@fastify/autoload';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Fastify from 'fastify';
import { loadEnv } from './lib/env.js';
import { setupErrorHandler } from './lib/errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function buildApp() {
  loadEnv();

  const app = Fastify({
    logger: true,
  }).withTypeProvider<TypeBoxTypeProvider>();

  setupErrorHandler(app);

  await app.register(autoload, {
    dir: path.join(__dirname, 'plugins'),
  });

  await app.register(autoload, {
    dir: path.join(__dirname, 'routes'),
    options: { prefix: '/api' },
  });

  return app;
}
