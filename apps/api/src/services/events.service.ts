import type {
  Accessory,
  Event,
  EventPhoto,
  GroupCalendar,
  Mood,
  Partner,
  Place,
  Position,
  Prisma,
} from '@prisma/client';
import { decrypt, encrypt } from '../lib/crypto';
import { dayKey } from '../lib/date';
import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error';
import { relativeUploadPath, unlinkUpload } from '../middleware/upload';
import type { CreateEventInput, ListEventsQuery, UpdateEventInput } from '../schemas/events.schema';

/** Известные типы событий (для определения isCustomType). */
const KNOWN_EVENT_TYPES = [
  'SEX',
  'KISS',
  'MASSAGE',
  'ORAL',
  'ANAL',
  'OTHER',
  'CUSTOM',
  'TURNDOWN',
  'REFUSED',
  'TURN DOWN',
  'PLANNED',
  'OCCURRED',
] as const;

/** include-дерево для событий (один уровень вложенности). */
export const eventInclude = {
  partners: true,
  positions: true,
  moods: true,
  places: true,
  accessories: true,
  photos: true,
  groupCalendar: true,
} as const;

/** Результат prisma.event.* с eventInclude (relations опциональны — напр., после delete). */
export interface EventRow extends Event {
  partners?: Partner[];
  positions?: Position[];
  moods?: Mood[];
  places?: Place[];
  accessories?: Accessory[];
  photos?: EventPhoto[];
  groupCalendar?: GroupCalendar | null;
}

export type CalendarStatus = 'occurred' | 'planned' | 'turndown';

/**
 * Отказ (серая точка): отдельного поля status в схеме нет,
 * поэтому отказ кодируется eventType=TURNDOWN (или REFUSED).
 */
export function isTurndown(event: Pick<Event, 'eventType'>): boolean {
  const type = event.eventType.toUpperCase();
  return type === 'TURNDOWN' || type === 'REFUSED';
}

/** Статус события для календаря: turndown / planned / occurred. */
export function eventStatus(event: Pick<Event, 'eventType' | 'date'>): CalendarStatus {
  if (isTurndown(event)) return 'turndown';
  return event.date.getTime() > Date.now() ? 'planned' : 'occurred';
}

function photoView(photo: EventPhoto): Record<string, unknown> {
  return {
    id: photo.id,
    filePath: photo.filePath,
    caption: photo.caption,
    createdAt: photo.createdAt,
    url: `/api/files?path=${encodeURIComponent(photo.filePath)}`,
  };
}

function namedView(rows: { id: string; name: string | null }[] | undefined) {
  return (rows ?? []).map((row) => ({ id: row.id, name: row.name }));
}

export function eventView(event: EventRow): Record<string, unknown> {
  const types = Array.isArray(event.eventTypes) && event.eventTypes.length ? event.eventTypes : [event.eventType];
  return {
    id: event.id,
    title: event.title,
    eventType: types[0],
    eventTypes: types,
    isCustomType: event.isCustomType,
    status: eventStatus(event),
    date: event.date,
    duration: event.duration,
    rating: event.rating,
    notes: decrypt(event.notes),
    calories: event.calories,
    heartRate: event.heartRate,
    initiatedBy: event.initiatedBy,
    groupCalendarId: event.groupCalendarId,
    userId: event.userId,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    partners: namedView(event.partners),
    positions: (event.positions ?? []).map((position) => ({
      id: position.id,
      name: position.name,
      category: position.category,
      iconName: position.iconName,
    })),
    moods: namedView(event.moods),
    places: namedView(event.places),
    accessories: namedView(event.accessories),
    photos: (event.photos ?? []).map(photoView),
  };
}

/** Id календарей, где я участник. */
async function myCalendarIds(userId: string): Promise<string[]> {
  const memberships = await prisma.groupCalendarMember.findMany({ where: { userId } });
  return memberships.map((membership) => membership.groupCalendarId);
}

/** Доступ: своё событие ИЛИ событие из моего группового календаря. */
async function canAccessEvent(userId: string, event: EventRow): Promise<boolean> {
  if (event.userId === userId) return true;
  if (!event.groupCalendarId) return false;
  const membership = await prisma.groupCalendarMember.findFirst({
    where: { groupCalendarId: event.groupCalendarId, userId },
  });
  return membership !== null;
}

