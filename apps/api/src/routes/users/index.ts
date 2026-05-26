import { and, desc, eq } from 'drizzle-orm';
import Type from 'typebox';
import { user } from '@/db/schema/auth.js';
import { post } from '@/db/schema/posts.js';
import { AppError, defineRoute, E } from '@/lib/define-route.js';
import { UserParams, UserPostsItem, UserResponse } from './schemas.js';

export default defineRoute(({ f, db, fastify }) => {
  f.get(
    '/:id',
    {
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
    },
    async (request, _reply) => {
      const { id } = request.params;

      const [found] = await db
        .select({ id: user.id, email: user.email, name: user.name, image: user.image, createdAt: user.createdAt })
        .from(user)
        .where(eq(user.id, id))
        .limit(1);

      if (!found) throw new AppError(404, 'NOT_FOUND', 'User not found');

      return found;
    },
  );

  f.get(
    '/:id/posts',
    {
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
    },
    async (request, _reply) => {
      const { id } = request.params;
      const session = await fastify.getSession(request.headers);
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
  );
});
