/**
 * Доменные типы фронтенда (см. спеку: architecture.structure.apps.web.src.types
 * и database_schema). Даты — ISO-8601 строки, как приходят из JSON API.
 *
 * Базовые общие типы (позиции, категории, события-виды) реэкспортятся из
 * @xtracker/shared — там живёт канон для api + web.
 */

export { POSITION_CATEGORIES } from '@xtracker/shared';
export type { ApiError, EventKind, PositionCategory } from '@xtracker/shared';

/** Публичный профиль пользователя (ответ login/refresh/verify: PublicUser). */
export interface SessionUser {
  id: string;
  email: string | null;
  createdAt: string;
  lockEnabled: boolean;
  lockMethod: string;
  autoLockTimeout: number;
  hasTotp: boolean;
}

/** Интимное событие (модель Event). */
export interface Event {
  id: string;
  userId?: string;
  title?: string | null;
  eventType: string;
  isCustomType?: boolean;
  date: string;
  duration?: number | null;
  rating?: number | null;
  notes?: string | null;
  calories?: number | null;
  heartRate?: number | null;
  initiatedBy?: string | null;
  groupCalendarId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  partners?: Partner[];
  positions?: Position[];
}

/** Фото партнёра. */
export interface PartnerPhoto {
  id: string;
  filePath?: string;
  url?: string;
  caption?: string | null;
  sortOrder?: number;
  createdAt?: string;
}

/** Партнёр (модель Partner). */
export interface Partner {
  id: string;
  userId?: string;
  name: string;
  nickname?: string | null;
  gender?: string | null;
  sexualOrientation?: string | null;
  pronouns?: string | null;
  relationshipStatus?: string | null;
  isPrimary?: boolean;
  customFields?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
  photos?: PartnerPhoto[];
  periodTracking?: PeriodTracking | null;
}

/** Позиция секса (системная или пользовательская). */
export interface Position {
  id: string;
  userId?: string;
  name: string;
  category: string;
  iconName?: string | null;
  isCustom?: boolean;
  isSystem?: boolean;
}

/** Элемент вишлиста. */
export interface WishlistItem {
  id: string;
  userId?: string;
  positionId?: string | null;
  customName?: string | null;
  customCategory?: string | null;
  isCompleted?: boolean;
  completedAt?: string | null;
  createdAt?: string;
  position?: Position | null;
}

/** Трекер цикла партнёра (модель PeriodTracking). */
export interface PeriodTracking {
  id: string;
  partnerId: string;
  lastPeriodStart?: string | null;
  averageCycleLength?: number;
  averagePeriodLength?: number;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  entries?: PeriodEntry[];
}

/** Запись менструального цикла (модель PeriodEntry). */
export interface PeriodEntry {
  id: string;
  periodTrackingId?: string;
  startDate: string;
  endDate?: string | null;
  symptoms?: string | null;
  notes?: string | null;
}

/**
 * Общая статистика (GET /api/statistics/overview).
 * Бэкенд возвращает гибкий объект — фиксируем известные поля,
 * остальное доступно через индексную сигнатуру.
 */
export interface StatisticsOverview {
  totalEvents: number;
  avgRating: number | null;
  avgDurationMinutes: number | null;
  avgHeartRate: number | null;
  totalCalories: number;
  firstEventDate?: string | null;
  [key: string]: unknown;
}

/** Участник группового календаря. */
export interface GroupCalendarMember {
  id: string;
  groupCalendarId?: string;
  userId: string;
  role?: string;
  joinedAt?: string;
}

/** Групповой календарь для пар (модель GroupCalendar). */
export interface GroupCalendar {
  id: string;
  name: string;
  inviteCode: string;
  createdBy?: string;
  createdAt?: string;
  members?: GroupCalendarMember[];
  role?: string;
}
