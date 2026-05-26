import { desc, eq } from 'drizzle-orm';
import Type from 'typebox';
import { comment } from '@/db/schema/comments.js';
import { post } from '@/db/schema/posts.js';
import { AppError, defineRoute, E, getUser, S } from '@/lib/define-route.js';
import { assertCommentOwnerOrAdmin, getCommentOrThrow } from './helpers.js';
import {
  CommentListItem,
  CommentParams,
  CommentResponse,
  CreateCommentBody,
  PostIdParams,
  UpdateCommentBody,
} from './schemas.js';

export default defineRoute(({ f, db, fastify }) => {
  f.get(
    '/',
    {
      schema: {
        tags: ['Comments'],
        summary: 'List comments for a post',
        description: 'Returns all comments for a post, ordered by newest first.',
        params: PostIdParams,
        response: {
          200: Type.Array(CommentListItem),
        },
      },
    },
    async (request) => {
      const { postId } = request.params;

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
  );

  f.get(
    '/:commentId',
    {
      schema: {
        tags: ['Comments'],
        summary: 'Get a comment',
        description: 'Returns a single comment by ID.',
        params: CommentParams,
        response: {
          200: CommentResponse,
          404: E._404,
        },
      },
    },
    async (request) => {
      const { commentId } = request.params;
      return getCommentOrThrow(commentId);
    },
  );

  f.post(
    '/',
    {
      preHandler: [fastify.requireAuth],
      schema: {
        tags: ['Comments'],
        summary: 'Create a comment',
        description: 'Creates a new comment on a post as the authenticated user.',
        security: S.bearer,
        params: PostIdParams,
        body: CreateCommentBody,
        response: {
          201: CommentResponse,
          401: E._401,
          404: E._404,
        },
      },
    },
    async (request, reply) => {
      const { postId } = request.params;
      const body = request.body;

      const [postExists] = await db.select({ id: post.id }).from(post).where(eq(post.id, postId)).limit(1);
      if (!postExists) throw new AppError(404, 'NOT_FOUND', 'Post not found');

      const [created] = await db
        .insert(comment)
        .values({
          postId,
          content: body.content,
          authorId: getUser(request).id,
        })
        .returning();

      reply.status(201);
      return created;
    },
  );

  f.put(
    '/:commentId',
    {
      preHandler: [fastify.requireAuth],
      schema: {
        tags: ['Comments'],
        summary: 'Update a comment',
        description: 'Updates a comment. Only the comment author or an admin can update.',
        security: S.bearer,
        params: CommentParams,
        body: UpdateCommentBody,
        response: {
          200: CommentResponse,
          401: E._401,
          403: E._403,
          404: E._404,
        },
      },
    },
    async (request, _reply) => {
      const { commentId } = request.params;
      const body = request.body;
      const userId = getUser(request).id;
      const userRole = getUser(request).role;

      const existing = await getCommentOrThrow(commentId);
      assertCommentOwnerOrAdmin(existing, userId, userRole);

      const updateData: Partial<typeof comment.$inferInsert> = {};

      if (body.content !== undefined) updateData.content = body.content;

      const [updated] = await db.update(comment).set(updateData).where(eq(comment.id, commentId)).returning();

      return updated;
    },
  );

  f.delete(
    '/:commentId',
    {
      preHandler: [fastify.requireAuth],
      schema: {
        tags: ['Comments'],
        summary: 'Delete a comment',
        description: 'Deletes a comment. Only the comment author or an admin can delete.',
        security: S.bearer,
        params: CommentParams,
        response: {
          200: Type.Object({ ok: Type.Boolean() }),
          401: E._401,
          403: E._403,
          404: E._404,
        },
      },
    },
    async (request, _reply) => {
      const { commentId } = request.params;
      const userId = getUser(request).id;
      const userRole = getUser(request).role;

      const existing = await getCommentOrThrow(commentId);
      assertCommentOwnerOrAdmin(existing, userId, userRole);

      await db.delete(comment).where(eq(comment.id, commentId));

      return { ok: true };
    },
  );
});
