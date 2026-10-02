// Общие типы/константы для api и web (каркас S1).

/** Типы событий календаря (цветовые точки в CalendarView). */
export type EventKind = 'SEX' | 'TURNDOWN' | 'PLANNED';

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}
