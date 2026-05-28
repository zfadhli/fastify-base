# fastify-base

Production-ready Fastify + TypeScript template with a complete blog API example. Config-driven CRUD controller, monorepo with Bun workspace, Drizzle ORM, libsql, better-auth, TypeBox, Scalar docs.

## Stack

| Layer | Choice |
|---|---|
| Runtime | Bun 1.3+ |
| Framework | Fastify 5.8 |
| Validation | TypeBox 1.x + TypeBox TypeProvider |
| Database | libsql (SQLite / Turso-compatible) |
| ORM | Drizzle ORM 0.45 |
| Auth | Better Auth 1.6 (email+password) |
| Docs | Scalar API Reference (OpenAPI 3.1) |
| CLI | CAC + Clack + Handlebars (scaffold, seed) |
| Language | TypeScript 6.0, strict mode |
| Lint | Biome 2.4 |

## Project Structure

```
├── apps/
│   ├── api/                          # Fastify server
│   │   ├── src/
│   │   │   ├── index.ts              # entry point
│   │   │   ├── app.ts                # Fastify factory
│   │   │   ├── lib/
│   │   │   │   ├── controller.ts     # config-driven CRUD (route, resource)
│   │   │   │   ├── query.ts          # query string parser (filters, sort, joins)
│   │   │   │   ├── errors.ts         # error handler
│   │   │   │   ├── env.ts            # TypeBox-validated env
│   │   │   │   └── route-loader.ts   # recursive route scanner
│   │   │   ├── db/
│   │   │   │   ├── schema/
│   │   │   │   │   ├── auth.ts       # user, session, account, verification
│   │   │   │   │   ├── posts.ts      # blog posts
│   │   │   │   │   ├── comments.ts   # comments
│   │   │   │   │   └── index.ts      # barrel export
│   │   │   │   └── index.ts          # drizzle client (barrel import)
│   │   │   ├── plugins/
│   │   │   │   ├── auth.ts           # better-auth init, hooks, proxy
│   │   │   │   ├── rate-limit.ts     # @fastify/rate-limit
│   │   │   │   └── scalar.ts         # Swagger + Scalar UI
│   │   │   └── routes/               # autoloaded
│   │   │       ├── posts/
│   │   │       │   ├── index.ts      # resource config
│   │   │       │   ├── schemas.ts    # TypeBox schemas
│   │   │       │   ├── helpers.ts    # slugify
│   │   │       │   └── [postId]/
│   │   │       │       └── comments/ # nested resource
│   │   │       ├── users/            # profile endpoint
│   │   │       └── health/
│   │   └── drizzle.config.ts
│   └── cli/                          # Scaffold + seed
│       ├── src/
│       │   ├── index.ts              # CAC entry point
│       │   ├── commands/
│       │   │   ├── scaffold.ts       # interactive resource generator
│       │   │   └── seed.ts           # database seed (imports from api)
│       │   └── templates.ts          # Handlebars template loader
│       └── templates/                # .hbs templates
├── Dockerfile
├── docker-compose.yml
└── package.json                      # workspace root
```

## Quick Start

```bash
cp .env.example apps/api/.env
bun install
bun run db:migrate
bun run db:seed            # 2 users, 3 posts, 3 comments
bun dev
```

Server at `http://localhost:3000`. API docs at `/docs`.

Test credentials after seeding:

| Role  | Email               | Password  |
|-------|---------------------|-----------|
| Admin | admin@example.com   | admin123  |
| User  | user@example.com    | user123   |

## Scripts

| Command | Action |
|---|---|
| `bun dev` | Start with file watching |
| `bun run typecheck` | TypeScript check |
| `bun run db:generate` | Generate Drizzle migrations |
| `bun run db:migrate` | Apply migrations |
| `bun run db:studio` | Drizzle Studio GUI |
| `bun run db:seed` | Seed database (from CLI workspace) |
| `bun run gen` | Run scaffold generator |
| `bun run lint` | Format + lint (Biome) |
| `bun run lint:ci` | Lint check only |

## Config-Driven CRUD Controller

The core of the API — `lib/controller.ts` exports `resource()` which generates 5 REST endpoints from a config object. No manual handler code needed.

```typescript
export default resource({
  model: post,
  resource: 'Post',
  schema: { params, body, updateBody, response, listItem },
  auth: ['store', 'update', 'destroy'],
  ownership: { field: 'authorId' },
  visibility: { publishedField: 'published', ownerField: 'authorId' },
  filters: [{ field: 'published', type: 'boolean' }],
  sortable: ['createdAt', 'title'],
  pagination: true,
  joins: [{ alias: 'author', table: user, on: eq(post.authorId, user.id) }],
  slug: { sourceField: 'title', transform: slugify },
  softDelete: { field: 'deletedAt', deletedBy: 'deletedById' },
  searchable: ['title', 'content'],
  includeMap: {
    author: { type: 'single', table: user, schema: UserResponse, localKey: 'authorId', foreignKey: 'id' },
    comments: { type: 'many', table: comment, schema: CommentListItem, localKey: 'id', foreignKey: 'postId' },
  },
  lifecycle: {
    beforeCreate: (values) => { values.extra = 'computed'; },
    afterCreate: (created) => { log('created', created.id); },
  },
});
```

