import { desc, eq, or } from 'drizzle-orm';
import { post } from '@/db/schema';
import { getUser, resource } from '@/lib/controller';
import { slugify } from './helpers';
import { CreatePostBody, PostListItem, PostParams, PostResponse, UpdatePostBody } from './schemas';

export default resource({
  model: post,
  resource: 'Post',
  schema: {
    params: PostParams,
    body: CreatePostBody,
    updateBody: UpdatePostBody,
    response: PostResponse,
    listItem: PostListItem,
  },
  auth: ['store', 'update', 'destroy'],
  ownership: { field: 'authorId' },
  filters: [
    { field: 'published', type: 'boolean' },
    { field: 'authorId', type: 'string' },
  ],
  sortable: ['createdAt', 'title', 'published'],
  handlers: {
    async index(_request, _reply, { app, db }) {
      const session = await app.getSession(_request.headers);
      const projection = {
        id: post.id,
        title: post.title,
        slug: post.slug,
        published: post.published,
        authorId: post.authorId,
        createdAt: post.createdAt,
      };
      const query = db.select(projection).from(post).orderBy(desc(post.createdAt));

      if (session?.user?.role === 'admin') return query;
      if (session?.user) return query.where(or(eq(post.published, true), eq(post.authorId, session.user.id)));
      return query.where(eq(post.published, true));
    },

    async show(request, reply, { app, db }) {
      const { id } = request.params as any;
      const [found] = await db.select().from(post).where(eq(post.id, id)).limit(1);
      if (!found) return reply.notFound('Post not found');

      const session = await app.getSession(request.headers);
      const isAuthor = session?.user && found.authorId === session.user.id;
      if (!found.published && !isAuthor && session?.user?.role !== 'admin') {
        return reply.notFound('Post not found');
      }

      return found;
    },

    async store(request, reply, { db }) {
      const body = request.body as any;
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

    async update(request, reply, { db }) {
      const { id } = request.params as any;
      const body = request.body as any;
      const userId = getUser(request).id;
      const userRole = getUser(request).role;

      const [found] = await db.select().from(post).where(eq(post.id, id)).limit(1);
      if (!found) return reply.notFound('Post not found');
      if (found.authorId !== userId && userRole !== 'admin') {
        return reply.forbidden();
      }

      const updateData: any = {};
      if (body.title !== undefined) {
        updateData.title = body.title;
        updateData.slug = slugify(body.title) || 'untitled';
      }
      if (body.content !== undefined) updateData.content = body.content;
      if (body.published !== undefined) updateData.published = body.published;

      const [updated] = await db.update(post).set(updateData).where(eq(post.id, id)).returning();
      return updated;
    },
  },
});
