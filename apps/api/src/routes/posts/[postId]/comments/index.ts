import { desc, eq } from 'drizzle-orm';
import { comment, post } from '@/db/schema';
import { Controller, getUser } from '@/lib/controller';
import {
  CommentListItem,
  CommentParams,
  CommentResponse,
  CreateCommentBody,
  PostIdParams,
  UpdateCommentBody,
} from './schemas';

export default Controller.resource({
  model: comment,
  resource: 'Comment',
  idParam: 'commentId',
  schema: {
    params: CommentParams,
    listParams: PostIdParams,
    body: CreateCommentBody,
    updateBody: UpdateCommentBody,
    response: CommentResponse,
    listItem: CommentListItem,
  },
  auth: ['store', 'update', 'destroy'],
  ownership: { field: 'authorId' },
  sortable: ['createdAt'],
  handlers: {
    async index(request, _reply, { db }) {
      const { postId } = request.params as any;
      return db
        .select({
          id: comment.id,
          authorId: comment.authorId,
          content: comment.content,
          createdAt: comment.createdAt,
        })
        .from(comment)
        .where(eq(comment.postId, postId))
        .orderBy(desc(comment.createdAt));
    },

    async store(request, reply, { db }) {
      const { postId } = request.params as any;
      const body = request.body as any;

      const [postExists] = await db.select({ id: post.id }).from(post).where(eq(post.id, postId)).limit(1);
      if (!postExists) return reply.notFound('Post not found');

      const [created] = await db
        .insert(comment)
        .values({ postId, content: body.content, authorId: getUser(request).id })
        .returning();
      reply.status(201);
      return created;
    },
  },
});
