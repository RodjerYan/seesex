import 'dotenv/config';
import { z } from 'zod';

/** Пустую строку из .env трактуем как «переменная не задана». */
const emptyToUndefined = (value: unknown): unknown => (value === '' ? undefined : value);

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Порт по умолчанию 3001 (PORT из env имеет приоритет).
  PORT: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(65535).default(3001)),
  // Обязательные секреты/подключение — при отсутствии падаем с понятной ошибкой.
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  // Для S3 (шифрование чувствительных данных) — опциональна в S2.
  ENCRYPTION_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  FRONTEND_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  ALLOWED_ORIGINS: z.preprocess(emptyToUndefined, z.string().optional()),
  // Общий rate-limit.
  RATE_LIMIT_WINDOW_MS: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().default(60_000),
  ),
  RATE_LIMIT_MAX: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().default(100)),
  // Жёсткий лимит на /api/auth/login и /api/auth/register: 10 запросов / 15 мин / IP.
  AUTH_RATE_LIMIT_WINDOW_MS: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number()
      .int()
      .positive()
      .default(15 * 60 * 1000),
  ),
  AUTH_RATE_LIMIT_MAX: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().default(10),
  ),
  LOG_LEVEL: z.preprocess(
    emptyToUndefined,
    z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('info'),
  ),
  // Загрузка фото (S3): каталог относительно apps/api, лимит файла, макс. фото на партнера.
  UPLOAD_DIR: z.preprocess(emptyToUndefined, z.string().min(1).default('./uploads')),
  MAX_FILE_SIZE: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().default(5 * 1024 * 1024),
  ),
  MAX_PHOTOS_PER_PARTNER: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().default(3),
  ),
});

export type Env = z.infer<typeof EnvSchema>;

function loadConfig(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (parsed.success) return parsed.data;

  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  throw new Error(
    `Invalid environment configuration:\n${issues}\n` +
      'Set the missing variables in apps/api/.env (see apps/api/.env.example).',
  );
}

export const config: Env = loadConfig();

/** Секунды жизни access JWT (для поля expiresIn в ответах). */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
/** Время жизни refresh-токена и сессии: 7 дней (мс). */
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
