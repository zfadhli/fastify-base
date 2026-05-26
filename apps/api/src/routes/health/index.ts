import Type from 'typebox';
import { defineRoute } from '@/lib/define-route.js';

export default defineRoute(({ f }) => {
  f.get(
    '/',
    {
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
    },
    async () => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    },
  );
});
