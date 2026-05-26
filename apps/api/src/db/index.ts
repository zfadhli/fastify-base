import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { getEnv } from '@/lib/env';
import * as authSchema from './schema/auth';
import * as commentsSchema from './schema/comments';
import * as postsSchema from './schema/posts';

let _db: ReturnType<typeof drizzle>;

export function getDb() {
  if (!_db) {
    const env = getEnv();
    const client = createClient({ url: env.DATABASE_URL });
    _db = drizzle(client, { schema: { ...authSchema, ...commentsSchema, ...postsSchema } });
  }
  return _db;
}
