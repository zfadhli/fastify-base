import { eq } from 'drizzle-orm';
import { getDb } from '@/db/index.js';
import { comment } from '@/db/schema/comments.js';
import { AppError } from '@/lib/define-route.js';

export async function getCommentOrThrow(commentId: string) {
  const db = getDb();
  const [found] = await db.select().from(comment).where(eq(comment.id, commentId)).limit(1);
  if (!found) throw new AppError(404, 'NOT_FOUND', 'Comment not found');
  return found;
}

export function assertCommentOwnerOrAdmin(found: typeof comment.$inferSelect, userId: string, userRole: string) {
  if (found.authorId !== userId && userRole !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Not authorized');
  }
}
