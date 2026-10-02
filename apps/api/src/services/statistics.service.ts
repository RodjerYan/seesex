import type { Prisma } from '@prisma/client';
import { monthKey } from '../lib/date';
import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error';
import type { CustomStatsQuery, FrequencyQuery } from '../schemas/statistics.schema';

/**
 * Статистика — реальные агрегаты Prisma (aggregate/groupBy) поверх данных юзера,
 * без заглушек. Числовые средние округляются до 2 знаков.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function round(value: number | null | undefined, digits = 2): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** WHERE событий юзера с опциональным диапазоном дат. */
function eventWhere(userId: string, range: FrequencyQuery = {}): Prisma.EventWhereInput {
  const where: Prisma.EventWhereInput = { userId };
  if (range.from || range.to) {
    const date: Prisma.DateTimeFilter = {};
    if (range.from) date.gte = range.from;
    if (range.to) date.lte = range.to;
    where.date = date;
  }
  return where;
}

function byTypeView(
  groups: { eventType: string; _count: number }[],
): { eventType: string; count: number }[] {
  return groups
    .map((group) => ({ eventType: group.eventType, count: group._count }))
    .sort((left, right) => right.count - left.count);
}

/** GET /api/statistics/overview — сводка по всем данным юзера. */
export async function overview(userId: string): Promise<Record<string, unknown>> {
  const where = eventWhere(userId);
  const [agg, byType, partnersCount, wishlistGroups] = await Promise.all([
    prisma.event.aggregate({
      where,
      _count: true,
      _avg: { rating: true, duration: true, heartRate: true },
      _sum: { calories: true },
      _min: { date: true },
      _max: { date: true },
    }),
    (async () => {
      const typeRows = await prisma.event.findMany({ where, select: { eventTypes: true, eventType: true } });
      const typeCounts = new Map<string, number>();
      for (const r of typeRows) {
        const types = r.eventTypes?.length ? r.eventTypes : [r.eventType];
        for (const t of new Set(types)) {
          typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
        }
      }
      return Array.from(typeCounts.entries()).map(([eventType, _count]) => ({ eventType, _count }));
    })(),
    prisma.partner.count({ where: { userId } }),
    prisma.wishlist.groupBy({ by: ['isCompleted'], where: { userId }, _count: true }),
  ]);

  const wishlistTotal = wishlistGroups.reduce((sum, group) => sum + group._count, 0);
  const wishlistCompleted = wishlistGroups.find((group) => group.isCompleted)?._count ?? 0;

  return {
    totalEvents: agg._count,
    avgRating: round(agg._avg.rating),
    avgDurationMinutes: round(agg._avg.duration),
    avgHeartRate: round(agg._avg.heartRate),
    totalCalories: agg._sum.calories ?? 0,
    firstEventDate: agg._min.date,
    lastEventDate: agg._max.date,
    eventsByType: byTypeView(byType),
    partnersCount,
    wishlist: { total: wishlistTotal, completed: wishlistCompleted },
  };
}

