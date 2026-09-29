/**
 * Журнал дат начала цикла (PeriodTracker).
 *
 * ВРЕМЕННОЕ РЕШЕНИЕ: CRUD-эндпоинта для записей цикла в API нет
 * (GET /api/statistics/periods умеет только читать periodTracking партнёров,
 * создать/изменить запись через API нельзя). Поэтому журнал храним локально
 * в localStorage; агрегаты (средняя длина цикла, прогноз) считаем сами.
 */

import { MS_PER_DAY, dayFromDate, dayKey } from './format';

export const PERIODS_STORAGE_KEY = 'xtracker.periods';

export interface PeriodRecord {
  id: string;
  /** YYYY-MM-DD — день начала. */
  startDate: string;
  /** YYYY-MM-DD — день окончания (опционально). */
  endDate: string | null;
  notes: string | null;
}

function newId(): string {
  if (typeof window !== 'undefined' && 'randomUUID' in window.crypto) {
    return window.crypto.randomUUID();
  }
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function readPeriods(): PeriodRecord[] {
  try {
    const raw = window.localStorage.getItem(PERIODS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is PeriodRecord => {
        if (typeof item !== 'object' || item === null) return false;
        const record = item as Partial<PeriodRecord>;
        return typeof record.id === 'string' && typeof record.startDate === 'string';
      })
      .sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
  } catch {
    return [];
  }
}

function writeAll(records: PeriodRecord[]): PeriodRecord[] {
  const sorted = [...records].sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
  try {
    window.localStorage.setItem(PERIODS_STORAGE_KEY, JSON.stringify(sorted));
  } catch {
    // Storage недоступен — состояние останется только в памяти сессии.
  }
  return sorted;
}

/** Добавляет запись; повторная дата начала игнорируется. */
export function addPeriod(input: {
  startDate: string;
  endDate?: string | null;
  notes?: string | null;
}): { records: PeriodRecord[]; added: boolean } {
  const records = readPeriods();
  if (records.some((record) => record.startDate === input.startDate)) {
    return { records, added: false };
  }
  const record: PeriodRecord = {
    id: newId(),
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    notes: input.notes ?? null,
  };
  return { records: writeAll([...records, record]), added: true };
}

export function updatePeriod(
  id: string,
  patch: Partial<Pick<PeriodRecord, 'endDate' | 'notes'>>,
): PeriodRecord[] {
  const records = readPeriods().map((record) =>
    record.id === id ? { ...record, ...patch } : record,
  );
  return writeAll(records);
}

export function removePeriod(id: string): PeriodRecord[] {
  return writeAll(readPeriods().filter((record) => record.id !== id));
}

/** Интервалы между соседними датами начала (дни), новые -> старые не важны. */
export function cycleLengths(records: PeriodRecord[]): number[] {
  const starts = [...records]
    .map((record) => record.startDate)
    .sort((a, b) => (a < b ? -1 : 1))
    .map(dayFromDate);
  const lengths: number[] = [];
  for (let i = 1; i < starts.length; i += 1) {
    lengths.push(Math.round((starts[i].getTime() - starts[i - 1].getTime()) / MS_PER_DAY));
  }
  return lengths;
}

export function averageCycleLength(records: PeriodRecord[]): number | null {
  const lengths = cycleLengths(records).filter((value) => value > 0 && value < 100);
  if (lengths.length === 0) return null;
  return Math.round((lengths.reduce((sum, value) => sum + value, 0) / lengths.length) * 10) / 10;
}

/** Прогноз следующего цикла: последняя дата + средняя длина (или 28 дней). */
export function forecastNextStart(records: PeriodRecord[]): string | null {
  if (records.length === 0) return null;
  const last = [...records].sort((a, b) => (a.startDate < b.startDate ? 1 : -1))[0];
  const average = averageCycleLength(records) ?? 28;
  const date = dayFromDate(last.startDate);
  date.setDate(date.getDate() + Math.round(average));
  return dayKey(date);
}
