import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { and, desc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { getDb } from '../../db/index.js';
import { user } from '../../db/schema/auth.js';
import { post } from '../../db/schema/posts.js';
import { AppError } from '../../lib/errors.js';

const UserParams = Type.Object({ id: Type.String() });

const UserResponse = Type.Object({
  id: Type.String(),
  email: Type.String(),
  name: Type.String(),
  image: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
});

export default async function (fastify: FastifyInstance) {
  const f = fastify.withTypeProvider<TypeBoxTypeProvider>();

  f.get(
    '/:id',
    {
      schema: {
        params: UserParams,
        response: {
          200: UserResponse,
        },
      },
    },
    async (request, _reply) => {
      const db = getDb();
      const { id } = request.params;

      const [found] = await db
        .select({ id: user.id, email: user.email, name: user.name, image: user.image, createdAt: user.createdAt })
        .from(user)
        .where(eq(user.id, id))
        .limit(1);

      if (!found) {
        throw new AppError(404, 'NOT_FOUND', 'User not found');
      }

      return found;
    },
  );

  f.get(
    '/:id/posts',
    {
      schema: {
        params: UserParams,
        response: {
          200: Type.Array(
            Type.Object({
              id: Type.String(),
              title: Type.String(),
              slug: Type.String(),
              published: Type.Boolean(),
              createdAt: Type.String(),
            }),
          ),
        },
      },
    },
    async (request, _reply) => {
      const db = getDb();
      const { id } = request.params;
      const session = await fastify.getSession(request.headers);
      const isOwner = session?.user && String(session.user.id) === id;
      const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin';

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
}
