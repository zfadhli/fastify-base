# Controller — Config-Driven CRUD

The controller module at `lib/controller.ts` eliminates boilerplate REST handlers. You declare the shape of a resource via a config object, and `resource()` registers all 5 endpoints (index, show, store, update, destroy) with full TypeBox validation and auto-generated OpenAPI docs.

---

## Two Entry Points

| Export | Description |
|---|---|
| `resource(config)` | Registers all 5 REST endpoints (CRUD). |
| `route(cb)` | Low-level helper for custom routes. Passes `{ app, db }` to the callback. Not a full plugin — just a factory. |

---

## Config Reference (`ControllerConfig`)

```typescript
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
  lifecycle?: LifecycleHooks;
  includeMap?: Record<string, IncludeConfig>;
  handlers?: Partial<Record<'index' | 'show' | 'store' | 'update' | 'destroy', ResourceHandler>>;
}
```

### `model` — Drizzle Table

The drizzle table object. Used for all queries.

### `resource` — Name (Singular)

Used in error messages, summary tags, and conflict responses. Example: `'Post'` produces `'Post not found'`.

### `idParam` — URL ID Parameter (default: `'id'`)

The URL param name for the resource ID. For nested resources, e.g. comments under `/posts/:postId/comments/:commentId`, set `idParam: 'commentId'`.

### `schema` — TypeBox Schemas

```typescript
interface ControllerSchema {
  params?: any;       // URL params
  listParams?: any;   // URL params on list/create (for nested routes)
  body?: any;         // Create request body
  updateBody?: any;   // Update body (defaults to Partial(body))
  response: any;      // Single item response
  listItem?: any;     // List response projection (defaults to response)
}
```

`listItem` enables a leaner response shape for list endpoints. The controller derives the column projection from its property keys.

### `auth` — Authentication Guards

Controls which operations require authentication. Available values: `'index'`, `'show'`, `'store'`, `'update'`, `'destroy'`.

```typescript
auth: ['store', 'update', 'destroy']
```

The controller auto-adds `preHandler: [fastify.requireAuth]` to each guarded route.

### `ownership` — Owner Checks

```typescript
ownership: { field: 'authorId' }
```

Restricts update and destroy to the record owner. Admins bypass the check (returns 403 for non-owners).

### `visibility` — Row-Level Security

```typescript
visibility: { publishedField: 'published', ownerField: 'authorId' }
```

Applied on index and show:

| Role | Published | Unpublished |
|---|---|---|
| Guest | Visible | 404 |
| User | Visible | Visible if own, else 404 |
| Admin | Visible | Visible |

Uses 404 (not 403) to avoid leaking existence of unpublished records.

### `parentScope` — Nested Resources

For routes like `/posts/:postId/comments`:

```typescript
parentScope: {
  paramField: 'postId',     // URL param name
  column: 'postId',         // FK column on child table
  parentModel?: post,        // Validates parent exists
  parentResource?: 'Post',  // Error message label
}
```

- Index: filters results by `postId = params.postId`
- Store: auto-sets `postId` from params
- When `parentModel` is set, returns 404 if parent doesn't exist

### `filters` — Query String Filters

```typescript
filters: [
  { field: 'published', type: 'boolean' },
  { field: 'author.name', type: 'string', operators: ['eq', 'like'] },
  { field: 'createdAt', type: 'string', operators: ['gt', 'gte', 'lt', 'lte'] },
]
```

- Direct field: `?published=true`
- Dot notation: `?author.name=like:john` — resolves via join alias
- Operator prefix: `?createdAt=gt:2024-01-01`
- Default operator when no prefix: `eq`

### `sortable` — Sort Columns

```typescript
sortable: ['createdAt', 'title', 'published']
```

- `?sort=-createdAt` — descending
- `?sort=title` — ascending
- `?sort=-createdAt,title` — multiple

### `pagination` — Offset Pagination

```typescript
pagination: true
```

- `?page=2&limit=10`
- Defaults: `page=1`, `limit=20`
- Max: `limit=100`

Pagination response shape:

