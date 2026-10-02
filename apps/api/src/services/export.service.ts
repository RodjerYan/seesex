import { isoDay } from '../lib/date';
import { prisma } from '../lib/prisma';
import * as calendarsService from './group-calendars.service';
import * as eventsService from './events.service';
import * as partnersService from './partners.service';
import * as wishlistService from './wishlist.service';

/** GDPR-экспорт: полный JSON-дамп и CSV c секцией событий. */

const EXPORT_PAGE_SIZE = 500;

/** Все события юзера (постранично — обходит лимит пагинации). */
async function allEvents(userId: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let offset = 0;
  for (;;) {
    const page = await eventsService.listEvents(userId, {
      limit: EXPORT_PAGE_SIZE,
      offset,
    });
    out.push(...page.events);
    offset += page.events.length;
    if (offset >= page.total || page.events.length === 0) break;
  }
  return out;
}

export async function exportJson(userId: string): Promise<Record<string, unknown>> {
  const [
    userRow,
    profile,
    events,
    partners,
    wishlist,
    groupCalendars,
    moods,
    places,
    accessories,
  ] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.profile.findUnique({ where: { userId } }),
    allEvents(userId),
    partnersService.listPartners(userId),
    wishlistService.listWishlist(userId),
    calendarsService.listCalendars(userId),
    prisma.mood.findMany({ where: { userId }, orderBy: { name: 'asc' } }),
    prisma.place.findMany({ where: { userId }, orderBy: { name: 'asc' } }),
    prisma.accessory.findMany({ where: { userId }, orderBy: { name: 'asc' } }),
  ]);

  // Явная проекция: в экспорт не должны попасть passwordHash/totpSecret.
  const user = userRow
    ? {
        id: userRow.id,
        email: userRow.email,
        createdAt: userRow.createdAt,
        lockEnabled: userRow.lockEnabled,
        lockMethod: userRow.lockMethod,
        autoLockTimeout: userRow.autoLockTimeout,
      }
    : null;

  return {
    format: 'xtracker-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    user,
    profile,
    events,
    partners,
    wishlist,
    groupCalendars,
    moods,
    places,
    accessories,
  };
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = value instanceof Date ? value.toISOString() : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Имена связанных с событием сущностей через ";" (для колонки partners). */
function namesOf(value: unknown): string {
  if (!Array.isArray(value)) return '';
  return value
    .map((item) =>
      item && typeof item === 'object' && 'name' in item
        ? String((item as { name: unknown }).name ?? '')
        : '',
    )
    .filter((name) => name.length > 0)
    .join(';');
}

const CSV_HEADER = [
  'id',
  'date',
  'eventType',
  'title',
  'duration',
  'rating',
  'calories',
  'heartRate',
  'initiatedBy',
  'notes',
  'partners',
] as const;

export interface CsvExport {
  csv: string;
  filename: string;
}

/** POST /api/export/csv — минимум секция events (+ заголовок и колонки). */
export async function exportEventsCsv(userId: string): Promise<CsvExport> {
  const events = await allEvents(userId);
  const lines = [CSV_HEADER.join(',')];
  for (const event of events) {
    lines.push(
      [
        event.id,
        event.date,
        event.eventType,
        event.title,
        event.duration,
        event.rating,
        event.calories,
        event.heartRate,
        event.initiatedBy,
        event.notes,
        namesOf(event.partners),
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return {
    csv: lines.join('\r\n'),
    filename: `xtracker-events-${isoDay()}.csv`,
  };
}
