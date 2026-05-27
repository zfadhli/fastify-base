import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { getEnv } from '@/lib/env';
import * as schema from './schema';

let _db: ReturnType<typeof drizzle>;

export function getDb() {
  if (!_db) {
    const env = getEnv();
    const client = createClient({ url: env.DATABASE_URL });
    _db = drizzle(client, { schema });
  }
  return _db;
}
