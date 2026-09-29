import { randomBytes } from 'node:crypto';
import type { GroupCalendar, GroupCalendarMember } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error';
import type { CreateEventInput } from '../schemas/events.schema';
import type { CreateGroupCalendarInput, JoinByCodeInput } from '../schemas/group-calendars.schema';
import { eventInclude, eventView, type EventRow } from './events.service';
import * as eventsService from './events.service';

/**
 * Групповые календари: invite-код (8 crypto-safe символов, уникальный),
 * вступление/выход, общие события участников.
 */

// 32 символа без похожих (0/O, 1/I/I): 256 % 32 === 0 → randomBytes без bias.
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_CODE_LENGTH = 8;
const MAX_CODE_ATTEMPTS = 10;

const memberInclude = {
  members: { include: { user: { select: { id: true, email: true } } } },
} as const;

interface CalendarUserRef {
  id: string;
  email: string | null;
}

interface CalendarRow extends GroupCalendar {
  members?: (GroupCalendarMember & { user?: CalendarUserRef | null })[];
}

function generateInviteCode(): string {
  const bytes = randomBytes(INVITE_CODE_LENGTH);
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) {
    code += INVITE_ALPHABET[bytes[i] % INVITE_ALPHABET.length];
  }
  return code;
}

/** Уникальный код: перегенерация при коллизии (страховка поверх unique-индекса). */
async function uniqueInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const code = generateInviteCode();
    const existing = await prisma.groupCalendar.findUnique({ where: { inviteCode: code } });
    if (!existing) return code;
  }
  throw new ApiError(
    500,
    'INVITE_CODE_FAILED',
    'Could not generate a unique invite code, please retry',
  );
}

function isMemberOf(calendar: CalendarRow, userId: string): boolean {
  if (calendar.createdBy === userId) return true;
  return (calendar.members ?? []).some((member) => member.userId === userId);
}

function calendarView(calendar: CalendarRow, viewerId: string): Record<string, unknown> {
  const member = isMemberOf(calendar, viewerId);
  const role =
    (calendar.members ?? []).find((row) => row.userId === viewerId)?.role ??
    (calendar.createdBy === viewerId ? 'OWNER' : null);
  return {
    id: calendar.id,
    name: calendar.name,
    // Код виден только участникам — посторонним он не нужен.
    inviteCode: member ? calendar.inviteCode : null,
    createdBy: calendar.createdBy,
    createdAt: calendar.createdAt,
    role,
    memberCount: (calendar.members ?? []).length,
    members: (calendar.members ?? []).map((row) => ({
      id: row.id,
      userId: row.userId,
      role: row.role,
      joinedAt: row.joinedAt,
      email: row.user?.email ?? null,
    })),
  };
}

async function findCalendar(id: string): Promise<CalendarRow | null> {
  return (await prisma.groupCalendar.findUnique({
    where: { id },
    include: memberInclude,
  })) as CalendarRow | null;
}

/** Доступ: участник (membership) или создатель; иначе 404. */
async function assertCalendarAccess(userId: string, calendarId: string): Promise<CalendarRow> {
  const calendar = await findCalendar(calendarId);
  if (!calendar || !isMemberOf(calendar, userId)) {
    throw ApiError.notFound('CALENDAR_NOT_FOUND', 'Group calendar not found');
  }
  return calendar;
}

/** POST /api/group-calendars — создаёт календарь и membership создателя (OWNER). */
export async function createCalendar(
  userId: string,
  input: CreateGroupCalendarInput,
): Promise<Record<string, unknown>> {
  const inviteCode = await uniqueInviteCode();
  const created = (await prisma.$transaction(async (tx) => {
    const calendar = await tx.groupCalendar.create({
      data: { name: input.name, inviteCode, createdBy: userId },
    });
    await tx.groupCalendarMember.create({
      data: { groupCalendarId: calendar.id, userId, role: 'OWNER' },
    });
    return calendar;
  })) as GroupCalendar;
  const withMembers = await findCalendar(created.id);
  return calendarView(withMembers as CalendarRow, userId);
}

/** GET /api/group-calendars — календари, где я создатель или участник. */
export async function listCalendars(userId: string): Promise<Record<string, unknown>[]> {
  const rows = (await prisma.groupCalendar.findMany({
    where: { OR: [{ createdBy: userId }, { members: { some: { userId } } }] },
    include: memberInclude,
    orderBy: { createdAt: 'desc' },
  })) as CalendarRow[];
  return rows.map((row) => calendarView(row, userId));
}

/** GET /api/group-calendars/:id. */
export async function getCalendar(
  userId: string,
  calendarId: string,
): Promise<Record<string, unknown>> {
  return calendarView(await assertCalendarAccess(userId, calendarId), userId);
}

/** POST /api/group-calendars/join — вступление по inviteCode. */
export async function joinByCode(
  userId: string,
  input: JoinByCodeInput,
): Promise<Record<string, unknown>> {
  const calendar = await prisma.groupCalendar.findUnique({
    where: { inviteCode: input.inviteCode },
    include: memberInclude,
  });
  if (!calendar) {
    throw ApiError.notFound('CALENDAR_NOT_FOUND', 'Group calendar not found');
  }
  const row = calendar as CalendarRow;
  if (isMemberOf(row, userId)) {
    throw ApiError.conflict('ALREADY_MEMBER', 'You are already a member of this calendar');
  }
  await prisma.groupCalendarMember.create({
    data: { groupCalendarId: row.id, userId, role: 'MEMBER' },
  });
  const updated = await findCalendar(row.id);
  return calendarView(updated as CalendarRow, userId);
}

/** DELETE /api/group-calendars/:id/leave — выйти из календаря. */
export async function leaveCalendar(userId: string, calendarId: string): Promise<void> {
  const calendar = await prisma.groupCalendar.findUnique({ where: { id: calendarId } });
  if (!calendar) {
    throw ApiError.notFound('CALENDAR_NOT_FOUND', 'Group calendar not found');
  }
  const membership = await prisma.groupCalendarMember.findFirst({
    where: { groupCalendarId: calendarId, userId },
  });
  if (!membership) {
    throw ApiError.notFound('NOT_A_MEMBER', 'You are not a member of this calendar');
  }
  await prisma.groupCalendarMember.delete({ where: { id: membership.id } });
}

/** GET /api/group-calendars/:id/events — общие события (только участники). */
export async function listCalendarEvents(
  userId: string,
  calendarId: string,
): Promise<Record<string, unknown>[]> {
  await assertCalendarAccess(userId, calendarId);
  const rows = await prisma.event.findMany({
    where: { groupCalendarId: calendarId },
    include: eventInclude,
    orderBy: { date: 'desc' },
  });
  return rows.map((row) => eventView(row as EventRow));
}

/**
 * POST /api/group-calendars/:id/events — событие в групповом календаре.
 * Доступность календаря проверяет events.service (assertCalendarWritable).
 */
export async function createCalendarEvent(
  userId: string,
  calendarId: string,
  input: CreateEventInput,
): Promise<Record<string, unknown>> {
  return eventsService.createEvent(userId, { ...input, groupCalendarId: calendarId });
}
