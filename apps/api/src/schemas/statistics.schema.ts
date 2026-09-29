import { z } from 'zod';

/** GET /api/statistics/frequency — опциональный диапазон дат. */
export const frequencyQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

/**
 * GET /api/statistics/custom — from/to + groupIds (id групповых календарей,
 * через запятую или повторением параметра).
 */
const csvIds = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    const list = Array.isArray(value) ? value : [value];
    return list
      .flatMap((item) => item.split(','))
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  });

export const customStatsQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  groupIds: csvIds,
});

export type FrequencyQuery = z.infer<typeof frequencyQuerySchema>;
export type CustomStatsQuery = z.infer<typeof customStatsQuerySchema>;
