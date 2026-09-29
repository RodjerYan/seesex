import { z } from 'zod';

/** DELETE /api/settings/data — GDPR-очистка требует явного подтверждения. */
export const deleteDataSchema = z.object({
  confirm: z.literal('DELETE', {
    errorMap: () => ({ message: 'Body must be { "confirm": "DELETE" }' }),
  }),
});

export type DeleteDataInput = z.infer<typeof deleteDataSchema>;