```json
{
  "data": [...],
  "meta": { "page": 2, "limit": 10, "total": 42, "totalPages": 5 }
}
```

### `joins` — LEFT JOIN (for filtering/sorting only)

```typescript
joins: [{ alias: 'author', table: user, on: eq(post.authorId, user.id) }]
```

Joins are used exclusively for cross-table filtering and sorting (dot notation like `author.name`). They are **not** embedded in the response. To embed related data, use `includeMap`.

Only the joins actually referenced by active filters are executed.

### `lifecycle` — Hooks

```typescript
lifecycle: {
  beforeCreate: (values, request) => { if (values.title) values.slug = slugify(values.title); },
  afterCreate: (created, request) => { log('created', created.id); },
  beforeUpdate: (updateData, found, request) => { if (updateData.title) updateData.slug = slugify(updateData.title); },
  afterUpdate: (updated, request) => { /* fire-and-forget */ },
  beforeDelete: (found, request) => { /* pre-delete logic */ },
  afterDelete: (request) => { /* cleanup */ },
}
```

| Hook | Signature | Purpose |
|---|---|---|
| `beforeCreate` | `(values, request)` → `object \| undefined` | Mutate input data before insert. Return an object to merge. |
| `afterCreate` | `(created, request)` → `void` | Side effects after insert. |
| `beforeUpdate` | `(updateData, found, request)` → `object \| undefined` | Mutate update data. Return an object to merge. |
| `afterUpdate` | `(updated, request)` → `void` | Side effects after update. |
| `beforeDelete` | `(found, request)` → `void` | Pre-delete logic. |
| `afterDelete` | `(request)` → `void` | Side effects after delete. |

`before*` hooks can modify data by returning an object (merged via `Object.assign`). Return `undefined` to skip merging. Throw to abort the operation.

This replaces the old dedicated `slug` config — slug generation is now expressed via `beforeCreate`/`beforeUpdate` hooks, giving full control over the logic.

### `includeMap` — Eager-Loaded Relations

```typescript
includeMap: {
  author: { type: 'single', table: user, schema: UserResponse, localKey: 'authorId', foreignKey: 'id' },
  comments: { type: 'many', table: comment, schema: CommentListItem, localKey: 'id', foreignKey: 'postId' },
}
```

Triggered via the `include` query param: `?include=author` or `?include=author,comments`.

| Type | Semantics | Example |
|---|---|---|
| `single` | Main table has FK | `post.authorId → user.id` |
| `many` | Related table has FK | `comment.postId → post.id` |

Implementation: one `SELECT ... WHERE fk IN (...)` per include (batched, no N+1). Results are attached in-place on the response items.

`single` → embeds one object (or `null`). `many` → embeds an array.

### `handlers` — Custom Overrides

```typescript
handlers: {
  index: async (req, rep, ctx) => {
    // ctx: { app, db, config }
    return ctx.db.select().from(ctx.config.model);
  },
}
```

The 3rd argument `ctx` provides access to the configured app (with TypeBox type provider), db, and the full config object.

---

## Schema Auto-Generation

The `resource()` function auto-generates OpenAPI schemas for:

- **Tags**: derived from `config.resource` (e.g., `'Posts'`)
- **Query string params**: filters, sort, pagination, include — all get TypeBox schemas with descriptions
- **Security**: bearer auth added to store, update, destroy
- **Error responses**: 401, 403, 404 added based on auth config

---

## Response Includes — Examples

Request: `GET /api/posts/post_abc?include=author`

```json
{
  "id": "post_abc",
  "title": "Hello World",
  "author": {
    "id": "user_xyz",
    "name": "Admin User",
    "email": "admin@example.com"
  }
}
```

Request: `GET /api/posts/post_abc?include=author,comments`

```json
{
  "id": "post_abc",
  "title": "Hello World",
  "author": { "id": "user_xyz", "name": "Admin User" },
  "comments": [
    { "id": "com_123", "content": "Great post!", "authorId": "user_456" }
  ]
}
```

---

## Error Responses

