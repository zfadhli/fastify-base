import path from 'node:path';
import { fileURLToPath } from 'node:url';
import autoload from '@fastify/autoload';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { configure, setupErrorHandler } from '@fastify-base/controller';
import Fastify from 'fastify';
import { getDb } from '@/db';
import { loadEnv } from '@/lib/env';
import { loadRoutes } from '@/lib/route-loader';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function buildApp() {
  loadEnv();
  configure({ getDb });

  const app = Fastify({
    logger:
      process.env.NODE_ENV === 'production'
        ? true
        : {
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'HH:MM:ss.l',
                ignore: 'pid,hostname',
              },
            },
          },
  }).withTypeProvider<TypeBoxTypeProvider>();

  await app.register(cors);
  await app.register(sensible);

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
