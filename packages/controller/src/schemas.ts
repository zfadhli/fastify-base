import type { FastifyRequest } from 'fastify';
import Type from 'typebox';
import { ErrorResponseSchema } from './errors';
import type { SessionUser } from './types';

export const E = {
  _401: ErrorResponseSchema,
  _403: ErrorResponseSchema,
  _404: ErrorResponseSchema,
};

export const S = {
  bearer: [{ bearerAuth: [] }],
};

export const PaginationMeta = Type.Object({
  page: Type.Number(),
  limit: Type.Number(),
  total: Type.Number(),
  totalPages: Type.Number(),
});

export const CursorMeta = Type.Object({
  cursor: Type.Optional(Type.String()),
  limit: Type.Number(),
  hasMore: Type.Boolean(),
});

export function getUser(request: FastifyRequest): SessionUser {
  return request.user as SessionUser;
}
