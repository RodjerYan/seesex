import type { Response } from 'express';
import type { AuthedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { parseInput } from '../schemas/common';
import {
  calendarQuerySchema,
  createEventSchema,
  eventIdParamSchema,
  listEventsQuerySchema,
  updateEventSchema,
} from '../schemas/events.schema';
import * as eventsService from '../services/events.service';

/** GET /api/events — список с фильтрами dateFrom/dateTo/partnerId/eventType/groupCalendarId. */
export const list = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  const query = parseInput(listEventsQuerySchema, req.query);
  res.status(200).json(await eventsService.listEvents(req.user.id, query));
});

/** GET /api/events/calendar?from&to — дни с 3 статусами (occurred/planned/turndown). */
export const calendar = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  const { from, to } = parseInput(calendarQuerySchema, req.query);
  res.status(200).json(await eventsService.calendar(req.user.id, from, to));
});

export const get = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  const { id } = parseInput(eventIdParamSchema, req.params);
  res.status(200).json({ event: await eventsService.getEvent(req.user.id, id) });
});

export const create = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  const input = parseInput(createEventSchema, req.body);
  res.status(201).json({ event: await eventsService.createEvent(req.user.id, input) });
});

export const update = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  const { id } = parseInput(eventIdParamSchema, req.params);
  const input = parseInput(updateEventSchema, req.body);
  res.status(200).json({ event: await eventsService.updateEvent(req.user.id, id, input) });
});

export const remove = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  const { id } = parseInput(eventIdParamSchema, req.params);
  await eventsService.deleteEvent(req.user.id, id);
  res.status(204).end();
});
