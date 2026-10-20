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
  // Локальный SQLite-файл (prod: boot.ts подставляет путь сам).
  SQLITE_PATH: z.preprocess(emptyToUndefined, z.string().optional()),
  // Google Drive (OAuth пользователя): файл БД живёт в его папке.
  GOOGLE_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  GOOGLE_CLIENT_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  GOOGLE_REFRESH_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
  GOOGLE_DRIVE_FOLDER_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  DRIVE_SYNC_INTERVAL_MS: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().default(60_000),
  ),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  // Для S3 (шифрование чувствительных данных) — опциональна в S2.
  ENCRYPTION_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  FRONTEND_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  ALLOWED_ORIGINS: z.preprocess(emptyToUndefined, z.string().optional()),
  // Общий rate-limit (дефолты = фактическое прод-поведение: 1000 запросов / 15 мин / IP).
  RATE_LIMIT_WINDOW_MS: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().default(15 * 60 * 1000),
  ),
  RATE_LIMIT_MAX: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().default(1000)),
  // Жёсткий лимит на /api/auth/login и /api/auth/register: 30 запросов / 15 мин / IP.
  AUTH_RATE_LIMIT_WINDOW_MS: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().default(15 * 60 * 1000),
  ),
  AUTH_RATE_LIMIT_MAX: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().default(30)),
  LOG_LEVEL: z.preprocess(
    emptyToUndefined,
    z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('info'),
  ),
});

export type Env = z.infer<typeof EnvSchema>;

function loadConfig(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Invalid environment configuration:\n${issues}\n` +
        'Set the missing variables in apps/api/.env (see apps/api/.env.example).',
    );
  }

  // Fail-fast в production: без ENCRYPTION_KEY чувствительные поля (Event.notes)
  // лежали бы открытым текстом. В dev/test оставляем plaintext-fallback (crypto.ts).
  if (parsed.data.NODE_ENV === 'production' && !parsed.data.ENCRYPTION_KEY) {
    throw new Error(
      'ENCRYPTION_KEY is required in production: set a 32+ char secret ' +
        '(e.g. openssl rand -base64 32) so sensitive fields stay encrypted.',
    );
  }

  return parsed.data;
}

export const config: Env = loadConfig();

/** Секунды жизни access JWT (для поля expiresIn в ответах). */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
/** Время жизни refresh-токена и сессии: 7 дней (мс). */
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
