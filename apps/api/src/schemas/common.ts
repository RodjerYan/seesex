import { z } from 'zod';
import { ApiError } from '../middleware/error';

/** Валидация входа (body/query); ZodError маппится в 400 VALIDATION_ERROR. */
export function parseInput<S extends z.ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw ApiError.badRequest(
      'VALIDATION_ERROR',
      'Request validation failed',
      result.error.flatten().fieldErrors,
    );
  }
  return result.data;
}

/** id из params: не-пустая строка (невалидный id уходит в 404, не в 400). */
export const idParamSchema = z.string().trim().min(1).max(64);

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/** Числовое nullable-поле в диапазоне (для body событий). */
export function nullableInt(min: number, max: number) {
  return z.number().int().min(min).max(max).nullable().optional();
}

/** GET /api/files?path=… — относительный путь файла внутри UPLOAD_DIR. */
export const fileQuerySchema = z.object({
  path: z.string().trim().min(1).max(512),
});
