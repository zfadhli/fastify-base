import { relations } from 'drizzle-orm';
import { user } from './auth';
import { comment } from './comments';
import { post } from './posts';

export const userRelations = relations(user, ({ many }) => ({
  posts: many(post),
}));

export const postRelations = relations(post, ({ one, many }) => ({
  author: one(user, {
    fields: [post.authorId],
    references: [user.id],
  }),
  comments: many(comment),
}));

export const commentRelations = relations(comment, ({ one }) => ({
  post: one(post, {
    fields: [comment.postId],
    references: [post.id],
  }),
  author: one(user, {
    fields: [comment.authorId],
    references: [user.id],
  }),
}));
