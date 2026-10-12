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

/** PATCH /api/auth/profile: никнейм и/или аватар (URL изображения). */
export const profileUpdateSchema = z
  .object({
    displayName: z.string().trim().min(1).max(50).optional(),
    avatarUrl: z
      .string()
      .trim()
      .max(500)
      .refine((v) => v === '' || v.startsWith('https://') || v.startsWith('http://'), {
        message: 'avatarUrl must be an http(s) URL',
      })
      .optional(),
  })
  .refine((v) => v.displayName !== undefined || v.avatarUrl !== undefined, {
    message: 'At least one field is required',
  });

/** POST /api/auth/password: смена пароля с подтверждением текущим. */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(128),
  newPassword: passwordSchema,
});

/** POST /api/auth/totp/disable: отключение 2FA с подтверждением паролем. */
export const totpDisableSchema = z.object({
  password: z.string().min(1, 'Password is required').max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type TotpVerifyInput = z.infer<typeof totpVerifySchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type TotpDisableInput = z.infer<typeof totpDisableSchema>;

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
