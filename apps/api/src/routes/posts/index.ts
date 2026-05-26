import { desc, eq, or } from 'drizzle-orm';
import Type from 'typebox';
import { post } from '@/db/schema/posts.js';
import { AppError, defineRoute, E, getUser, S } from '@/lib/define-route.js';
import { assertOwnerOrAdmin, getPostOrThrow, slugify } from './helpers.js';
import { CreatePostBody, PostListItem, PostParams, PostResponse, UpdatePostBody } from './schemas.js';

export default defineRoute(({ f, db, fastify }) => {
  const listProjection = {
    id: post.id,
    title: post.title,
    slug: post.slug,
    published: post.published,
    authorId: post.authorId,
    createdAt: post.createdAt,
  };

  f.get(
    '/',
    {
      schema: {
        tags: ['Posts'],
        summary: 'List posts',
        description:
          'Returns published posts. If authenticated as the author, also returns your unpublished posts. Admins see all posts.',
        response: {
          200: Type.Array(PostListItem),
        },
      },
    },
    async (request, _reply) => {
      const session = await fastify.getSession(request.headers);
      const query = db.select(listProjection).from(post).orderBy(desc(post.createdAt));

      if (session?.user?.role === 'admin') return query;

      if (session?.user) return query.where(or(eq(post.published, true), eq(post.authorId, session.user.id)));

      return query.where(eq(post.published, true));
    },
  );

  f.get(
    '/:id',
    {
      schema: {
        tags: ['Posts'],
        summary: 'Get post by ID',
        description: 'Returns a single post by ID. Unpublished posts are only visible to the author or admin.',
        params: PostParams,
        response: {
          200: PostResponse,
          404: E._404,
        },
      },
    },
    async (request, _reply) => {
      const { id } = request.params;
      const found = await getPostOrThrow(id);
      const session = await fastify.getSession(request.headers);
      const isAuthor = session?.user && found.authorId === session.user.id;

      if (!found.published && !isAuthor && session?.user?.role !== 'admin') {
        throw new AppError(404, 'NOT_FOUND', 'Post not found');
      }

      return found;
    },
  );

  f.post(
    '/',
    {
      preHandler: [fastify.requireAuth],
      schema: {
        tags: ['Posts'],
        summary: 'Create post',
        description: 'Creates a new blog post as the authenticated user.',
        security: S.bearer,
        body: CreatePostBody,
        response: {
          201: PostResponse,
          401: E._401,
        },
      },
    },
    async (request, reply) => {
      const body = request.body;

      const [created] = await db
        .insert(post)
        .values({
          title: body.title,
          slug: slugify(body.title) || 'untitled',
          content: body.content,
          published: body.published ?? false,
          authorId: getUser(request).id,
        })
        .returning();

      reply.status(201);
      return created;
    },
  );

  f.put(
    '/:id',
    {
      preHandler: [fastify.requireAuth],
      schema: {
        tags: ['Posts'],
        summary: 'Update post',
        description: 'Updates a post. Only the author or an admin can update.',
        security: S.bearer,
        params: PostParams,
        body: UpdatePostBody,
        response: {
          200: PostResponse,
          401: E._401,
          403: E._403,
          404: E._404,
        },
      },
    },
    async (request, _reply) => {
      const { id } = request.params;
      const body = request.body;
      const userId = getUser(request).id;
      const userRole = getUser(request).role;

      const existing = await getPostOrThrow(id);
      assertOwnerOrAdmin(existing, userId, userRole);

      const updateData: Partial<typeof post.$inferInsert> = {};

      if (body.title !== undefined) {
        updateData.title = body.title;
        updateData.slug = slugify(body.title) || 'untitled';
      }
      if (body.content !== undefined) updateData.content = body.content;
      if (body.published !== undefined) updateData.published = body.published;

      const [updated] = await db.update(post).set(updateData).where(eq(post.id, id)).returning();

      return updated;
    },
  );

  f.delete(
    '/:id',
    {
      preHandler: [fastify.requireAuth],
      schema: {
        tags: ['Posts'],
        summary: 'Delete post',
        description: 'Deletes a post. Only the author or an admin can delete.',
        security: S.bearer,
        params: PostParams,
        response: {
          200: Type.Object({ ok: Type.Boolean() }),
          401: E._401,
          403: E._403,
          404: E._404,
        },
      },
    },
    async (request, _reply) => {
      const { id } = request.params;
      const userId = getUser(request).id;
      const userRole = getUser(request).role;

      const existing = await getPostOrThrow(id);
      assertOwnerOrAdmin(existing, userId, userRole);

      await db.delete(post).where(eq(post.id, id));

      return { ok: true };
    },
  );
});
