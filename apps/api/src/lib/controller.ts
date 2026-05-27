import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { desc, eq, sql } from 'drizzle-orm';
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
import type { FilterField } from './query';
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

interface ControllerConfig {
  model: any;
  resource: string;
  idParam?: string;
  schema: ControllerSchema;
  auth?: ('store' | 'update' | 'destroy')[];
  ownership?: { field: string };
  filters?: FilterField[];
  sortable?: string[];
  pagination?: boolean;
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

function defaultIndex(ctx: ControllerContext): ResourceHandler {
  return async (request) => {
    const { db, config } = ctx;

    if (!config.filters && !config.sortable && !config.pagination) {
      return db.select().from(config.model).orderBy(desc(config.model.createdAt));
    }

    const { where, orderBy } = buildQuery(
      (request.query ?? {}) as Record<string, string>,
      { filters: config.filters, sortable: config.sortable },
      config.model,
    );

    const qb = db.select().from(config.model) as any;
    if (where) qb.where(where);
    qb.orderBy(orderBy?.length ? orderBy : [desc(config.model.createdAt)]);

    if (config.pagination) {
      const query = (request.query ?? {}) as any;
      const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10) || 20));

      let countQb = db.select({ count: sql<number>`count(*)` }).from(config.model) as any;
      if (where) countQb = countQb.where(where);
      const [{ count }] = await countQb;

      qb.limit(limit).offset((page - 1) * limit);
      const data = await qb;

      return {
        data,
        meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
      };
    }

    return qb;
  };
}

function defaultShow(ctx: ControllerContext): ResourceHandler {
  return async (request, reply) => {
    const { db, config } = ctx;
    const idParam = config.idParam ?? 'id';
    const id = (request.params as any)[idParam];
    const found = await findResource(db, config.model, id);
    if (!found) return reply.notFound(`${config.resource} not found`);
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
    const [created] = (await db.insert(config.model).values(values).returning()) as any[];
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

    const [updated] = (await db
      .update(config.model)
      .set(updateData)
      .where(eq(config.model.id, id))
      .returning()) as any[];
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
