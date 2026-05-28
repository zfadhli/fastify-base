import { route } from '@fastify-base/controller';
import Type from 'typebox';

export default route(({ app }) => {
  app.get('/', {
    schema: {
      tags: ['Health'],
      summary: 'Health check',
      description: 'Returns the current server status and timestamp.',
      response: {
        200: Type.Object({
          status: Type.String(),
          timestamp: Type.String(),
        }),
      },
    },
    handler: async () => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    },
  });
});
