import type { Response } from 'express';
import type { AuthedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { parseInput } from '../schemas/common';
import {
  completeWishlistSchema,
  createWishlistSchema,
  wishlistIdParamSchema,
} from '../schemas/wishlist.schema';
import * as wishlistService from '../services/wishlist.service';

export const list = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  res.status(200).json({ entries: await wishlistService.listWishlist(req.user.id) });
});

export const create = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  const input = parseInput(createWishlistSchema, req.body);
  res.status(201).json({ entry: await wishlistService.createWishlistEntry(req.user.id, input) });
});

/** PUT /api/wishlist/:id/complete — body {completed?} (по умолчанию true). */
export const complete = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  const { id } = parseInput(wishlistIdParamSchema, req.params);
  const input = parseInput(completeWishlistSchema, req.body);
  res
    .status(200)
    .json({ entry: await wishlistService.completeWishlistEntry(req.user.id, id, input) });
});

export const remove = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  const { id } = parseInput(wishlistIdParamSchema, req.params);
  await wishlistService.deleteWishlistEntry(req.user.id, id);
  res.status(204).end();
});