All errors use `@fastify/sensible` reply helpers:

| Status | Helper | When |
|---|---|---|
| 400 | `reply.badRequest()` | Validation errors (fastify built-in) |
| 401 | `reply.unauthorized()` | Missing/invalid auth token |
| 403 | `reply.forbidden()` | Not owner, not admin |
| 404 | `reply.notFound()` | Resource not found |
| 409 | `reply.conflict()` | Unique constraint violation (includes column name) |

Constraint errors are caught in `defaultStore` and `defaultUpdate`, parsed from the SQLite error message, and returned as `'Post with this slug already exists'`.

---

## Internal Architecture

```
resource(config)
  └─ creates ControllerContext { app, db, config }
  └─ wraps custom handlers → inject ctx as 3rd arg
  └─ builds TypeBox querystring schema
  └─ registers 5 routes:
       GET    /            → defaultIndex
       GET    /:id         → defaultShow
       POST   /            → defaultStore
       PUT    /:id         → defaultUpdate
       DELETE /:id         → defaultDestroy
```

### Default Handlers

**`defaultIndex`**: Query builder with:
- Fast path for trivial resources (no visibility, scoping, filters, etc.)
- Visibility conditions + parent scope conditions + parsed filters
- LEFT JOINs for cross-table filters
- Offset pagination with count query
- Projection from `listItem` schema
- `attachIncludes` post-processing

**`defaultShow`**: Single record with:
- 404 if not found
- Visibility check (published or own or admin)
- `attachIncludes` for single item

**`defaultStore`**: Insert with:
- Ownership field auto-set from session user
- Parent scope FK auto-set from URL params
- Parent existence validation
- Slug generation
- Unique constraint error handling (409)

**`defaultUpdate`**: Partial update with:
- Ownership check
- Slug re-generation on source change
- Unique constraint error handling (409)

**`defaultDestroy`**: Hard delete with ownership check. Returns `{ ok: true }`.

### Helper Functions

| Function | Purpose |
|---|---|
| `findResource` | `SELECT * WHERE id = ? LIMIT 1` |
| `checkOwnership` | Field comparison + admin override |
| `deriveProjection` | Column selection from TypeBox schema |
| `getConstraintColumn` | Parse SQLite UNIQUE error → column name |
| `attachIncludes` | Batch-fetch and nest related records |

---

## Minimal Examples

### Read-only resource (public)

```typescript
export default resource({
  model: post,
  resource: 'Post',
  schema: { params: PostParams, response: PostResponse },
});
```

### Authenticated CRUD with filters

```typescript
export default resource({
  model: post,
  resource: 'Post',
  schema: { params: PostParams, body: CreatePostBody, response: PostResponse },
  auth: ['store', 'update', 'destroy'],
  ownership: { field: 'authorId' },
  filters: [{ field: 'published', type: 'boolean' }],
  sortable: ['createdAt'],
  pagination: true,
});
```

### Nested resource with full config

```typescript
export default resource({
  model: comment,
  resource: 'Comment',
  idParam: 'commentId',
  schema: {
    params: CommentParams,
    listParams: PostIdParams,
    body: CreateCommentBody,
    response: CommentResponse,
  },
  auth: ['store', 'update', 'destroy'],
  ownership: { field: 'authorId' },
  parentScope: { paramField: 'postId', column: 'postId', parentModel: post, parentResource: 'Post' },
  sortable: ['createdAt'],
});
```

### Custom route (non-CRUD)

```typescript
import { route } from '@/lib/controller';

export default route(({ app, db }) => {
  app.get('/posts/stats', {
    schema: { response: { 200: StatsResponse } },
    handler: async () => db.select({ count: sql\`count(*)\` }).from(post),
  });
});
```

---

## Exports

```typescript
export function route(cb: (ctx: { app: App; db: ReturnType<typeof getDb> }) => void);
export function resource(config: ControllerConfig);
export function getUser(request: FastifyRequest): SessionUser;
export const E: { _401: any; _403: any; _404: any };
export const S: { bearer: any };
export type IncludeConfig = { ... };
```
