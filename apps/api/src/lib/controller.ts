import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import type {
  FastifyBaseLogger,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
} from 'fastify';
import Type from 'typebox';
import { getDb } from '@/db';
import type { SessionUser } from '@/plugins/auth';
import { ErrorResponseSchema } from './errors';
import type { FilterField, JoinConfig } from './query';
import { buildQuery } from './query';

type App = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  FastifyBaseLogger,
  TypeBoxTypeProvider
>;

export const E = {
  _401: ErrorResponseSchema,
  _403: ErrorResponseSchema,
  _404: ErrorResponseSchema,
};

export const S = {
  bearer: [{ bearerAuth: [] }],
};

const PaginationMeta = Type.Object({
  page: Type.Number(),
  limit: Type.Number(),
  total: Type.Number(),
  totalPages: Type.Number(),
});

export function getUser(request: FastifyRequest): SessionUser {
  return request.user!;
}

interface ControllerSchema {
  params?: any;
  listParams?: any;
  body?: any;
  updateBody?: any;
  response: any;
  listItem?: any;
}

interface VisibilityConfig {
  publishedField: string;
  ownerField: string;
}

interface ParentScopeConfig {
  paramField: string;
  column: string;
  parentModel?: any;
  parentResource?: string;
}

interface SlugConfig {
  sourceField: string;
  transform?: (value: string) => string;
  targetField?: string;
  fallback?: string;
}

export type IncludeConfig = {
  table: any;
  schema: any;
} & ({ type: 'single'; localKey: string; foreignKey: string } | { type: 'many'; localKey: string; foreignKey: string });

interface ControllerConfig {
  model: any;
  resource: string;
  idParam?: string;
  schema: ControllerSchema;
  auth?: ('store' | 'update' | 'destroy')[];
  ownership?: { field: string };
  visibility?: VisibilityConfig;
  parentScope?: ParentScopeConfig;
  filters?: FilterField[];
  sortable?: string[];
  pagination?: boolean;
  joins?: JoinConfig[];
  slug?: SlugConfig;
  includeMap?: Record<string, IncludeConfig>;
  handlers?: Partial<Record<'index' | 'show' | 'store' | 'update' | 'destroy', ResourceHandler>>;
}

interface ControllerContext {
  app: App;
  db: ReturnType<typeof getDb>;
  config: ControllerConfig;
}

type ResourceHandler = (request: FastifyRequest, reply: FastifyReply, ctx: ControllerContext) => any;

async function findResource(db: any, table: any, id: string) {
  const [found] = await db.select().from(table).where(eq(table.id, id)).limit(1);
  return found;
}

function checkOwnership(found: any, config: ControllerConfig, userId: string, userRole: string) {
  if (!config.ownership) return true;
  if (found[config.ownership.field] === userId) return true;
  if (userRole === 'admin') return true;
  return false;
}

function deriveProjection(model: any, schema: any): Record<string, any> | null {
  if (!schema?.properties) return null;
  const projection: Record<string, any> = {};
  for (const key of Object.keys(schema.properties)) {
    if (model[key]) projection[key] = model[key];
  }
  return Object.keys(projection).length > 0 ? projection : null;
}

function getConstraintColumn(err: any): string | null {
  const msg: string = err?.message ?? '';
  const match = msg.match(/UNIQUE constraint failed:\s*(\S+)/i);
  return match ? match[1]!.split('.').pop()! : null;
}

async function attachIncludes(items: any[], config: ControllerConfig, db: any): Promise<void> {
  if (!config.includeMap) return;
  for (const [alias, inc] of Object.entries(config.includeMap)) {
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

function defaultIndex(ctx: ControllerContext): ResourceHandler {
  return async (request) => {
    const { db, config } = ctx;

    const fastPath =
      !config.visibility &&
      !config.parentScope &&
      !config.filters &&
      !config.sortable &&
      !config.pagination &&
      !config.joins?.length;
    if (fastPath) {
      return db.select().from(config.model).orderBy(desc(config.model.createdAt));
    }

    const conditions: any[] = [];

    if (config.visibility) {
      const session = await ctx.app.getSession(request.headers);
      const { publishedField, ownerField } = config.visibility;
      if (!session) {
        conditions.push(eq(config.model[publishedField], true));
      } else if (session.user.role !== 'admin') {
        conditions.push(or(eq(config.model[publishedField], true), eq(config.model[ownerField], session.user.id)));
      }
    }

    if (config.parentScope) {
      const pv = config.parentScope;
      conditions.push(eq(config.model[pv.column], (request.params as any)[pv.paramField]));
    }

    const { where, orderBy, joins } = buildQuery(
      (request.query ?? {}) as Record<string, string>,
      { filters: config.filters, sortable: config.sortable, joins: config.joins },
      config.model,
    );
    if (where) conditions.push(where);

    const finalWhere = conditions.length > 0 ? and(...conditions) : undefined;

    const projection = deriveProjection(config.model, config.schema.listItem);
    const qb = projection ? (db.select(projection).from(config.model) as any) : (db.select().from(config.model) as any);

    for (const j of joins) qb.leftJoin(j.table, j.on);
    if (finalWhere) qb.where(finalWhere);
    if (orderBy?.length) {
      qb.orderBy(...orderBy);
    } else {
      qb.orderBy(desc(config.model.createdAt));
    }

    if (config.pagination) {
      const query = (request.query ?? {}) as any;
      const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10) || 20));

      let countQb = db.select({ count: sql<number>`count(*)` }).from(config.model) as any;
      for (const j of joins) countQb.leftJoin(j.table, j.on);
      if (finalWhere) countQb = countQb.where(finalWhere);
      const [{ count }] = await countQb;

      qb.limit(limit).offset((page - 1) * limit);
      const data = await qb;

      if (config.includeMap) {
        const includes = String((request.query as any)?.include ?? '');
        if (includes) await attachIncludes(data, config, db);
      }

      return {
        data,
        meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
      };
    }

    const data = await qb;
    if (config.includeMap) {
      const includes = String((request.query as any)?.include ?? '');
      if (includes) await attachIncludes(data, config, db);
    }
    return data;
  };
}

