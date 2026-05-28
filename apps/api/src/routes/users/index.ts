import type { IncludeConfig } from '@fastify-base/controller';
import { attachIncludes, E, route } from '@fastify-base/controller';
import { eq } from 'drizzle-orm';
import { post, user } from '@/db/schema';
import { PostIncludeSchema, UserParams, UserResponse } from './schemas';

const includeMap: Record<string, IncludeConfig> = {
  posts: {
    type: 'many',
    table: post,
    schema: PostIncludeSchema,
    localKey: 'id',
    foreignKey: 'authorId',
  },
};

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

      if (!found) return reply.status(404).send({ error: 'NOT_FOUND', message: 'User not found', statusCode: 404 });

      const includes = String((request.query as any)?.include ?? '');
      if (includes) await attachIncludes([found], includeMap, db);

      return found;
    },
  });
});
