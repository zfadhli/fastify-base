import Type from 'typebox';
import { Controller } from '@/lib/controller';

export default Controller.route(({ app }) => {
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
