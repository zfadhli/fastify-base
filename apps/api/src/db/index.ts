import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { getEnv } from '../lib/env.js';

let _db: ReturnType<typeof drizzle>;

export function getDb() {
  if (!_db) {
    const env = getEnv();
    const client = createClient({ url: env.DATABASE_URL });
    _db = drizzle(client);
  }
  return _db;
}
