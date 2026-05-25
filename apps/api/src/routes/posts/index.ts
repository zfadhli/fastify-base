import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { desc, eq, or } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { getDb } from '../../db/index.js';
import { post } from '../../db/schema/posts.js';
import { AppError } from '../../lib/errors.js';
import { nanoid } from '../../lib/nanoid.js';

const PostParams = Type.Object({ id: Type.String() });

const CreatePostBody = Type.Object({
  title: Type.String({ minLength: 1 }),
  content: Type.String({ minLength: 1 }),
  published: Type.Optional(Type.Boolean()),
});

const UpdatePostBody = Type.Partial(CreatePostBody);

const PostResponse = Type.Object({
  id: Type.String(),
  title: Type.String(),
  slug: Type.String(),
  content: Type.String(),
  published: Type.Boolean(),
  authorId: Type.String(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

const PostListItem = Type.Object({
  id: Type.String(),
  title: Type.String(),
  slug: Type.String(),
  published: Type.Boolean(),
  authorId: Type.String(),
  createdAt: Type.String(),
});

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

export default async function (fastify: FastifyInstance) {
  const f = fastify.withTypeProvider<TypeBoxTypeProvider>();

  f.get(
    '/',
    {
      schema: {
        response: {
          200: Type.Array(PostListItem),
        },
      },
    },
    async (request, _reply) => {
      const db = getDb();
      const session = await fastify.getSession(request.headers);
      const userRole = (session?.user as { role?: string } | undefined)?.role;

      if (userRole === 'admin') {
        return db
          .select({
            id: post.id,
            title: post.title,
            slug: post.slug,
            published: post.published,
            authorId: post.authorId,
            createdAt: post.createdAt,
          })
          .from(post)
          .orderBy(desc(post.createdAt));
      }

      if (session?.user) {
        return db
          .select({
            id: post.id,
            title: post.title,
            slug: post.slug,
            published: post.published,
            authorId: post.authorId,
            createdAt: post.createdAt,
          })
          .from(post)
          .where(or(eq(post.published, true), eq(post.authorId, String(session.user.id))))
          .orderBy(desc(post.createdAt));
      }

      return db
        .select({
          id: post.id,
          title: post.title,
          slug: post.slug,
          published: post.published,
          authorId: post.authorId,
          createdAt: post.createdAt,
        })
        .from(post)
        .where(eq(post.published, true))
        .orderBy(desc(post.createdAt));
    },
  );

  f.get(
    '/:id',
    {
      schema: {
        params: PostParams,
        response: {
          200: PostResponse,
        },
      },
    },
    async (request, _reply) => {
      const db = getDb();
      const { id } = request.params;
      const session = await fastify.getSession(request.headers);
      const userRole = (session?.user as { role?: string } | undefined)?.role;

      const [found] = await db.select().from(post).where(eq(post.id, id)).limit(1);

      if (!found) {
        throw new AppError(404, 'NOT_FOUND', 'Post not found');
      }

      const isAuthor = session?.user && found.authorId === String(session.user.id);
      const isAdmin = userRole === 'admin';

      if (!found.published && !isAuthor && !isAdmin) {
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
        body: CreatePostBody,
        response: {
          201: PostResponse,
        },
      },
    },
    async (request, reply) => {
      const db = getDb();
      const body = request.body;
      const session = await fastify.getSession(request.headers);
      const now = new Date().toISOString();
      const id = nanoid();
      const slug = slugify(body.title);

      await db.insert(post).values({
        id,
        title: body.title,
        slug: slug || 'untitled',
        content: body.content,
        published: body.published ?? false,
        authorId: String(session?.user.id),
        createdAt: now,
        updatedAt: now,
      });

      const [created] = await db.select().from(post).where(eq(post.id, id)).limit(1);

      reply.status(201);
      return created;
    },
  );

  f.put(
    '/:id',
    {
      preHandler: [fastify.requireAuth],
      schema: {
        params: PostParams,
        body: UpdatePostBody,
        response: {
          200: PostResponse,
        },
      },
    },
    async (request, _reply) => {
      const db = getDb();
      const { id } = request.params;
      const body = request.body;
      const session = await fastify.getSession(request.headers);

      const [existing] = await db.select().from(post).where(eq(post.id, id)).limit(1);

      if (!existing) {
        throw new AppError(404, 'NOT_FOUND', 'Post not found');
      }

      const userRole = (session?.user as { role?: string }).role;
      if (existing.authorId !== String(session?.user.id) && userRole !== 'admin') {
        throw new AppError(403, 'FORBIDDEN', 'Not authorized to update this post');
      }

      const now = new Date().toISOString();
      const updateData: Partial<{
        title: string;
        slug: string;
        content: string;
        published: boolean;
        updatedAt: string;
      }> = { updatedAt: now };

      if (body.title !== undefined) {
        updateData.title = body.title;
        updateData.slug = slugify(body.title) || 'untitled';
      }
      if (body.content !== undefined) updateData.content = body.content;
      if (body.published !== undefined) updateData.published = body.published;

      await db
        .update(post)
        // biome-ignore lint/suspicious/noExplicitAny: drizzle partial update types
        .set(updateData as any)
        .where(eq(post.id, id));

      const [updated] = await db.select().from(post).where(eq(post.id, id)).limit(1);

      return updated;
    },
  );

  f.delete(
    '/:id',
    {
      preHandler: [fastify.requireAuth],
      schema: {
        params: PostParams,
        response: {
          200: Type.Object({ ok: Type.Boolean() }),
        },
      },
    },
    async (request, _reply) => {
      const db = getDb();
      const { id } = request.params;
      const session = await fastify.getSession(request.headers);

      const [existing] = await db.select().from(post).where(eq(post.id, id)).limit(1);

      if (!existing) {
        throw new AppError(404, 'NOT_FOUND', 'Post not found');
      }

      const userRole = (session?.user as { role?: string }).role;
      if (existing.authorId !== String(session?.user.id) && userRole !== 'admin') {
        throw new AppError(403, 'FORBIDDEN', 'Not authorized to delete this post');
      }

      await db.delete(post).where(eq(post.id, id));

      return { ok: true };
    },
  );
}
