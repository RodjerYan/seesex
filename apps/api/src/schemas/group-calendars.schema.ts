import { z } from 'zod';
import { idParamSchema } from './common';
import { createEventSchema } from './events.schema';

export const createGroupCalendarSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
});

export const joinByCodeSchema = z.object({
  inviteCode: z.string().trim().min(4).max(32),
});

export const groupIdParamSchema = z.object({ id: idParamSchema });

/**
 * POST /api/group-calendars/:id/events — то же тело, что и создание события;
 * groupCalendarId берётся из params.
 */
export const createGroupEventSchema = createEventSchema;

export type CreateGroupCalendarInput = z.infer<typeof createGroupCalendarSchema>;
export type JoinByCodeInput = z.infer<typeof joinByCodeSchema>;