async function assertOwnEvent(userId: string, eventId: string): Promise<EventRow> {
  const event = await prisma.event.findUnique({ where: { id: eventId }, include: eventInclude });
  if (!event || event.userId !== userId) {
    throw ApiError.notFound('EVENT_NOT_FOUND', 'Event not found');
  }
  return event as EventRow;
}

function unique(ids: string[]): string[] {
  return [...new Set(ids)];
}

async function assertPartners(userId: string, ids: string[]): Promise<void> {
  const list = unique(ids);
  if (list.length === 0) return;
  const found = await prisma.partner.findMany({ where: { id: { in: list }, userId } });
  if (found.length !== list.length) {
    throw ApiError.badRequest('PARTNER_NOT_FOUND', 'One or more partner ids are unknown');
  }
}

async function assertPositions(userId: string, ids: string[]): Promise<void> {
  const list = unique(ids);
  if (list.length === 0) return;
  const found = await prisma.position.findMany({
    where: { id: { in: list }, OR: [{ userId }, { isSystem: true }] },
  });
  if (found.length !== list.length) {
    throw ApiError.badRequest('POSITION_NOT_FOUND', 'One or more position ids are unknown');
  }
}

/** Словари (moods/places/accessories): системные (userId=null) или свои. */
async function assertMoods(userId: string, ids: string[]): Promise<void> {
  const list = unique(ids);
  if (list.length === 0) return;
  const found = await prisma.mood.findMany({
    where: { id: { in: list }, OR: [{ userId }, { userId: null }] },
  });
  if (found.length !== list.length) {
    throw ApiError.badRequest('MOOD_NOT_FOUND', 'One or more mood ids are unknown');
  }
}

async function assertPlaces(userId: string, ids: string[]): Promise<void> {
  const list = unique(ids);
  if (list.length === 0) return;
  const found = await prisma.place.findMany({
    where: { id: { in: list }, OR: [{ userId }, { userId: null }] },
  });
  if (found.length !== list.length) {
    throw ApiError.badRequest('PLACE_NOT_FOUND', 'One or more place ids are unknown');
  }
}

async function assertAccessories(userId: string, ids: string[]): Promise<void> {
  const list = unique(ids);
  if (list.length === 0) return;
  const found = await prisma.accessory.findMany({
    where: { id: { in: list }, OR: [{ userId }, { userId: null }] },
  });
  if (found.length !== list.length) {
    throw ApiError.badRequest('ACCESSORY_NOT_FOUND', 'One or more accessory ids are unknown');
  }
}

/** Право записывать события в групповой календарь (участник или создатель). */
async function assertCalendarWritable(userId: string, calendarId: string): Promise<void> {
  const calendar = await prisma.groupCalendar.findUnique({ where: { id: calendarId } });
  if (!calendar) {
    throw ApiError.notFound('CALENDAR_NOT_FOUND', 'Group calendar not found');
  }
  const membership = await prisma.groupCalendarMember.findFirst({
    where: { groupCalendarId: calendarId, userId },
  });
  if (!membership && calendar.createdBy !== userId) {
    throw ApiError.notFound('CALENDAR_NOT_FOUND', 'Group calendar not found');
  }
}

function scopeWhere(userId: string, sharedIds: string[]): Prisma.EventWhereInput {
  if (sharedIds.length === 0) return { userId };
  return { OR: [{ userId }, { groupCalendarId: { in: sharedIds } }] };
}

async function validateRelations(userId: string, input: CreateEventInput | UpdateEventInput) {
  if (input.partnerIds) await assertPartners(userId, input.partnerIds);
  if (input.positionIds) await assertPositions(userId, input.positionIds);
  if (input.moodIds) await assertMoods(userId, input.moodIds);
  if (input.placeIds) await assertPlaces(userId, input.placeIds);
  if (input.accessoryIds) await assertAccessories(userId, input.accessoryIds);
  if (input.groupCalendarId) await assertCalendarWritable(userId, input.groupCalendarId);
}

/** notes шифруется на записи и расшифровывается при чтении (AES-256-GCM). */
function notesToStorage(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return encrypt(value);
}

// Unchecked-вариант create/update: scalar FKs (userId/groupCalendarId) + nested
// connect/set для m2m-связей в одном объекте (XOR-ветка Unchecked).
type EventCreateData = Prisma.EventUncheckedCreateInput;
type EventUpdateData = Prisma.EventUncheckedUpdateInput;

