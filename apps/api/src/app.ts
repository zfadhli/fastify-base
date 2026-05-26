import path from 'node:path';
import { fileURLToPath } from 'node:url';
import autoload from '@fastify/autoload';
import cors from '@fastify/cors';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Fastify from 'fastify';
import { loadEnv } from '@/lib/env.js';
import { setupErrorHandler } from '@/lib/errors.js';
import { loadRoutes } from '@/lib/route-loader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function buildApp() {
  loadEnv();

  const app = Fastify({
    logger: true,
  }).withTypeProvider<TypeBoxTypeProvider>();

  await app.register(cors);

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({
      error: 'NOT_FOUND',
      message: 'Route not found',
      statusCode: 404,
    });
  });

  setupErrorHandler(app);

  await app.register(autoload, {
    dir: path.join(__dirname, 'plugins'),
  });

  await loadRoutes(app);

  return app;
}
