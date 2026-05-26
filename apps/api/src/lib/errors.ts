import type { FastifyInstance } from 'fastify';
import Type from 'typebox';

const ERROR_NAMES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'TOO_MANY_REQUESTS',
};

export const ErrorResponseSchema = Type.Object({
  error: Type.String(),
  message: Type.String(),
  statusCode: Type.Number(),
});

export function setupErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    const err = error as Record<string, unknown>;

    if (err.validation) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: String(err.message ?? 'Validation failed'),
        statusCode: 400,
      });
    }

    request.log.error(error, 'Unhandled error');
    const statusCode = typeof err.statusCode === 'number' ? err.statusCode : 500;
    reply.status(statusCode).send({
      error: ERROR_NAMES[statusCode] ?? 'INTERNAL_ERROR',
      message: statusCode === 500 ? 'Internal server error' : String(err.message ?? 'Unknown error'),
      statusCode,
    });
  });
}