function defaultShow(ctx: ControllerContext): ResourceHandler {
  return async (request, reply) => {
    const { db, config } = ctx;
    const idParam = config.idParam ?? 'id';
    const id = (request.params as any)[idParam];
    const found = await findResource(db, config.model, id);
    if (!found) return reply.notFound(`${config.resource} not found`);

    if (config.visibility && !found[config.visibility.publishedField]) {
      const session = await ctx.app.getSession(request.headers);
      const isOwner = session?.user && found[config.visibility.ownerField] === session.user.id;
      const isAdmin = session?.user?.role === 'admin';
      if (!isOwner && !isAdmin) {
        return reply.notFound(`${config.resource} not found`);
      }
    }

    if (config.includeMap) {
      const includes = String((request.query as any)?.include ?? '');
      if (includes) await attachIncludes([found], config, db);
    }

    return found;
  };
}

function defaultStore(ctx: ControllerContext): ResourceHandler {
  return async (request, reply) => {
    const { db, config } = ctx;
    const body = request.body as any;
    const values: any = { ...body };
    if (config.ownership) {
      values[config.ownership.field] = getUser(request).id;
    }
    if (config.parentScope) {
      values[config.parentScope.column] = (request.params as any)[config.parentScope.paramField];
    }
    if (config.parentScope?.parentModel) {
      const parentId = (request.params as any)[config.parentScope.paramField];
      const parent = await findResource(db, config.parentScope.parentModel, parentId);
      if (!parent) {
        const label = config.parentScope.parentResource ?? `${config.resource} parent`;
        return reply.notFound(`${label} not found`);
      }
    }
    if (config.slug) {
      const source = values[config.slug.sourceField];
      if (source) {
        const fn =
          config.slug.transform ??
          ((s: string) =>
            s
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, ''));
        values[config.slug.targetField ?? 'slug'] =
          fn(String(source)).slice(0, 100) || (config.slug.fallback ?? 'untitled');
      }
    }
    let created: any;
    try {
      [created] = (await db.insert(config.model).values(values).returning()) as any[];
    } catch (err: any) {
      const col = getConstraintColumn(err);
      if (col) return reply.conflict(`${config.resource} with this ${col} already exists`);
      throw err;
    }
    reply.status(201);
    return created;
  };
}

function defaultUpdate(ctx: ControllerContext): ResourceHandler {
  return async (request, reply) => {
    const { db, config } = ctx;
    const idParam = config.idParam ?? 'id';
    const id = (request.params as any)[idParam];
    const body = request.body as any;
    const userId = getUser(request).id;
    const userRole = getUser(request).role;

    const found = await findResource(db, config.model, id);
    if (!found) return reply.notFound(`${config.resource} not found`);
    if (!checkOwnership(found, config, userId, userRole)) return reply.forbidden();

    const updateData: any = {};
    for (const key of Object.keys(body)) {
      if (body[key] !== undefined) updateData[key] = body[key];
    }

    if (config.slug && body[config.slug.sourceField] !== undefined) {
      const source = body[config.slug.sourceField];
      const fn =
        config.slug.transform ??
        ((s: string) =>
          s
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, ''));
      updateData[config.slug.targetField ?? 'slug'] =
        fn(String(source)).slice(0, 100) || (config.slug.fallback ?? 'untitled');
    }

    let updated: any;
    try {
      [updated] = (await db.update(config.model).set(updateData).where(eq(config.model.id, id)).returning()) as any[];
    } catch (err: any) {
      const col = getConstraintColumn(err);
      if (col) return reply.conflict(`${config.resource} with this ${col} already exists`);
      throw err;
    }
    return updated;
  };
}

