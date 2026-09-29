import { z } from 'zod';
import { idParamSchema, paginationSchema } from './common';

const positionBodyBase = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  category: z.string().trim().min(1).max(60).default('STANDARD'),
  iconName: z.string().trim().max(60).nullable().optional(),
});

export const createPositionSchema = positionBodyBase;
export const updatePositionSchema = positionBodyBase.partial();

/** GET /api/positions и GET /api/positions/system. */
export const listPositionsQuerySchema = z.object({
  category: z.string().trim().min(1).max(60).optional(),
});

export const systemPositionsQuerySchema = paginationSchema.extend({
  category: z.string().trim().min(1).max(60).optional(),
});

export const positionIdParamSchema = z.object({ id: idParamSchema });

export type CreatePositionInput = z.infer<typeof createPositionSchema>;
export type UpdatePositionInput = z.infer<typeof updatePositionSchema>;
export type SystemPositionsQuery = z.infer<typeof systemPositionsQuerySchema>;
