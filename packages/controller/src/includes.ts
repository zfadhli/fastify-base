import { inArray } from 'drizzle-orm';
import type { IncludeConfig } from './types';

export async function attachIncludes(items: any[], includeMap: Record<string, IncludeConfig>, db: any): Promise<void> {
  for (const [alias, inc] of Object.entries(includeMap)) {
    const localValues = [...new Set(items.map((d: any) => d[inc.localKey]).filter(Boolean))] as string[];
    if (localValues.length === 0) continue;
    const rows = await db.select().from(inc.table).where(inArray(inc.table[inc.foreignKey], localValues));
    if (inc.type === 'single') {
      const map = new Map(rows.map((r: any) => [String(r[inc.foreignKey]), r]));
      for (const item of items) {
        item[alias] = map.get(String(item[inc.localKey])) ?? null;
      }
    } else {
      const map = new Map<string, any[]>();
      for (const r of rows) {
        const key = String(r[inc.foreignKey]);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(r);
      }
      for (const item of items) {
        item[alias] = map.get(String(item[inc.localKey])) ?? [];
      }
    }
  }
}
