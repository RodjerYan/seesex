import { randomBytes } from 'node:crypto';
import type { DeviceToken, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error';
import type { AppleIngestInput, AppleSample } from '../schemas/health.schema';

/**
 * Apple Health интеграция (T-20261002-019 / H1+H2):
 *  - приём проб от шортката через device-token (POST /api/health/apple);
 *  - обогащение события: heartRate/heartRateMax/calories;
 *  - CRUD device-токенов (create/revoke/status) для UI (H2).
 */

/** Максимум активных device-токенов на пользователя (создание старейший вытесняет). */
const MAX_ACTIVE_TOKENS = 3;
/** Префикс + 48 hex-символов (192 бита энтропии) — формат device-токена (спека H2). */
const TOKEN_PREFIX = 'xth_';
const TOKEN_RANDOM_BYTES = 24; // 24 байта → 48 hex-символов

/** Окно без duration: радиус ±60 мин от startDate (фиксировано в спеке H1). */
const WINDOW_RADIUS_MS = 60 * 60 * 1000;
const MS_PER_MINUTE = 60 * 1000;

/**
 * MET-константа для фоллбэка калорий (компендиум: лёгкая/умеренная активность).
 * TODO weight: масса тела в v1 — константа 70 кг (профиль/Profile.weightKg подключим позже).
 */
const DEFAULT_WEIGHT_KG = 70;

/**
 * MET по eventType (спека H1): SEX=5.0, TURNDOWN=4.0, PLANNED/другое=3.0;
 * default=4.0 — если тип пустой/не задан.
 */
function metForEventType(eventType: string): number {
  const type = eventType.trim().toUpperCase();
  switch (type) {
    case 'SEX':
      return 5.0;
    case 'TURNDOWN':
      return 4.0;
    case 'PLANNED':
      return 3.0;
    case '':
      return 4.0; // default по спеке
    default:
      return 3.0; // «другое»
  }
}

// ---------------------------------------------------------------------------
// Device-токены (H2)
// ---------------------------------------------------------------------------

export interface DeviceTokenStatus {
  hasToken: boolean;
  tokensCount: number;
  lastSyncAt: Date | null;
}

/**
 * create → новый device-токен (строка для ответа { token }).
 * Токен хранится открытым (не хэшируем): он одноразово показывается в UI
 * и подставляется шорткатом в Authorization — родом как обычный API-ключ.
 * Допустимо по спеке H1/H2. Держим максимум MAX_ACTIVE_TOKENS активных:
 * при создании 4-го удаляется старейший.
 */
export async function createDeviceToken(userId: string): Promise<string> {
  const token = `${TOKEN_PREFIX}${randomBytes(TOKEN_RANDOM_BYTES).toString('hex')}`;

  // Транзакция: создание + вытеснение старейших токенов атомарно,
  // иначе гонка параллельных create может оставить > MAX_ACTIVE_TOKENS.
  return prisma.$transaction(async (tx) => {
    const row = await tx.deviceToken.create({ data: { userId, token } });

    const existing = await tx.deviceToken.findMany({
      where: { userId },
      // Стабильная сортировка: по createdAt, чтобы вытеснять по-старейше.
      orderBy: { createdAt: 'asc' },
    });
    if (existing.length > MAX_ACTIVE_TOKENS) {
      const excess = existing.slice(0, existing.length - MAX_ACTIVE_TOKENS).map((item) => item.id);
      await tx.deviceToken.deleteMany({ where: { id: { in: excess } } });
    }

    return row.token;
  });
}

/** revoke → удаляем все токены пользователя (спека H2). */
export async function revokeDeviceTokens(userId: string): Promise<{ ok: true }> {
  await prisma.deviceToken.deleteMany({ where: { userId } });
  return { ok: true };
}

/** Статус для UI: есть ли токен, сколько, последняя синхронизация (max по токенам). */
export async function deviceTokenStatus(userId: string): Promise<DeviceTokenStatus> {
  const rows = await prisma.deviceToken.findMany({ where: { userId } });
  const lastSyncAt = rows.reduce<Date | null>(
    (latest, row) => (row.lastSyncAt && (!latest || row.lastSyncAt > latest) ? row.lastSyncAt : latest),
    null,
  );
  return { hasToken: rows.length > 0, tokensCount: rows.length, lastSyncAt };
}

// ---------------------------------------------------------------------------
// POST /api/health/apple — приём и обогащение
// ---------------------------------------------------------------------------

/** Успешное обогащение: поля null, если по ним не было проб в окне. */
export interface AppleIngestResult {
  ok: true;
  eventId: string;
  heartRate: number | null;
  heartRateMax: number | null;
  calories: number | null;
  source: 'apple' | 'formula';
}

/**
 * Проб в окне события нет: 200, но ничего не меняем (спека H1 — решение:
 * не ошибка, а «нет данных для обогащения»; source=null, reason для UI).
 */
export interface AppleIngestNoSamples {
  ok: false;
  eventId: string;
  heartRate: null;
  heartRateMax: null;
  calories: null;
  source: null;
  reason: 'no_samples_in_window';
}

export type AppleIngestResponse = AppleIngestResult | AppleIngestNoSamples;

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Окно события: [date, date + duration]; duration не задано → ±60 мин от startDate. */
function eventWindow(event: { date: Date; duration: number | null }): { start: number; end: number } {
  const start = event.date.getTime();
  if (event.duration === null) {
    return { start: start - WINDOW_RADIUS_MS, end: start + WINDOW_RADIUS_MS };
  }
  return { start, end: start + event.duration * MS_PER_MINUTE };
}

/** Проба попадает в окно, если её интервал пересекается с окном события. */
function intersectsWindow(sample: AppleSample, window: { start: number; end: number }): boolean {
  return sample.end.getTime() >= window.start && sample.start.getTime() <= window.end;
}

/**
 * Фоллбэк калорий (нет activeEnergy-проб, но есть пульс):
 * kcal = MET * 3.5 * weightKg / 200 * durationMin (MET-формула компендиума).
 * durationMin — из события; если duration не задан — 60 мин (спека H1).
 */
function caloriesFromHeartRate(eventType: string, duration: number | null): number {
  const durationMin = duration ?? 60;
  const met = metForEventType(eventType);
  return Math.round((met * 3.5 * DEFAULT_WEIGHT_KG) / 200 * durationMin);
}

/**
 * Обогащение события пробами Apple Health.
 * heartRate → round(avg) проб в окне, heartRateMax → max проб (округляется до
 * Int колонки), calories → round(sum activeEnergy), иначе фоллбэк-формула.
 * Пробы вне окна события игнорируются. Чужие события не раскрываем (404).
 * Нет проб в окне → 200 ok:false, ничего не меняем (спека H1).
 */
export async function ingestAppleSamples(
  deviceToken: DeviceToken,
  input: AppleIngestInput,
): Promise<AppleIngestResponse> {
  const event = await prisma.event.findUnique({ where: { id: input.eventId } });
  // Существование и владение проверяем одной проверкой: чужое событие
  // отвечает так же, как несуществующее — не раскрываем чужие данные.
  if (!event || event.userId !== deviceToken.userId) {
    throw ApiError.notFound('EVENT_NOT_FOUND', 'Event not found');
  }

  const window = eventWindow(event);
  const inWindow = input.samples.filter((sample) => intersectsWindow(sample, window));
  const heartSamples = inWindow.filter((sample) => sample.type === 'heartRate');
  const energySamples = inWindow.filter((sample) => sample.type === 'activeEnergy');

  // Проб в окне нет: ничего не меняем (ни событие, ни lastSyncAt).
  if (inWindow.length === 0) {
    return {
      ok: false,
      eventId: event.id,
      heartRate: null,
      heartRateMax: null,
      calories: null,
      source: null,
      reason: 'no_samples_in_window',
    };
  }

  const heartRate =
    heartSamples.length > 0 ? Math.round(mean(heartSamples.map((sample) => sample.value))) : null;
  const heartRateMax =
    heartSamples.length > 0
      // Колонка Int — округляем; для целых значений Apple Health max не меняется.
      ? Math.round(Math.max(...heartSamples.map((sample) => sample.value)))
      : null;

  let calories: number | null = null;
  let source: 'apple' | 'formula' = 'apple';
  if (energySamples.length > 0) {
    calories = Math.round(energySamples.reduce((sum, sample) => sum + sample.value, 0));
  } else {
    calories = caloriesFromHeartRate(event.eventType, event.duration);
    source = 'formula';
  }

  const data: Prisma.EventUpdateInput = {
    // heartRate/heartRateMax — только при ≥1 пробе heartRate в окне.
    ...(heartRate !== null ? { heartRate } : {}),
    ...(heartRateMax !== null ? { heartRateMax } : {}),
    ...(calories !== null ? { calories } : {}),
  };
  await prisma.event.update({ where: { id: event.id }, data });
  // Последняя синхронизация — на device-токене, при каждом успешном приёме.
  await prisma.deviceToken.update({
    where: { id: deviceToken.id },
    data: { lastSyncAt: new Date() },
  });

  return {
    ok: true,
    eventId: event.id,
    heartRate,
    heartRateMax,
    calories,
    source,
  };
}
