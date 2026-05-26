import { eq } from 'drizzle-orm';
import { getDb } from '@/db/index.js';
import { post } from '@/db/schema/posts.js';
import { AppError } from '@/lib/define-route.js';

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

export async function getPostOrThrow(id: string) {
  const db = getDb();
  const [found] = await db.select().from(post).where(eq(post.id, id)).limit(1);
  if (!found) throw new AppError(404, 'NOT_FOUND', 'Post not found');
  return found;
}

export function assertOwnerOrAdmin(found: typeof post.$inferSelect, userId: string, userRole: string) {
  if (found.authorId !== userId && userRole !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Not authorized');
  }
}
