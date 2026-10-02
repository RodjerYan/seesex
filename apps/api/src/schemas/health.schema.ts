import { z } from 'zod';
import { idParamSchema } from './common';

/**
 * POST /api/health/apple — проба Apple Health от шортката (авторизация device-token).
 * samples: heartRate (уд/мин) и activeEnergy (ккал), окно = [start, end].
 */
const sampleSchema = z
  .object({
    type: z.enum(['heartRate', 'activeEnergy']),
    // refine: z.coerce.date() иначе пропускает Invalid Date (NaN) → падение в Prisma (500 вместо 400)
    start: z.coerce.date().refine((d) => !Number.isNaN(d.getTime()), 'Invalid date'),
    end: z.coerce.date().refine((d) => !Number.isNaN(d.getTime()), 'Invalid date'),
    value: z.number().finite().min(0).max(100_000),
  })
  .superRefine((sample, ctx) => {
    if (sample.end.getTime() < sample.start.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['end'],
        message: 'end must be >= start',
      });
    }
  });

export const appleIngestSchema = z.object({
  eventId: idParamSchema,
  samples: z.array(sampleSchema).min(1).max(500),
});

/** POST /api/health/token (JWT): управление device-токенами. */
export const tokenActionSchema = z.object({
  action: z.enum(['create', 'revoke']),
});

export type AppleSample = z.infer<typeof sampleSchema>;
export type AppleIngestInput = z.infer<typeof appleIngestSchema>;
export type TokenActionInput = z.infer<typeof tokenActionSchema>;
