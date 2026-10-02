import { z } from 'zod';
import { idParamSchema, nullableInt, paginationSchema } from './common';

/** Фильтры GET /api/events. */
export const listEventsQuerySchema = paginationSchema.extend({
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  partnerId: idParamSchema.optional(),
  eventType: z.string().trim().min(1).max(64).optional(),
  eventTypes: z.string().trim().min(1).max(200).optional(),
  groupCalendarId: idParamSchema.optional(),
});

const idsArray = z.array(idParamSchema).max(50);

const eventBodyBase = z.object({
  title: z.string().trim().max(200).optional(),
  eventType: z.string().trim().min(1).max(64).default('SEX'),
  eventTypes: z.array(z.string().trim().min(1).max(64)).min(1).max(20).optional(),
  isCustomType: z.boolean().default(false),
  date: z.coerce.date(),
  duration: nullableInt(0, 43_200),
  rating: nullableInt(1, 5),
  notes: z.string().max(20_000).nullable().optional(),
  calories: nullableInt(0, 100_000),
  heartRate: nullableInt(0, 400),
  initiatedBy: z.string().trim().max(100).nullable().optional(),
  groupCalendarId: idParamSchema.nullable().optional(),
  partnerIds: idsArray.default([]),
  moodIds: idsArray.default([]),
  placeIds: idsArray.default([]),
  accessoryIds: idsArray.default([]),
});

export const createEventSchema = eventBodyBase;
export const updateEventSchema = eventBodyBase.partial();

export const eventIdParamSchema = z.object({ id: idParamSchema });

/** GET /api/events/calendar?from&to (по умолчанию — год назад/вперёд). */
export const calendarQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const uploadCaptionSchema = z.object({
  caption: z.string().trim().max(500).optional(),
});

export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type CalendarQuery = z.infer<typeof calendarQuerySchema>;
