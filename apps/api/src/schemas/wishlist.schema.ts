import { z } from 'zod';
import { idParamSchema } from './common';

export const createWishlistSchema = z
  .object({
    positionId: idParamSchema.optional(),
    customName: z.string().trim().min(1).max(120).optional(),
    customCategory: z.string().trim().min(1).max(60).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.positionId && !value.customName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Either positionId or customName is required',
        path: ['positionId'],
      });
    }
  });

/** PUT /api/wishlist/:id/complete — по умолчанию отмечает выполненным. */
export const completeWishlistSchema = z.object({
  completed: z.boolean().default(true),
});

export const wishlistIdParamSchema = z.object({ id: idParamSchema });

export type CreateWishlistInput = z.infer<typeof createWishlistSchema>;
export type CompleteWishlistInput = z.infer<typeof completeWishlistSchema>;
