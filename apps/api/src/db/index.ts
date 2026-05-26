import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { getEnv } from '@/lib/env.js';
import * as authSchema from './schema/auth.js';
import * as commentsSchema from './schema/comments.js';
import * as postsSchema from './schema/posts.js';

let _db: ReturnType<typeof drizzle>;

export function getDb() {
  if (!_db) {
    const env = getEnv();
    const client = createClient({ url: env.DATABASE_URL });
    _db = drizzle(client, { schema: { ...authSchema, ...commentsSchema, ...postsSchema } });
  }
  return _db;
}