function buildCreateData(userId: string, input: CreateEventInput): EventCreateData {
  const notes = notesToStorage(input.notes);
  const types = unique(input.eventTypes?.length ? input.eventTypes : [input.eventType ?? 'SEX']);
  const primaryType = types[0];
  const isCustomType = types.some((t: string) => !KNOWN_EVENT_TYPES.includes(t as (typeof KNOWN_EVENT_TYPES)[number]));
  return {
    userId,
    title: input.title ?? null,
    eventType: primaryType,
    eventTypes: types,
    isCustomType,
    date: input.date,
    duration: input.duration ?? null,
    rating: input.rating ?? null,
    ...(notes !== undefined ? { notes } : {}),
    calories: input.calories ?? null,
    heartRate: input.heartRate ?? null,
    initiatedBy: input.initiatedBy ?? null,
    groupCalendarId: input.groupCalendarId ?? null,
    ...(input.partnerIds ? { partners: { connect: input.partnerIds.map((id) => ({ id })) } } : {}),
    ...(input.positionIds
      ? { positions: { connect: input.positionIds.map((id) => ({ id })) } }
      : {}),
    ...(input.moodIds ? { moods: { connect: input.moodIds.map((id) => ({ id })) } } : {}),
    ...(input.placeIds ? { places: { connect: input.placeIds.map((id) => ({ id })) } } : {}),
    ...(input.accessoryIds
      ? { accessories: { connect: input.accessoryIds.map((id) => ({ id })) } }
      : {}),
  };
}

function buildUpdateData(input: UpdateEventInput): EventUpdateData {
  const notes = notesToStorage(input.notes);
  const data: EventUpdateData = {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.date !== undefined ? { date: input.date } : {}),
    ...(input.duration !== undefined ? { duration: input.duration } : {}),
    ...(input.rating !== undefined ? { rating: input.rating } : {}),
    ...(notes !== undefined ? { notes } : {}),
    ...(input.calories !== undefined ? { calories: input.calories } : {}),
    ...(input.heartRate !== undefined ? { heartRate: input.heartRate } : {}),
    ...(input.initiatedBy !== undefined ? { initiatedBy: input.initiatedBy } : {}),
    ...(input.groupCalendarId !== undefined ? { groupCalendarId: input.groupCalendarId } : {}),
    ...(input.partnerIds ? { partners: { set: input.partnerIds.map((id) => ({ id })) } } : {}),
    ...(input.positionIds ? { positions: { set: input.positionIds.map((id) => ({ id })) } } : {}),
    ...(input.moodIds ? { moods: { set: input.moodIds.map((id) => ({ id })) } } : {}),
    ...(input.placeIds ? { places: { set: input.placeIds.map((id) => ({ id })) } } : {}),
    ...(input.accessoryIds
      ? { accessories: { set: input.accessoryIds.map((id) => ({ id })) } }
      : {}),
  };

  // Handle eventTypes / eventType / isCustomType
  if (input.eventTypes !== undefined) {
    const types = unique(input.eventTypes);
    data.eventType = types[0];
    data.eventTypes = types;
    data.isCustomType = types.some((t: string) => !KNOWN_EVENT_TYPES.includes(t as (typeof KNOWN_EVENT_TYPES)[number]));
  } else if (input.eventType !== undefined) {
    // Legacy: single eventType provided
    data.eventType = input.eventType;
    data.eventTypes = [input.eventType];
    if (input.isCustomType !== undefined) {
      data.isCustomType = input.isCustomType;
    } else {
      data.isCustomType = !KNOWN_EVENT_TYPES.includes(input.eventType as (typeof KNOWN_EVENT_TYPES)[number]);
    }
  } else if (input.isCustomType !== undefined) {
    // Only isCustomType provided (legacy)
    data.isCustomType = input.isCustomType;
  }

  return data;
}

export interface ListEventsResult {
  events: Record<string, unknown>[];
  total: number;
  limit: number;
  offset: number;
}

