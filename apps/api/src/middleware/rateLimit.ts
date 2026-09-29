import type { Request, Response } from 'express';
import { rateLimit, type RateLimitRequestHandler } from 'express-rate-limit';
import { config } from '../lib/config';

function limitedHandler(message: string) {
  return (_req: Request, res: Response) => {
    res.status(429).json({ error: { code: 'RATE_LIMITED', message } });
  };
}

/** Общий лимит: RATE_LIMIT_MAX запросов за RATE_LIMIT_WINDOW_MS на IP. */
export const generalLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  limit: config.RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: limitedHandler('Too many requests, please try again later.'),
});

/**
 * Жёсткий лимит на POST /api/auth/login и POST /api/auth/register:
 * 10 попыток / 15 минут / IP (переопределяется env AUTH_RATE_LIMIT_MAX / AUTH_RATE_LIMIT_WINDOW_MS).
 */
export const authLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: config.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: config.AUTH_RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: limitedHandler('Too many authentication attempts, please try again later.'),
});