function defaultDestroy(ctx: ControllerContext): ResourceHandler {
  return async (request, reply) => {
    const { db, config } = ctx;
    const idParam = config.idParam ?? 'id';
    const id = (request.params as any)[idParam];
    const userId = getUser(request).id;
    const userRole = getUser(request).role;

    const found = await findResource(db, config.model, id);
    if (!found) return reply.notFound(`${config.resource} not found`);
    if (!checkOwnership(found, config, userId, userRole)) return reply.forbidden();

    await db.delete(config.model).where(eq(config.model.id, id));
    return { ok: true };
  };
}

export function route(cb: (ctx: { app: App; db: ReturnType<typeof getDb> }) => void) {
  return async (fastify: FastifyInstance) => {
    const app = fastify.withTypeProvider<TypeBoxTypeProvider>();
    const db = getDb();
    return cb({ app, db });
  };
}

export function resource(config: ControllerConfig) {
  return async (fastify: FastifyInstance) => {
    const db = getDb();
    const router = fastify as any;
    const ctx: ControllerContext = { app: fastify.withTypeProvider<TypeBoxTypeProvider>(), db, config };
    const { schema, auth = [], handlers = {} } = config;
    const idParam = config.idParam ?? 'id';
    const tags = [`${config.resource}s`];

    const h = {
      index: handlers.index ? (req: any, rep: any) => handlers.index!(req, rep, ctx) : undefined,
      show: handlers.show ? (req: any, rep: any) => handlers.show!(req, rep, ctx) : undefined,
      store: handlers.store ? (req: any, rep: any) => handlers.store!(req, rep, ctx) : undefined,
      update: handlers.update ? (req: any, rep: any) => handlers.update!(req, rep, ctx) : undefined,
      destroy: handlers.destroy ? (req: any, rep: any) => handlers.destroy!(req, rep, ctx) : undefined,
    };

    const qsProps: Record<string, any> = {};
    if (config.filters) {
      for (const f of config.filters) {
        const ops = f.operators ?? ['eq'];
        const extra = ops.length > 1 ? ` Prefix with ${ops.filter((o) => o !== 'eq').join(', ')}.` : '';
        qsProps[f.field] = Type.Optional(Type.String({ description: `Filter by ${f.field}.${extra}` }));
      }
    }
    if (config.sortable?.length) {
      qsProps.sort = Type.Optional(
        Type.String({ description: `Sort by: ${config.sortable.join(', ')}. Prefix with - for descending.` }),
      );
    }
    if (config.pagination) {
      qsProps.page = Type.Optional(Type.String({ description: 'Page number (default: 1)' }));
      qsProps.limit = Type.Optional(Type.String({ description: 'Items per page (default: 20, max: 100)' }));
    }
    if (config.includeMap) {
      const keys = Object.keys(config.includeMap).join(', ');
      qsProps.include = Type.Optional(Type.String({ description: `Include related resources: ${keys}` }));
    }

    const indexResponse = config.pagination
      ? { 200: Type.Object({ data: Type.Array(schema.listItem ?? schema.response), meta: PaginationMeta }) }
      : { 200: Type.Array(schema.listItem ?? schema.response) };

    const indexOpts: any = {
      schema: {
        tags,
        summary: `List ${config.resource}s`,
        ...(schema.listParams && { params: schema.listParams }),
        ...(Object.keys(qsProps).length > 0 && { querystring: Type.Object(qsProps) }),
        response: indexResponse,
      },
      handler: h.index ?? defaultIndex(ctx),
    };
    router.get('/', indexOpts);

    router.get(`/:${idParam}`, {
      schema: {
        tags,
        summary: `Get ${config.resource} by ID`,
        params: schema.params,
        response: { 200: schema.response, 404: E._404 },
      },
      handler: h.show ?? defaultShow(ctx),
    });

    const storeOpts: any = {
      schema: {
        tags,
        summary: `Create ${config.resource}`,
        security: S.bearer,
        ...(schema.listParams && { params: schema.listParams }),
        body: schema.body,
        response: { 201: schema.response, 401: E._401 },
      },
      handler: h.store ?? defaultStore(ctx),
    };
    if (auth.includes('store')) storeOpts.preHandler = [fastify.requireAuth];
    router.post('/', storeOpts);

    const updateOpts: any = {
      schema: {
        tags,
        summary: `Update ${config.resource}`,
        security: S.bearer,
        params: schema.params,
        body: schema.updateBody ?? (schema.body ? Type.Partial(schema.body) : undefined),
        response: { 200: schema.response, 401: E._401, 403: E._403, 404: E._404 },
      },
      handler: h.update ?? defaultUpdate(ctx),
    };
    if (auth.includes('update')) updateOpts.preHandler = [fastify.requireAuth];
    router.put(`/:${idParam}`, updateOpts);

    const destroyOpts: any = {
      schema: {
        tags,
        summary: `Delete ${config.resource}`,
        security: S.bearer,
        params: schema.params,
        response: { 200: Type.Object({ ok: Type.Boolean() }), 401: E._401, 403: E._403, 404: E._404 },
      },
      handler: h.destroy ?? defaultDestroy(ctx),
    };
    if (auth.includes('destroy')) destroyOpts.preHandler = [fastify.requireAuth];
    router.delete(`/:${idParam}`, destroyOpts);
  };
}
