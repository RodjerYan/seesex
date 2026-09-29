// Общие типы/константы для api и web (каркас S1).

/** Категории системного каталога позиций (должны совпадать с prisma/positions-catalog.ts). */
export const POSITION_CATEGORIES = [
  'STANDARD',
  'ORAL',
  'ANAL',
  'KINKY',
  'BDSM',
  'ROLEPLAY',
  'FANTASY',
  'EXOTIC',
] as const;

export type PositionCategory = (typeof POSITION_CATEGORIES)[number];

/** Типы событий календаря (цветовые точки в CalendarView). */
export type EventKind = 'SEX' | 'TURNDOWN' | 'PLANNED';

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}
