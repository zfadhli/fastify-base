import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { ulid } from 'ulid';

export const user = sqliteTable('user', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => ulid()),
  email: text('email').notNull().unique(),
  emailVerified: integer('emailVerified', { mode: 'boolean' }).notNull().default(false),
  name: text('name').notNull(),
  image: text('image'),
  role: text('role').notNull().default('user'),
  createdAt: text('createdAt')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updatedAt')
    .notNull()
    .$defaultFn(() => new Date().toISOString())
    .$onUpdateFn(() => new Date().toISOString()),
});

export const session = sqliteTable('session', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => ulid()),
  userId: text('userId')
    .notNull()
    .references(() => user.id),
  token: text('token').notNull().unique(),
  expiresAt: integer('expiresAt').notNull(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  createdAt: text('createdAt')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updatedAt')
    .notNull()
    .$defaultFn(() => new Date().toISOString())
    .$onUpdateFn(() => new Date().toISOString()),
});

export const account = sqliteTable('account', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => ulid()),
  userId: text('userId')
    .notNull()
    .references(() => user.id),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  accessTokenExpiresAt: integer('accessTokenExpiresAt'),
  refreshTokenExpiresAt: integer('refreshTokenExpiresAt'),
  scope: text('scope'),
  idToken: text('idToken'),
  password: text('password'),
  createdAt: text('createdAt')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updatedAt')
    .notNull()
    .$defaultFn(() => new Date().toISOString())
    .$onUpdateFn(() => new Date().toISOString()),
});

export const verification = sqliteTable('verification', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => ulid()),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expiresAt').notNull(),
  createdAt: text('createdAt')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});
