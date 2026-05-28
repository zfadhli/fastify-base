import { eq } from 'drizzle-orm';
import type { ControllerConfig } from './types';

export async function findResource(db: any, table: any, id: string, projection?: Record<string, any>) {
  const qb = projection ? (db.select(projection).from(table) as any) : (db.select().from(table) as any);
  const [found] = await qb.where(eq(table.id, id)).limit(1);
  return found;
}

export function checkOwnership(found: any, config: ControllerConfig, userId: string, userRole: string) {
  if (!config.ownership) return true;
  if (found[config.ownership.field] === userId) return true;
  if (userRole === 'admin') return true;
  return false;
}

export function deriveProjection(model: any, schema: any): Record<string, any> | null {
  if (!schema?.properties) return null;
  const projection: Record<string, any> = {};
  for (const key of Object.keys(schema.properties)) {
    if (model[key]) projection[key] = model[key];
  }
  return Object.keys(projection).length > 0 ? projection : null;
}

export function parseFields(
  fieldsStr: string | undefined,
  model: any,
  requiredFields?: string[],
): Record<string, any> | null {
  if (!fieldsStr) return null;
  const parts = fieldsStr.split(',').map((f) => f.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const projection: Record<string, any> = {};
  for (const field of [...new Set([...parts, ...(requiredFields ?? [])])]) {
    if (model[field]) projection[field] = model[field];
  }
  return Object.keys(projection).length > 0 ? projection : null;
}

export function getConstraintColumn(err: any): string | null {
  const msg: string = err?.message ?? '';
  const match = msg.match(/UNIQUE constraint failed:\s*(\S+)/i);
  return match ? match[1]!.split('.').pop()! : null;
}
