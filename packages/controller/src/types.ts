import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type {
  FastifyBaseLogger,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
} from 'fastify';
import type { Relations } from 'drizzle-orm';
import type { FilterField, JoinConfig } from './query';

interface SessionUser {
  id: string;
  role: string;
}

type App = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  FastifyBaseLogger,
  TypeBoxTypeProvider
> & {
  getSession(headers: any): Promise<{ user: SessionUser } | null>;
  requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void>;
};

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

export type IncludeConfig = {
  table: any;
  schema: any;
} & ({ type: 'single'; localKey: string; foreignKey: string } | { type: 'many'; localKey: string; foreignKey: string });

interface LifecycleHooks {
  beforeCreate?: (values: any, request: FastifyRequest) => any | Promise<any>;
  afterCreate?: (created: any, request: FastifyRequest) => void | Promise<void>;
  beforeUpdate?: (updateData: any, found: any, request: FastifyRequest) => any | Promise<any>;
  afterUpdate?: (updated: any, request: FastifyRequest) => void | Promise<void>;
  beforeDelete?: (found: any, request: FastifyRequest) => void | Promise<void>;
  afterDelete?: (request: FastifyRequest) => void | Promise<void>;
}

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
  cursorPagination?: boolean;
  joins?: JoinConfig[];
  includeMap?: Record<string, IncludeConfig>;
  relations?: Relations[];
  includeSchemas?: Record<string, any>;
  lifecycle?: LifecycleHooks;
  handlers?: Partial<Record<'index' | 'show' | 'store' | 'update' | 'destroy', ResourceHandler>>;
}

interface ControllerContext {
  app: App;
  db: any;
  config: ControllerConfig;
}

type ResourceHandler = (request: FastifyRequest, reply: FastifyReply, ctx: ControllerContext) => any;

export type {
  SessionUser,
  App,
  ControllerSchema,
  VisibilityConfig,
  ParentScopeConfig,
  LifecycleHooks,
  ControllerConfig,
  ControllerContext,
  ResourceHandler,
};
