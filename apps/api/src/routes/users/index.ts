import { and, desc, eq } from 'drizzle-orm';
import Type from 'typebox';
import { post, user } from '@/db/schema';
import { E, route } from '@/lib/controller';
import { UserParams, UserPostsItem, UserResponse } from './schemas';

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

  app.get('/:id/posts', {
    schema: {
      tags: ['Users'],
      summary: 'List user posts',
      description:
        'Returns published posts by a user. If authenticated as the owner or admin, also returns unpublished posts.',
      params: UserParams,
      response: {
        200: Type.Array(UserPostsItem),
      },
    },
    handler: async (request) => {
      const { id } = request.params;
      const session = await app.getSession(request.headers);
      const isOwner = session?.user?.id === id;
      const isAdmin = session?.user?.role === 'admin';

      const where = isOwner || isAdmin ? eq(post.authorId, id) : and(eq(post.authorId, id), eq(post.published, true));

      return db
        .select({
          id: post.id,
          title: post.title,
          slug: post.slug,
          published: post.published,
          createdAt: post.createdAt,
        })
        .from(post)
        .where(where)
        .orderBy(desc(post.createdAt));
    },
  });
});
