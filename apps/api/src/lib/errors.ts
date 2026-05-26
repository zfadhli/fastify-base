import type { FastifyInstance } from 'fastify';
import Type from 'typebox';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const ErrorResponseSchema = Type.Object({
  error: Type.String(),
  message: Type.String(),
  statusCode: Type.Number(),
});

export function setupErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: error.code,
        message: error.message,
        statusCode: error.statusCode,
      });
    }

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
      error: 'INTERNAL_ERROR',
      message: statusCode === 500 ? 'Internal server error' : String(err.message ?? 'Unknown error'),
      statusCode,
    });
  });
}
