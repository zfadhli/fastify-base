import { eq } from 'drizzle-orm';
import { user } from '@/db/schema';
import { E, route } from '@/lib/controller';
import { UserParams, UserResponse } from './schemas';

export default route(({ app, db }) => {
  app.get('/:id', {
    schema: {
      tags: ['Users'],
      summary: 'Get user profile',
      description: 'Returns public profile information for a user by ID.',
      params: UserParams,
      response: {
        200: UserResponse,
        404: E._404,
      },
    },
    handler: async (request, reply) => {
      const { id } = request.params;

      const [found] = await db
        .select({ id: user.id, email: user.email, name: user.name, image: user.image, createdAt: user.createdAt })
        .from(user)
        .where(eq(user.id, id))
        .limit(1);

      if (!found) return reply.notFound('User not found');

      return found;
    },
  });
});
