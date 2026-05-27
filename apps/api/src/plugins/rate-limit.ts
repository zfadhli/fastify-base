import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { getEnv } from '@/lib/env';

export default fp(async (fastify: FastifyInstance) => {
  const env = getEnv();
  await fastify.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
  });
});
