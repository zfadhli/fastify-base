import { and, asc, desc, eq, gt, gte, like, lt, lte, ne } from 'drizzle-orm';

export interface FilterField {
  field: string;
  type: 'string' | 'boolean' | 'number';
  operators?: ('eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'ne' | 'like')[];
}

export interface JoinConfig {
  alias: string;
  table: any;
  on: any;
}

export interface QueryConfig {
  filters?: FilterField[];
  sortable?: string[];
  joins?: JoinConfig[];
}

export interface BuildQueryResult {
  where: any;
  orderBy: any[] | undefined;
  joins: { table: any; on: any }[];
}

const OP_MAP: Record<string, (col: any, val: any) => any> = {
  eq,
  gt,
  gte,
  lt,
  lte,
  ne,
  like,
};

function coerce(value: string, type: 'string' | 'boolean' | 'number') {
  if (type === 'boolean') {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  }
  if (type === 'number') {
    const n = Number(value);
    if (!Number.isNaN(n)) return n;
  }
  return value;
}

export function buildQuery(query: Record<string, string>, config: QueryConfig, table: any): BuildQueryResult {
  const conditions: any[] = [];
  const filterMap = new Map(config.filters?.map((f) => [f.field, f]) ?? []);
  const joinMap = new Map(config.joins?.map((j) => [j.alias, j]) ?? []);
  const usedJoins = new Set<string>();

  for (const [key, raw] of Object.entries(query)) {
    if (key === 'sort') continue;

    const filter = filterMap.get(key);
    if (!filter) continue;

    let col: any;

    const dotIdx = filter.field.indexOf('.');
    if (dotIdx > 0) {
      const alias = filter.field.slice(0, dotIdx);
      const colName = filter.field.slice(dotIdx + 1);
      const join = joinMap.get(alias);
      if (!join) continue;
      col = join.table[colName];
      if (!col) continue;
      usedJoins.add(alias);
    } else {
      col = table[filter.field];
      if (!col) continue;
    }

    const allowed = filter.operators ?? ['eq'];
    let op = 'eq';
    let value = raw;

    const colonIdx = raw.indexOf(':');
    if (colonIdx > 0) {
      const prefix = raw.slice(0, colonIdx);
      if (allowed.includes(prefix as any)) {
        op = prefix;
        value = raw.slice(colonIdx + 1);
      }
    }

    const fn = OP_MAP[op];
    if (fn) conditions.push(fn(col, coerce(value, filter.type)));
  }

  let orderBy: any[] | undefined;
  const sortRaw = query.sort;
  if (sortRaw && config.sortable) {
    const set = new Set(config.sortable);
    orderBy = sortRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const dir = s.startsWith('-') ? 'desc' : 'asc';
        const field = dir === 'desc' ? s.slice(1) : s;
        if (!set.has(field)) return null;
        const col = table[field];
        return col ? (dir === 'desc' ? desc(col) : asc(col)) : null;
      })
      .filter(Boolean) as any[];
  }

  return {
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: orderBy && orderBy.length > 0 ? orderBy : undefined,
    joins: Array.from(usedJoins).map((alias) => {
      const j = joinMap.get(alias)!;
      return { table: j.table, on: j.on };
    }),
  };
}