### Features

| Config | Description |
|---|---|
| `model` | Drizzle table definition |
| `schema` | TypeBox schemas for params, body, response |
| `auth` | Array of operations requiring auth: `'index' \| 'show' \| 'store' \| 'update' \| 'destroy'` |
| `ownership` | Field-based ownership check (author only + admin override) |
| `visibility` | Role-based row visibility (guest→published, user→publishedOrOwn, admin→all) |
| `filters` | Query string filter definitions with operator prefix support |
| `sortable` | Sort whitelist with `-field` descending syntax |
| `pagination` | Enable offset pagination (`?page=1&limit=20`) |
| `joins` | LEFT JOIN config for filtering/sorting across relations |
| `slug` | Auto-slug generation from a source field |
| `softDelete` | Soft delete with `deletedAt` field, filtered from index/show |
| `searchable` | Full-text search across columns (`?search=term`) |
| `includeMap` | Eager-load related resources (`?include=author,comments`) |
| `lifecycle` | Hooks: `beforeCreate`, `afterCreate`, `beforeUpdate`, `afterUpdate`, `beforeDelete`, `afterDelete` |

### Generated Endpoints

| Method | Path | Operation |
|---|---|---|
| `GET` | `/` | Index (list) — with pagination, filters, sort, includes |
| `GET` | `/:id` | Show — single resource |
| `POST` | `/` | Store — create |
| `PUT` | `/:id` | Update |
| `DELETE` | `/:id` | Destroy — soft or hard delete |

### Query String

| Param | Example | Description |
|---|---|---|
| `page` | `?page=2` | Page number |
| `limit` | `?limit=10` | Items per page (max 100) |
| `sort` | `?sort=-createdAt` | Sort field (prefix `-` for descending) |
| `?field=value` | `?published=true` | Direct filter |
| `?relation.field=value` | `?author.name=like:john` | Relation filter with operator |
| `search` | `?search=fastify` | Full-text search across searchable columns |
| `include` | `?include=author,comments` | Eager-load related resources |

Operator prefix syntax for filters: `?field=gt:2024-01-01`, `?field=like:%term%`.

### Nested Resources

Resources under a parent scope (e.g. `/posts/:postId/comments`) use `parentScope` config:

```typescript
parentScope: {
  paramField: 'postId',
  column: 'postId',
  parentModel: post,
  parentResource: 'Post',
},
```

## Auth

Better Auth handles sign-up, sign-in, and session management. The `getSession` decorator performs a DB lookup for bearer tokens (not cookie-based).

| PreHandler | Effect |
|---|---|
| `fastify.requireAuth` | Rejects with 401 if no valid session |
| `fastify.requireAdmin` | Rejects with 403 if not admin |

```
POST /api/auth/sign-up/email    { email, password, name }
POST /api/auth/sign-in/email    { email, password }
POST /api/auth/sign-out
```

Users have a `role` column (`user` | `admin`).

## Scaffold Generator

Generate a full CRUD resource with one command:

```bash
bun run gen
```

Prompts for resource name, fields, and options — creates Drizzle schema, TypeBox schemas, route config, updates barrel export. Uses Handlebars templates in `apps/cli/templates/`.

## Docker

```bash
docker compose up --build
```

Starts the API on port 3000 with SQLite data persisted in a Docker volume. Configure via environment variables in `.env` or `docker-compose.yml`.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `BETTER_AUTH_SECRET` | — | Secret for auth tokens (min 32 chars) |
| `BETTER_AUTH_URL` | `http://localhost:3000` | Public URL of the API |
| `DATABASE_URL` | `file:./data.db` | libsql connection string |
| `PORT` | `3000` | HTTP port |
| `HOST` | `0.0.0.0` | HTTP host |
| `RATE_LIMIT_MAX` | `100` | Max requests per window |
| `RATE_LIMIT_WINDOW` | `60000` | Rate limit window in ms |

## Extending

To add a new resource:

1. **CLI**: `bun run gen` — interactive scaffold
2. **Manual**: Create `db/schema/{name}.ts`, export from barrel, create `routes/{name}/{index,schemas}.ts`
3. Run `bun run db:generate` to create the migration

To add a new auth provider (GitHub OAuth, etc.), add to the `betterAuth()` config in `plugins/auth.ts`.

## License

MIT
