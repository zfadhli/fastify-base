import swagger from '@fastify/swagger';
import scalar from '@scalar/fastify-api-reference';
import fp from 'fastify-plugin';

export default fp(async (fastify) => {
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'Fastify Base API',
        description:
          'Production-ready Fastify template with blog API example.\n\nAuth endpoints (`/api/auth/*`) are proxied to better-auth and not individually documented here. Use `/api/auth/sign-up/email` and `/api/auth/sign-in/email` for authentication, then pass the returned `token` as a Bearer token in the `Authorization` header.',
        version: '1.0.0',
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'Bearer',
          },
        },
      },
    },
  });

  fastify.get('/openapi.json', { schema: { hide: true } }, async () => {
    return fastify.swagger();
  });

  await fastify.register(scalar, {
    routePrefix: '/docs',
  });
});
