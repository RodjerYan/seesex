import type { Request, Response } from 'express';
import { rateLimit, type RateLimitRequestHandler } from 'express-rate-limit';
import { config } from '../lib/config';

function limitedHandler(message: string) {
  return (_req: Request, res: Response) => {
    res.status(429).json({ error: { code: 'RATE_LIMITED', message } });
  };
}

/** Общий лимит: config.RATE_LIMIT_MAX запросов за config.RATE_LIMIT_WINDOW_MS на IP. */
export const generalLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  limit: config.RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: limitedHandler('Too many requests, please try again later.'),
});

/**
 * Жёсткий лимит на /api/auth (login, register, refresh): config.AUTH_RATE_LIMIT_MAX
 * запросов / config.AUTH_RATE_LIMIT_WINDOW_MS / IP. Защита от brute-force.
 */
export const authLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: config.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: config.AUTH_RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: limitedHandler('Too many authentication attempts, please try again later.'),
});
