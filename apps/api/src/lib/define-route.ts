import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type {
  FastifyBaseLogger,
  FastifyInstance,
  FastifyRequest,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
} from 'fastify';
import { getDb } from '@/db/index.js';
import type { SessionUser } from '@/plugins/auth.js';
import { AppError, ErrorResponseSchema } from './errors.js';

export { AppError };

type TypedFastify = FastifyInstance<
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

export function getUser(request: FastifyRequest): SessionUser {
  return request.user!;
}

export function defineRoute(
  cb: (ctx: { f: TypedFastify; db: ReturnType<typeof getDb>; fastify: FastifyInstance }) => void,
) {
  return async (fastify: FastifyInstance) => {
    const f = fastify.withTypeProvider<TypeBoxTypeProvider>();
    const db = getDb();
    return cb({ f, db, fastify });
  };
}
