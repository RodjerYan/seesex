import type { Request, Response } from 'express';
import { rateLimit, type RateLimitRequestHandler } from 'express-rate-limit';
import { config } from '../lib/config';

function limitedHandler(message: string) {
  return (_req: Request, res: Response) => {
    res.status(429).json({ error: { code: 'RATE_LIMITED', message } });
  };
}

/** Общий лимит: 1000 запросов за 15 минут на IP. */
export const generalLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: limitedHandler('Too many requests, please try again later.'),
});

/**
 * Жёсткий лимит на /api/auth (login, register, refresh): ~30 запросов / 15 минут / IP.
 * Защита от brute-force.
 */
export const authLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: limitedHandler('Too many authentication attempts, please try again later.'),
});
