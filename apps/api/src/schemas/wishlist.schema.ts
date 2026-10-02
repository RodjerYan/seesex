import { z } from 'zod';
import { idParamSchema } from './common';

export const createWishlistSchema = z.object({
  customName: z.string().trim().min(1).max(120),
  customCategory: z.string().trim().min(1).max(60).optional(),
});

/** PUT /api/wishlist/:id/complete — по умолчанию отмечает выполненным. */
export const completeWishlistSchema = z.object({
  completed: z.boolean().default(true),
});

export const wishlistIdParamSchema = z.object({ id: idParamSchema });

export type CreateWishlistInput = z.infer<typeof createWishlistSchema>;
export type CompleteWishlistInput = z.infer<typeof completeWishlistSchema>;
