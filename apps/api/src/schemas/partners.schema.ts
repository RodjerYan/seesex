import { z } from 'zod';
import { idParamSchema } from './common';

/**
 * customFields — произвольный JSON-объект (Prisma Json).
 * Принимаем только объект; на выходе возвращаем как объект.
 */
export const customFieldsSchema = z.record(
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(z.unknown()),
    z.record(z.unknown()),
  ]),
);

const partnerBodyBase = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  nickname: z.string().trim().max(120).nullable().optional(),
  gender: z.string().trim().max(60).nullable().optional(),
  sexualOrientation: z.string().trim().max(60).nullable().optional(),
  pronouns: z.string().trim().max(60).nullable().optional(),
  relationshipStatus: z.string().trim().max(60).nullable().optional(),
  isPrimary: z.boolean().optional(),
  customFields: customFieldsSchema.nullable().optional(),
});

export const createPartnerSchema = partnerBodyBase;
export const updatePartnerSchema = partnerBodyBase.partial();

export const partnerIdParamSchema = z.object({ id: idParamSchema });

export type CreatePartnerInput = z.infer<typeof createPartnerSchema>;
export type UpdatePartnerInput = z.infer<typeof updatePartnerSchema>;
