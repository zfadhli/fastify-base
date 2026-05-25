import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { user } from './auth';

export const post = sqliteTable('post', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  content: text('content').notNull(),
  published: integer('published', { mode: 'boolean' }).notNull().default(false),
  authorId: text('author_id')
    .notNull()
    .references(() => user.id),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
