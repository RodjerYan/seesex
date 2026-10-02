/**
 * Точные контракты ответов API (источник истины: apps/api/src/controllers,
 * apps/api/src/services). Отдельный модуль от types/index.ts: там — «доменные»
 * типы S4, здесь — форма, в которой данные реально приходят с бэка.
 */

/** Статус дня события для календаря (events.service.eventStatus). */
export type CalendarStatus = 'occurred' | 'planned' | 'turndown';

export interface NamedRef {
  id: string;
  name: string;
}

/** Фото: url всегда относительный (`/api/files?path=...`) — требует Bearer. */
export interface PhotoView {
  id: string;
  filePath: string;
  url: string;
  caption: string | null;
  sortOrder?: number;
  createdAt?: string;
}

/** GET /api/events, GET /api/events/:id, GET /api/group-calendars/:id/events. */
export interface EventView {
  id: string;
  title: string | null;
  eventType: string;
  eventTypes: string[];
  isCustomType: boolean;
  status: CalendarStatus;
  date: string;
  duration: number | null;
  rating: number | null;
  notes: string | null;
  calories: number | null;
  heartRate: number | null;
  initiatedBy: string | null;
  groupCalendarId: string | null;
  userId: string;
  createdAt?: string;
  updatedAt?: string;
  partners: NamedRef[];
  moods: NamedRef[];
  places: NamedRef[];
  accessories: NamedRef[];
  photos: PhotoView[];
  groupCalendar?: { id: string; name: string; inviteCode?: string } | null;
}

export interface ListEventsResult {
  events: EventView[];
  total: number;
  limit: number;
  offset: number;
}

/** GET /api/events/calendar. */
export interface CalendarDayEvent {
  id: string;
  eventType: string;
  eventTypes: string[];
  status: CalendarStatus;
  title: string | null;
}

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  events: CalendarDayEvent[];
}

export interface CalendarResult {
  from: string;
  to: string;
  days: CalendarDay[];
}

/** GET /api/partners, GET /api/partners/:id. */
export interface PartnerView {
  id: string;
  name: string;
  nickname: string | null;
  gender: string | null;
  sexualOrientation: string | null;
  pronouns: string | null;
  relationshipStatus: string | null;
  isPrimary: boolean;
  customFields: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  photos: PhotoView[];
  periodTracking: {
    lastPeriodStart: string | null;
    averageCycleLength: number | null;
    averagePeriodLength: number | null;
    notes: string | null;
    entries: {
      id: string;
      startDate: string;
      endDate: string | null;
      symptoms: string | null;
      notes: string | null;
    }[];
  } | null;
}

/** GET /api/wishlist. */
export interface WishlistView {
  id: string;
  customName: string | null;
  customCategory: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  createdAt: string;
}

/** GET /api/statistics/overview. */
export interface OverviewResult {
  totalEvents: number;
  avgRating: number | null;
  avgDurationMinutes: number | null;
  avgHeartRate: number | null;
  totalCalories: number;
  firstEventDate: string | null;
  lastEventDate: string | null;
  eventsByType: { eventType: string; count: number }[];
  partnersCount: number;
  wishlist: { total: number; completed: number };
}

export interface FrequencyResult {
  total: number;
  byMonth: { month: string; count: number }[];
  activeMonths: number;
  avgPerMonth: number;
  avgIntervalDays: number | null;
  busiestMonth: { month: string; count: number } | null;
  last30Days: number;
}

export interface NamedStatItem {
  id: string;
  name: string;
  category: string | null;
  count: number;
  lastDate: string | null;
  avgRating: number | null;
}

/** GET /api/statistics/partners — контракт: { partners: [...], totalEvents }. */
export interface PartnerStatsResult {
  partners: NamedStatItem[];
  totalEvents: number;
}

export interface RatingsResult {
  distribution: { rating: number | null; count: number; avgDurationMinutes: number | null }[];
  ratedEvents: number;
  avgRating: number | null;
}

/** GET /api/statistics/custom — произвольный диапазон + groupIds. */
export interface CustomStatsResult {
  range: {
    from: string | null;
    to: string | null;
    groupIds: string[] | null;
  };
  totalEvents: number;
  avgRating: number | null;
  avgDurationMinutes: number | null;
  totalCalories: number;
  eventsByType: { eventType: string; count: number }[];
}

/** GET /api/statistics/periods (по periodTracking партнёров). */
export interface PeriodsStatsResult {
  totalEntries: number;
  avgCycleLengthDays: number | null;
  avgPeriodLengthDays: number | null;
  lastPeriodStart: string | null;
  trackings: {
    partnerId: string;
    lastPeriodStart: string | null;
    averageCycleLength: number | null;
    averagePeriodLength: number | null;
    entriesCount: number;
  }[];
}

/** GET /api/group-calendars, .../:id, /join. */
export interface GroupCalendarView {
  id: string;
  name: string;
  inviteCode: string | null;
  createdBy: string | null;
  createdAt: string;
  role: string | null;
  memberCount: number;
  members: {
    id: string;
    userId: string;
    role: string;
    joinedAt: string;
    email: string | null;
  }[];
}

/** GET /api/auth/sessions. */
export interface SessionView {
  id: string;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
}

/** POST /api/auth/totp/setup. */
export interface TotpSetupResult {
  secret: string;
  otpauthUrl: string;
  setupToken: string;
}
