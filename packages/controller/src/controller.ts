import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import Type from 'typebox';
import { processRelations as _processRelations } from './relations';
import { getDb } from './configure';
import { PaginationMeta, CursorMeta, E, S } from './schemas';
import { defaultIndex, defaultShow, defaultStore, defaultUpdate, defaultDestroy } from './handlers';
import type { App, ControllerConfig, ControllerContext, ResourceHandler } from './types';

export { _processRelations as processRelations };

export function route(cb: (ctx: { app: App; db: any }) => void) {
  return async (fastify: FastifyInstance) => {
    const app = fastify.withTypeProvider<TypeBoxTypeProvider>() as unknown as App;
    const db = getDb();
    return cb({ app, db });
  };
}

export function resource(config: ControllerConfig) {
  if (config.relations) {
    const derived = _processRelations(config.model, config.relations, config.includeSchemas);
    config.joins = [...derived.joins, ...(config.joins ?? [])];
    config.includeMap = { ...derived.includeMap, ...config.includeMap };
  }

  return async (fastify: FastifyInstance) => {
    const db = getDb();
    const router = fastify as any;
    const ctx: ControllerContext = { app: fastify as unknown as App, db, config };
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
    if (config.cursorPagination) {
      qsProps.cursor = Type.Optional(Type.String({ description: 'Cursor from previous page response meta (last item ID)' }));
      qsProps.limit = Type.Optional(Type.String({ description: 'Items per page (default: 20, max: 100)' }));
    }
    qsProps.fields = Type.Optional(Type.String({ description: 'Comma-separated fields to include in response (e.g. id,title,content)' }));
    if (config.includeMap) {
      const keys = Object.keys(config.includeMap).join(', ');
      qsProps.include = Type.Optional(Type.String({ description: `Include related resources: ${keys}` }));
    }

    const indexResponse = config.cursorPagination
      ? { 200: Type.Object({ data: Type.Array(schema.listItem ?? schema.response), meta: CursorMeta }) }
      : config.pagination
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
    if (auth.includes('store')) storeOpts.preHandler = [(fastify as any).requireAuth];
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
    if (auth.includes('update')) updateOpts.preHandler = [(fastify as any).requireAuth];
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
    if (auth.includes('destroy')) destroyOpts.preHandler = [(fastify as any).requireAuth];
    router.delete(`/:${idParam}`, destroyOpts);
  };
}
