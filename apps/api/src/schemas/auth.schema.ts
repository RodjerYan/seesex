import { z } from 'zod';
import { ApiError } from '../middleware/error';

export const emailSchema = z
  .string()
  .trim()
  .min(3, 'Email is required')
  .max(254, 'Email is too long')
  .email('Invalid email')
  .toLowerCase();

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long');

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(128),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken is required').max(4096),
});

export const logoutSchema = refreshSchema;

export const totpVerifySchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
  /** Для flow «включить 2FA»: токен из POST /api/auth/totp/setup. */
  setupToken: z.string().min(1).max(4096).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type TotpVerifyInput = z.infer<typeof totpVerifySchema>;

/** Валидация тела запроса; ZodError маппится в 400 ApiError. */
export function parseBody<S extends z.ZodTypeAny>(schema: S, body: unknown): z.infer<S> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw ApiError.badRequest(
      'VALIDATION_ERROR',
      'Request validation failed',
      result.error.flatten().fieldErrors,
    );
  }
  return result.data;
}
