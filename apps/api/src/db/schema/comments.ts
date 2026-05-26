import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { ulid } from 'ulid';
import { user } from './auth.js';
import { post } from './posts.js';

export const comment = sqliteTable('comment', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => ulid()),
  postId: text('postId')
    .notNull()
    .references(() => post.id),
  authorId: text('authorId')
    .notNull()
    .references(() => user.id),
  content: text('content').notNull(),
  createdAt: text('createdAt')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updatedAt')
    .notNull()
    .$defaultFn(() => new Date().toISOString())
    .$onUpdateFn(() => new Date().toISOString()),
});
