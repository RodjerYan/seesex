import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';
import { config } from '../lib/config';
import { logger } from '../lib/winston';

/** Единый формат ошибки API: { error: { code, message, details? } }. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(code: string, message: string, details?: unknown): ApiError {
    return new ApiError(400, code, message, details);
  }

  static unauthorized(code = 'UNAUTHORIZED', message = 'Authentication required'): ApiError {
    return new ApiError(401, code, message);
  }

  static forbidden(code = 'FORBIDDEN', message = 'Forbidden'): ApiError {
    return new ApiError(403, code, message);
  }

  static notFound(code = 'NOT_FOUND', message = 'Resource not found'): ApiError {
    return new ApiError(404, code, message);
  }

  static conflict(code: string, message: string): ApiError {
    return new ApiError(409, code, message);
  }
}

/** Асинхронный хендлер: пробрасывает rejected-промисы в error-handler. */
export type AsyncHandler<Req extends Request = Request> = (
  req: Req,
  res: Response,
  next: NextFunction,
) => Promise<void> | void;

export function asyncHandler<Req extends Request = Request>(fn: AsyncHandler<Req>): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(fn(req as unknown as Req, res, next)).catch(next);
  };
}

function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 'P2002'
  );
}

function isBodyParseError(err: unknown): err is SyntaxError & { type?: string } {
  return err instanceof SyntaxError && 'body' in err;
}

/** 404 для неизвестных маршрутов (пробрасывается как ApiError). */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(ApiError.notFound('ROUTE_NOT_FOUND', `Route ${req.method} ${req.path} not found`));
};

/** Общий error-handler. В production не отдаём stacktrace клиенту. */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (res.headersSent) {
    return;
  }

  let apiError: ApiError;
  if (err instanceof ApiError) {
    apiError = err;
    logger.warn(`${req.method} ${req.originalUrl} -> ${apiError.status} ${apiError.code}`);
  } else if (err instanceof ZodError) {
    apiError = ApiError.badRequest('VALIDATION_ERROR', 'Request validation failed', err.issues);
    logger.warn(`${req.method} ${req.originalUrl} -> 400 VALIDATION_ERROR`);
  } else if (isUniqueConstraintError(err)) {
    apiError = ApiError.conflict('CONFLICT', 'Resource already exists');
    logger.warn(`${req.method} ${req.originalUrl} -> 409 CONFLICT`);
  } else if (isBodyParseError(err)) {
    apiError = ApiError.badRequest('BAD_JSON', 'Malformed JSON body');
    logger.error(`Malformed JSON body on ${req.method} ${req.originalUrl}`);
  } else {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const stack = err instanceof Error ? err.stack : undefined;
    logger.error(`Unhandled error on ${req.method} ${req.originalUrl}: ${message}`, { stack });
    apiError = new ApiError(500, 'INTERNAL_ERROR', 'Internal server error');
  }

  const isProd = config.NODE_ENV === 'production';
  const body: Record<string, unknown> = {
    error: {
      code: apiError.code,
      message: apiError.message,
    },
  };
  const errorBody = body.error as Record<string, unknown>;
  if (apiError.details !== undefined && !isProd) {
    errorBody.details = apiError.details;
  }
  if (!isProd && err instanceof Error && err.stack && !(err instanceof ApiError)) {
    errorBody.stack = err.stack;
  }

  res.status(apiError.status).json(body);
};
