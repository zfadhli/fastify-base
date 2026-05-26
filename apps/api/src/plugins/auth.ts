import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth';
import { eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { getDb } from '@/db/index.js';
import * as authSchema from '@/db/schema/auth.js';
import { getEnv } from '@/lib/env.js';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  image: string | null;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

function unauthorized(reply: FastifyReply) {
  return reply.status(401).send({
    error: 'UNAUTHORIZED',
    message: 'Authentication required',
    statusCode: 401,
  });
}

function forbidden(reply: FastifyReply) {
  return reply.status(403).send({
    error: 'FORBIDDEN',
    message: 'Admin access required',
    statusCode: 403,
  });
}

export default fp(async (fastify: FastifyInstance) => {
  const env = getEnv();
  const db = getDb();

  const auth = betterAuth({
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: {
        user: authSchema.user,
        session: authSchema.session,
        account: authSchema.account,
        verification: authSchema.verification,
      },
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    emailAndPassword: {
      enabled: true,
    },
    user: {
      additionalFields: {
        role: {
          type: 'string',
          required: true,
          defaultValue: 'user',
        },
      },
    },
  });

  fastify.decorate('auth', auth as unknown as AuthInstance);

  function extractBearerToken(headers: Record<string, string | string[] | undefined>): string | null {
    const authHeader = headers.authorization ?? headers.Authorization;
    if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) return null;
    return authHeader.slice(7);
  }

  async function getSession(headers: Record<string, string | string[] | undefined>) {
    const token = extractBearerToken(headers);
    if (!token) return null;

    const [found] = await db.select().from(authSchema.session).where(eq(authSchema.session.token, token)).limit(1);

    if (!found) return null;
    if (found.expiresAt < Math.floor(Date.now() / 1000)) return null;

    const [user] = await db.select().from(authSchema.user).where(eq(authSchema.user.id, found.userId)).limit(1);

    if (!user) return null;

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        image: user.image,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      } satisfies SessionUser,
    };
  }

  async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
    const session = await getSession(request.headers);
    if (!session) return unauthorized(reply);
    request.user = session.user;
  }

  async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
    const session = await getSession(request.headers);
    if (!session) return unauthorized(reply);
    if (session.user.role !== 'admin') return forbidden(reply);
    request.user = session.user;
  }

  fastify.decorate('getSession', getSession);
  fastify.decorate('requireAuth', requireAuth);
  fastify.decorate('requireAdmin', requireAdmin);

  fastify.all('/api/auth/*', { schema: { hide: true } }, async (request, reply) => {
    const protocol = request.protocol;
    const host = request.headers.host ?? 'localhost:3000';
    const url = new URL(request.url, `${protocol}://${host}`);

    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (value) {
        if (Array.isArray(value)) {
          for (const v of value) headers.append(key, v);
        } else {
          headers.set(key, value);
        }
      }
    }

    let body: BodyInit | undefined;
    if (request.body && request.method !== 'GET' && request.method !== 'HEAD') {
      body = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
    }

    const req = new Request(url.toString(), {
      method: request.method,
      headers,
      body,
    });

    try {
      const res = await auth.handler(req);

      reply.status(res.status);
      res.headers.forEach((value, key) => {
        reply.header(key, value);
      });

      const text = await res.text();
      try {
        reply.send(JSON.parse(text));
      } catch {
        reply.send(text);
      }
    } catch (err) {
      reply.status(500).send({
        error: 'AUTH_ERROR',
        message: 'Authentication handler error',
        statusCode: 500,
      });
    }
  });
});

interface AuthInstance {
  handler: (req: Request) => Promise<Response>;
  api: {
    getSession: (opts: { headers: Record<string, string> }) => Promise<{ user: Record<string, unknown> } | null>;
  };
}

declare module 'fastify' {
  interface FastifyInstance {
    auth: AuthInstance;
    getSession: (headers: Record<string, string | string[] | undefined>) => Promise<{ user: SessionUser } | null>;
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user?: SessionUser;
  }
}
