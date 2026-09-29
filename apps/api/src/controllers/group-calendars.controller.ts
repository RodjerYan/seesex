import type { Response } from 'express';
import type { AuthedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { parseInput } from '../schemas/common';
import {
  createGroupCalendarSchema,
  createGroupEventSchema,
  groupIdParamSchema,
  joinByCodeSchema,
} from '../schemas/group-calendars.schema';
import * as groupCalendarsService from '../services/group-calendars.service';

/** POST /api/group-calendars — создаёт календарь с invite-кодом (8 символов). */
export const create = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  const input = parseInput(createGroupCalendarSchema, req.body);
  res
    .status(201)
    .json({ calendar: await groupCalendarsService.createCalendar(req.user.id, input) });
});

/** GET /api/group-calendars — мои календари (созданные + участия). */
export const list = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  res.status(200).json({ calendars: await groupCalendarsService.listCalendars(req.user.id) });
});

export const get = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  const { id } = parseInput(groupIdParamSchema, req.params);
  res.status(200).json({ calendar: await groupCalendarsService.getCalendar(req.user.id, id) });
});

/** POST /api/group-calendars/join — тело {inviteCode}. */
export const join = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  const input = parseInput(joinByCodeSchema, req.body);
  res.status(200).json({ calendar: await groupCalendarsService.joinByCode(req.user.id, input) });
});

export const leave = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  const { id } = parseInput(groupIdParamSchema, req.params);
  await groupCalendarsService.leaveCalendar(req.user.id, id);
  res.status(204).end();
});

export const listEvents = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  const { id } = parseInput(groupIdParamSchema, req.params);
  res.status(200).json({ events: await groupCalendarsService.listCalendarEvents(req.user.id, id) });
});

export const createEvent = asyncHandler<AuthedRequest>(
  async (req: AuthedRequest, res: Response) => {
    const { id } = parseInput(groupIdParamSchema, req.params);
    const input = parseInput(createGroupEventSchema, req.body);
    res
      .status(201)
      .json({ event: await groupCalendarsService.createCalendarEvent(req.user.id, id, input) });
  },
);