/** GET /api/statistics/frequency — события по месяцам + средний интервал. */
export async function frequency(
  userId: string,
  query: FrequencyQuery,
): Promise<Record<string, unknown>> {
  const rows = await prisma.event.findMany({
    where: eventWhere(userId, query),
    select: { date: true },
    orderBy: { date: 'asc' },
  });
  const dates = rows.map((row) => row.date);

  const counts = new Map<string, number>();
  for (const date of dates) {
    const key = monthKey(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const byMonth = [...counts.entries()]
    .map(([month, count]) => ({ month, count }))
    .sort((left, right) => (left.month < right.month ? -1 : 1));

  let intervalSum = 0;
  let intervals = 0;
  for (let i = 1; i < dates.length; i += 1) {
    intervalSum += (dates[i].getTime() - dates[i - 1].getTime()) / MS_PER_DAY;
    intervals += 1;
  }

  const cutoff = Date.now() - 30 * MS_PER_DAY;
  const busiestMonth =
    byMonth.length > 0
      ? byMonth.reduce((best, item) => (item.count > best.count ? item : best), byMonth[0])
      : null;

  return {
    total: dates.length,
    byMonth,
    activeMonths: byMonth.length,
    avgPerMonth: byMonth.length > 0 ? round(dates.length / byMonth.length) : 0,
    avgIntervalDays: intervals > 0 ? round(intervalSum / intervals) : null,
    busiestMonth,
    last30Days: dates.filter((date) => date.getTime() >= cutoff).length,
  };
}

export interface NamedStat {
  id: string;
  name: string;
  count: number;
  lastDate: Date | null;
  avgRating: number | null;
}

/** Общий агрегатор «связь события со справочником» (только partners). */
async function relatedStats(
  userId: string,
  query: FrequencyQuery,
  field: 'partners',
): Promise<{ items: NamedStat[]; totalEvents: number }> {
  const where = eventWhere(userId, query);

  // Приводим оба варианта select к общему плоскому виду link'ов.
  interface Link {
    id: string;
    name: string;
    category: string | null;
    rating: number | null;
    date: Date;
  }
  const links: Link[] = [];
  let totalEvents = 0;

  if (field === 'partners') {
    const partnerRows = await prisma.event.findMany({
      where,
      // include + вложенный select: и в реальном Prisma, и в fake-моке
      // relation-поле приходит заполненным (top-level select мок игнорирует).
      include: { partners: { select: { id: true, name: true } } },
      orderBy: { date: 'desc' },
    });
    totalEvents = partnerRows.length;
    for (const row of partnerRows) {
      for (const item of row.partners) {
        links.push({
          id: item.id,
          name: item.name,
          category: null,
          rating: row.rating,
          date: row.date,
        });
      }
    }
  }

  interface Bucket {
    name: string;
    category: string | null;
    count: number;
    ratingSum: number;
    ratingCount: number;
    lastDate: Date | null;
  }
  const buckets = new Map<string, Bucket>();

  for (const link of links) {
    const bucket = buckets.get(link.id) ?? {
      name: link.name,
      category: link.category,
      count: 0,
      ratingSum: 0,
      ratingCount: 0,
      lastDate: null,
    };
    bucket.count += 1;
    if (link.rating !== null) {
      bucket.ratingSum += link.rating;
      bucket.ratingCount += 1;
    }
    if (!bucket.lastDate || link.date.getTime() > bucket.lastDate.getTime()) {
      bucket.lastDate = link.date;
    }
    buckets.set(link.id, bucket);
  }

  const items = [...buckets.entries()]
    .map(([id, bucket]) => ({
      id,
      name: bucket.name,
      category: bucket.category,
      count: bucket.count,
      lastDate: bucket.lastDate,
      avgRating: bucket.ratingCount > 0 ? round(bucket.ratingSum / bucket.ratingCount) : null,
    }))
    .sort((left, right) => right.count - left.count || (left.name < right.name ? -1 : 1));
  return { items, totalEvents };
}

/** GET /api/statistics/partners. */
export async function partners(
  userId: string,
  query: FrequencyQuery,
): Promise<Record<string, unknown>> {
  const { items, totalEvents } = await relatedStats(userId, query, 'partners');
  return { partners: items, totalEvents };
}

/** GET /api/statistics/ratings — распределение оценок (groupBy rating). */
export async function ratings(
  userId: string,
  query: FrequencyQuery,
): Promise<Record<string, unknown>> {
  const groups = await prisma.event.groupBy({
    by: ['rating'],
    where: eventWhere(userId, query),
    _count: true,
    _avg: { duration: true },
  });

  const distribution = groups
    .map((group) => ({
      rating: group.rating,
      count: group._count,
      avgDurationMinutes: round(group._avg.duration),
    }))
    .sort((left, right) => (right.rating ?? -1) - (left.rating ?? -1));

  const rated = groups.filter((group) => group.rating !== null);
  const ratedCount = rated.reduce((sum, group) => sum + group._count, 0);
  const ratingSum = rated.reduce((sum, group) => sum + (group.rating ?? 0) * group._count, 0);

  return {
    distribution,
    ratedEvents: ratedCount,
    avgRating: ratedCount > 0 ? round(ratingSum / ratedCount) : null,
  };
}

/** GET /api/statistics/periods — циклы по всем отслеживаемым партнёрам. */
export async function periods(userId: string): Promise<Record<string, unknown>> {
  const trackings = await prisma.periodTracking.findMany({
    where: { partner: { userId } },
    include: { entries: { orderBy: { startDate: 'asc' } } },
  });

  let cycleSum = 0;
  let cycleCount = 0;
  let lengthSum = 0;
  let lengthCount = 0;
  let lastStartMs: number | null = null;
  let totalEntries = 0;

  for (const tracking of trackings) {
    const starts = tracking.entries.map((entry) => entry.startDate.getTime());
    for (let i = 1; i < starts.length; i += 1) {
      cycleSum += (starts[i] - starts[i - 1]) / MS_PER_DAY;
      cycleCount += 1;
    }
    for (const entry of tracking.entries) {
      totalEntries += 1;
      const startMs = entry.startDate.getTime();
      if (lastStartMs === null || startMs > lastStartMs) lastStartMs = startMs;
      if (entry.endDate) {
        lengthSum += (entry.endDate.getTime() - startMs) / MS_PER_DAY + 1;
        lengthCount += 1;
      }
    }
  }

  return {
    totalEntries,
    avgCycleLengthDays: cycleCount > 0 ? round(cycleSum / cycleCount) : null,
    avgPeriodLengthDays: lengthCount > 0 ? round(lengthSum / lengthCount) : null,
    lastPeriodStart: lastStartMs === null ? null : new Date(lastStartMs),
    trackings: trackings.map((tracking) => ({
      partnerId: tracking.partnerId,
      lastPeriodStart: tracking.lastPeriodStart,
      averageCycleLength: tracking.averageCycleLength,
      averagePeriodLength: tracking.averagePeriodLength,
      entriesCount: tracking.entries.length,
    })),
  };
}

/**
 * GET /api/statistics/custom — диапазон дат + опционально groupIds.
 * groupIds проверяются на членство: чужой календарь → 403.
 */
export async function custom(
  userId: string,
  query: CustomStatsQuery,
): Promise<Record<string, unknown>> {
  const where = eventWhere(userId, query);
  if (query.groupIds && query.groupIds.length > 0) {
    const memberships = await prisma.groupCalendarMember.findMany({
      where: { userId },
      select: { groupCalendarId: true },
    });
    const allowed = new Set(memberships.map((membership) => membership.groupCalendarId));
    const requested = query.groupIds.filter((id) => allowed.has(id));
    if (requested.length !== query.groupIds.length) {
      throw ApiError.forbidden(
        'CALENDAR_ACCESS_DENIED',
        'One or more group calendars are not accessible',
      );
    }
    // Групповой отчёт: события календаря (в т.ч. партнёра), но не свои личные.
    delete where.userId;
    where.groupCalendarId = { in: requested };
  }

  const [agg, byType] = await Promise.all([
    prisma.event.aggregate({
      where,
      _count: true,
      _avg: { rating: true, duration: true },
      _sum: { calories: true },
    }),
    (async () => {
      const typeRows = await prisma.event.findMany({ where, select: { eventTypes: true, eventType: true } });
      const typeCounts = new Map<string, number>();
      for (const r of typeRows) {
        const types = r.eventTypes?.length ? r.eventTypes : [r.eventType];
        for (const t of new Set(types)) {
          typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
        }
      }
      return Array.from(typeCounts.entries()).map(([eventType, _count]) => ({ eventType, _count }));
    })(),
  ]);

  return {
    range: {
      from: query.from ?? null,
      to: query.to ?? null,
      groupIds: query.groupIds ?? null,
    },
    totalEvents: agg._count,
    avgRating: round(agg._avg.rating),
    avgDurationMinutes: round(agg._avg.duration),
    totalCalories: agg._sum.calories ?? 0,
    eventsByType: byTypeView(byType),
  };
}
