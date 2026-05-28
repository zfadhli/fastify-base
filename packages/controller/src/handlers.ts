import { and, desc, eq, lt, or, sql } from 'drizzle-orm';
import { buildQuery } from './query';
import { attachIncludes } from './includes';
import { findResource, checkOwnership, deriveProjection, parseFields, getConstraintColumn } from './helpers';
import { getUser } from './schemas';
import type { ControllerContext, ResourceHandler } from './types';

function defaultIndex(ctx: ControllerContext): ResourceHandler {
  return async (request) => {
    const { db, config } = ctx;

    const fastPath =
      !config.visibility &&
      !config.parentScope &&
      !config.filters &&
      !config.sortable &&
      !config.pagination &&
      !config.cursorPagination &&
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

    if (config.cursorPagination) {
      const cursor = String((request.query as any)?.cursor ?? '');
      if (cursor) conditions.push(lt(config.model.id, cursor));
    }

    const { where, orderBy, joins } = buildQuery(
      (request.query ?? {}) as Record<string, string>,
      { filters: config.filters, sortable: config.sortable, joins: config.joins },
      config.model,
    );
    if (where) conditions.push(where);

    const finalWhere = conditions.length > 0 ? and(...conditions) : undefined;

    const fieldsProj = parseFields(
      String((request.query as any)?.fields ?? ''),
      config.model,
      ['id', ...(config.visibility ? [config.visibility.publishedField, config.visibility.ownerField] : [])],
    );
    const projection = fieldsProj ?? deriveProjection(config.model, config.schema.listItem);
    const qb = projection ? (db.select(projection).from(config.model) as any) : (db.select().from(config.model) as any);

    for (const j of joins) qb.leftJoin(j.table, j.on);
    if (finalWhere) qb.where(finalWhere);

    if (config.cursorPagination) {
      const query = (request.query ?? {}) as any;
      const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10) || 20));

      qb.orderBy(desc(config.model.id));
      qb.limit(limit + 1);
      const rows = await qb;

      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;
      const lastItem = data.length > 0 ? data[data.length - 1] : null;

      if (config.includeMap) {
        const includes = String((request.query as any)?.include ?? '');
        if (includes) await attachIncludes(data, config.includeMap!, db);
      }

      const meta: Record<string, any> = { limit, hasMore };
      if (lastItem) meta.cursor = lastItem.id;

      return { data, meta };
    }

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
        if (includes) await attachIncludes(data, config.includeMap!, db);
      }

      return {
        data,
        meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
      };
    }

    const data = await qb;
    if (config.includeMap) {
      const includes = String((request.query as any)?.include ?? '');
      if (includes) await attachIncludes(data, config.includeMap!, db);
    }
    return data;
  };
}

function defaultShow(ctx: ControllerContext): ResourceHandler {
  return async (request, reply) => {
    const { db, config } = ctx;
    const idParam = config.idParam ?? 'id';
    const id = (request.params as any)[idParam];
    const fieldsProj = parseFields(
      String((request.query as any)?.fields ?? ''),
      config.model,
      ['id', ...(config.visibility ? [config.visibility.publishedField, config.visibility.ownerField] : [])],
    );
    const found = await findResource(db, config.model, id, fieldsProj ?? undefined);
    if (!found) return reply.status(404).send({ error: 'NOT_FOUND', message: `${config.resource} not found`, statusCode: 404 });

    if (config.visibility && !found[config.visibility.publishedField]) {
      const session = await ctx.app.getSession(request.headers);
      const isOwner = session?.user && found[config.visibility.ownerField] === session.user.id;
      const isAdmin = session?.user?.role === 'admin';
      if (!isOwner && !isAdmin) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: `${config.resource} not found`, statusCode: 404 });
      }
    }

    if (config.includeMap) {
      const includes = String((request.query as any)?.include ?? '');
      if (includes) await attachIncludes([found], config.includeMap!, db);
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
        return reply.status(404).send({ error: 'NOT_FOUND', message: `${label} not found`, statusCode: 404 });
      }
    }
    if (config.lifecycle?.beforeCreate) {
      const overridden = await config.lifecycle.beforeCreate(values, request);
      if (overridden !== undefined) Object.assign(values, overridden);
    }
    let created: any;
    try {
      await db.transaction(async (tx: any) => {
        [created] = (await tx.insert(config.model).values(values).returning()) as any[];
        await config.lifecycle?.afterCreate?.(created, request);
      });
    } catch (err: any) {
      const col = getConstraintColumn(err);
      if (col) return reply.status(409).send({ error: 'CONFLICT', message: `${config.resource} with this ${col} already exists`, statusCode: 409 });
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
    if (!found) return reply.status(404).send({ error: 'NOT_FOUND', message: `${config.resource} not found`, statusCode: 404 });
    if (!checkOwnership(found, config, userId, userRole)) return reply.status(403).send({ error: 'FORBIDDEN', message: 'Forbidden', statusCode: 403 });

    const updateData: any = {};
    for (const key of Object.keys(body)) {
      if (body[key] !== undefined) updateData[key] = body[key];
    }

    if (config.lifecycle?.beforeUpdate) {
      const overridden = await config.lifecycle.beforeUpdate(updateData, found, request);
      if (overridden !== undefined) Object.assign(updateData, overridden);
    }

    let updated: any;
    try {
      await db.transaction(async (tx: any) => {
        [updated] = (await tx.update(config.model).set(updateData).where(eq(config.model.id, id)).returning()) as any[];
        await config.lifecycle?.afterUpdate?.(updated, request);
      });
    } catch (err: any) {
      const col = getConstraintColumn(err);
      if (col) return reply.status(409).send({ error: 'CONFLICT', message: `${config.resource} with this ${col} already exists`, statusCode: 409 });
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
    if (!found) return reply.status(404).send({ error: 'NOT_FOUND', message: `${config.resource} not found`, statusCode: 404 });
    if (!checkOwnership(found, config, userId, userRole)) return reply.status(403).send({ error: 'FORBIDDEN', message: 'Forbidden', statusCode: 403 });

    await config.lifecycle?.beforeDelete?.(found, request);
    await db.transaction(async (tx: any) => {
      await tx.delete(config.model).where(eq(config.model.id, id));
      await config.lifecycle?.afterDelete?.(request);
    });
    return { ok: true };
  };
}

export { defaultIndex, defaultShow, defaultStore, defaultUpdate, defaultDestroy };