export async function listEvents(
  userId: string,
  query: ListEventsQuery,
): Promise<ListEventsResult> {
  const sharedIds = await myCalendarIds(userId);
  const filters: Prisma.EventWhereInput[] = [];
  if (query.eventTypes) {
    const types = query.eventTypes.split(',').map((t) => t.trim()).filter(Boolean);
    if (types.length > 0) {
      filters.push({ OR: types.map((t) => ({ eventTypes: { has: t } })) });
    }
  } else if (query.eventType) {
    // Legacy: filter by single eventType using eventTypes array
    filters.push({ eventTypes: { has: query.eventType } });
  }
  if (query.groupCalendarId) filters.push({ groupCalendarId: query.groupCalendarId });
  if (query.dateFrom || query.dateTo) {
    const date: Prisma.DateTimeFilter = {};
    if (query.dateFrom) date.gte = query.dateFrom;
    if (query.dateTo) date.lte = query.dateTo;
    filters.push({ date });
  }
  if (query.partnerId) filters.push({ partners: { some: { id: query.partnerId } } });

  const where: Prisma.EventWhereInput = scopeWhere(userId, sharedIds);
  if (filters.length > 0) where.AND = filters;

  const [total, rows] = await Promise.all([
    prisma.event.count({ where }),
    prisma.event.findMany({
      where,
      include: eventInclude,
      orderBy: { date: 'desc' },
      skip: query.offset,
      take: query.limit,
    }),
  ]);
  return {
    events: rows.map((row) => eventView(row as EventRow)),
    total,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function getEvent(userId: string, eventId: string): Promise<Record<string, unknown>> {
  const event = (await prisma.event.findUnique({
    where: { id: eventId },
    include: eventInclude,
  })) as EventRow | null;
  if (!event || !(await canAccessEvent(userId, event))) {
    throw ApiError.notFound('EVENT_NOT_FOUND', 'Event not found');
  }
  return eventView(event);
}

export async function createEvent(
  userId: string,
  input: CreateEventInput,
): Promise<Record<string, unknown>> {
  await validateRelations(userId, input);
  const event = (await prisma.event.create({
    data: buildCreateData(userId, input),
    include: eventInclude,
  })) as EventRow;
  return eventView(event);
}

export async function updateEvent(
  userId: string,
  eventId: string,
  input: UpdateEventInput,
): Promise<Record<string, unknown>> {
  await assertOwnEvent(userId, eventId);
  await validateRelations(userId, input);
  const event = (await prisma.event.update({
    where: { id: eventId },
    data: buildUpdateData(input),
    include: eventInclude,
  })) as EventRow;
  return eventView(event);
}

export async function deleteEvent(userId: string, eventId: string): Promise<void> {
  const event = await assertOwnEvent(userId, eventId);
  await prisma.event.delete({ where: { id: eventId } });
  for (const photo of event.photos ?? []) {
    try {
      unlinkUpload(photo.filePath);
    } catch {
      // Файл уже отсутствует — не блокируем удаление.
    }
  }
}

export interface CalendarDay {
  date: string;
  events: { id: string; eventType: string; eventTypes: string[]; status: CalendarStatus; title: string | null }[];
}

export interface CalendarResult {
  from: Date;
  to: Date;
  days: CalendarDay[];
}

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export async function calendar(userId: string, from?: Date, to?: Date): Promise<CalendarResult> {
  const fromD = from ?? new Date(Date.now() - ONE_YEAR_MS);
  const toD = to ?? new Date(Date.now() + ONE_YEAR_MS);
  const sharedIds = await myCalendarIds(userId);
  const rows = await prisma.event.findMany({
    where: { AND: [scopeWhere(userId, sharedIds), { date: { gte: fromD, lte: toD } }] },
    orderBy: { date: 'asc' },
    select: {
      id: true,
      eventType: true,
      eventTypes: true,
      date: true,
      title: true,
    },
  });

  const byDay = new Map<string, CalendarDay>();
  for (const row of rows) {
    const key = dayKey(row.date);
    let day = byDay.get(key);
    if (!day) {
      day = { date: key, events: [] };
      byDay.set(key, day);
    }
    const types = Array.isArray(row.eventTypes) && row.eventTypes.length ? row.eventTypes : [row.eventType];
    day.events.push({
      id: row.id,
      eventType: types[0],
      eventTypes: types,
      status: eventStatus(row),
      title: row.title,
    });
  }
  return { from: fromD, to: toD, days: [...byDay.values()] };
}

/** POST /api/events/:id/photos — создаёт EventPhoto для сохранённых multer-файлов. */
export async function addEventPhotos(
  userId: string,
  eventId: string,
  filenames: string[],
): Promise<Record<string, unknown>[]> {
  await assertOwnEvent(userId, eventId);
  for (const filename of filenames) {
    await prisma.eventPhoto.create({
      data: { eventId, filePath: relativeUploadPath('events', filename) },
    });
  }
  const event = (await prisma.event.findUnique({
    where: { id: eventId },
    include: eventInclude,
  })) as EventRow;
  return (event.photos ?? []).map(photoView);
}
