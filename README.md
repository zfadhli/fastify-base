# fastify-base

Production-ready Fastify + TypeScript template with a complete blog API example. Batteries included, zero config ceremony.

## Stack

| Layer | Choice |
|---|---|
| Runtime | Bun 1.3+ |
| Framework | Fastify 5.8 |
| Validation | TypeBox 0.34 + TypeBox TypeProvider |
| Database | libsql (SQLite / Turso-compatible) |
| ORM | Drizzle ORM 0.45 |
| Auth | Better Auth 1.6 (email+password, JWT-ready) |
| Docs | Scalar API Reference (OpenAPI 3.1) |
| Language | TypeScript 6.0, strict mode |

## Project Structure

```
apps/api/
├── src/
│   ├── index.ts              # entry point
│   ├── app.ts                # Fastify factory (autoload)
│   ├── lib/
│   │   ├── env.ts            # TypeBox-validated env
│   │   ├── errors.ts         # typed AppError + handler
│   │   └── nanoid.ts         # crypto nanoid
│   ├── db/
│   │   ├── schema/auth.ts    # better-auth 4 tables
│   │   ├── schema/posts.ts   # blog posts
│   │   └── index.ts          # drizzle client
│   ├── plugins/
│   │   ├── auth.ts           # better-auth init, hooks, proxy
│   │   └── scalar.ts         # Swagger + Scalar UI
│   └── routes/
│       ├── posts/index.ts    # CRUD + schemas inline
│       └── users/index.ts    # profile + posts
```

Architecture principle: **plugin** for infrastructure (auth, docs), **routes** for business logic with inline TypeBox schemas. No external schema files needed.

## Quick Start

```bash
cp .env.example apps/api/.env
bun install
bun run db:migrate
bun dev
```

Server starts at `http://localhost:3000`. API docs at `/docs`.

## Scripts

| Command | Action |
|---|---|
| `bun dev` | Start with file watching |
| `bun run typecheck` | TypeScript check |
| `bun run db:generate` | Generate Drizzle migrations |
| `bun run db:migrate` | Apply migrations |
| `bun run db:studio` | Drizzle Studio GUI |
| `bun run build` | Compile to `dist/` |

## Auth

Better Auth handles sign-up, sign-in, and session management. Tokens are opaque session tokens returned as `token` in the response. Use as `Authorization: Bearer <token>`.

Two preHandler hooks on the Fastify instance:

```
fastify.requireAuth    — rejects with 401 if no valid session
fastify.requireAdmin   — rejects with 403 if not admin
```

Users have a `role` field (`user` | `admin`).

## API

### Auth (proxied to better-auth)

```
POST /api/auth/sign-up/email    { email, password, name }
POST /api/auth/sign-in/email    { email, password }
POST /api/auth/sign-out
```

### Posts

```
GET    /api/posts           # list published (public) / all (admin)
GET    /api/posts/:id       # get one
POST   /api/posts           # create (auth)
PUT    /api/posts/:id       # update (author/admin)
DELETE /api/posts/:id       # delete (author/admin)
```

### Users

```
GET /api/users/:id            # profile (public)
GET /api/users/:id/posts      # published (public) / all (user own, admin)
```

## Authorization Matrix

| Action | Public | Auth'd user | Admin |
|---|---|---|---|
| List published posts | ✅ | ✅ | ✅ |
| List own drafts | ❌ | ✅ | ✅ |
| Read post | published only | own drafts | ✅ |
| Create post | ❌ | ✅ | ✅ |
| Update post | ❌ | own only | ✅ |
| Delete post | ❌ | own only | ✅ |
| View user | ✅ | ✅ | ✅ |

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `file:./data.db` | libsql connection string |
| `BETTER_AUTH_SECRET` | — | Secret for auth tokens (min 32 chars) |
| `BETTER_AUTH_URL` | `http://localhost:3000` | Public URL of the API |
| `PORT` | `3000` | HTTP port |
| `HOST` | `0.0.0.0` | HTTP host |

## Extending

To add a new resource (e.g. `comments`):

1. Create `db/schema/comments.ts` with Drizzle table definition
2. Run `bun run db:generate` to create the migration
3. Create `routes/comments/index.ts` with inline TypeBox schemas
4. Autoload picks it up automatically

To add a new auth provider (e.g. GitHub OAuth), add to the `betterAuth()` config in `plugins/auth.ts`. Better Auth handles the rest.

## License

MIT
