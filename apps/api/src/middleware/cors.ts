import cors, { type CorsOptions } from 'cors';
import { config } from '../lib/config';

/** Строгий whitelist: ALLOWED_ORIGINS (через запятую) + FRONTEND_URL. */
export function getAllowedOrigins(): string[] {
  const fromEnv = [
    ...(config.ALLOWED_ORIGINS ?? '').split(','),
    ...(config.FRONTEND_URL ? [config.FRONTEND_URL] : []),
  ];
  return [...new Set(fromEnv.map((origin) => origin.trim()).filter((origin) => origin.length > 0))];
}

const allowedOrigins = new Set(getAllowedOrigins());

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // Без Origin (curl, серверные вызовы) — пропускаем; браузерные запросы — только из whitelist.
    if (!origin) {
      callback(null, true);
      return;
    }
    callback(null, allowedOrigins.has(origin));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
  credentials: false,
  maxAge: 600,
};

export const corsMiddleware = cors(corsOptions);
