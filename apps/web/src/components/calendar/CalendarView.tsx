/**
 * CalendarView — сетка месяца (неделя с понедельника), mobile-first.
 *
 * Точки статуса: 🔴 occurred (красная), ⚪ turndown (серая), 🟣 planned (фиолетовая).
 * Иконки типов событий — под датами. Клик по дню -> onSelectDate.
 * Данные: GET /api/events/calendar?from&to за видимый месяц (useCalendar).
 */
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  Flame,
  Hand,
  Heart,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState, type ReactElement } from 'react';

import { useCalendar } from '../../lib/queries';
import {
  addMonths,
  dayKey,
  monthGrid,
  monthLabel,
} from '../../lib/format';
import type { CalendarStatus } from '../../types/api';
import { cx } from '../ui/controls';
import { ErrorBlock, LoadingBlock } from '../ui/states';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const STATUS_DOT: Record<CalendarStatus, string> = {
  occurred: 'bg-red-500',
  turndown: 'bg-slate-400',
  planned: 'bg-violet-500',
};

/** Иконка типа события под датой. */
export function eventIcon(eventType: string): LucideIcon {
  const type = eventType.toUpperCase();
  if (type === 'TURNDOWN' || type === 'REFUSED') return Ban;
  if (type === 'SEX') return Heart;
  if (type === 'KISS') return Sparkles;
  if (type === 'MASSAGE' || type === 'TOUCH') return Hand;
  return Flame;
}

interface CalendarViewProps {
  /** Выбранная дата YYYY-MM-DD. */
  selectedDate: string;
  onSelectDate: (date: string) => void;
  /** Компактный режим (Dashboard): без иконок типов. */
  compact?: boolean;
}

export function CalendarView({
  selectedDate,
  onSelectDate,
  compact = false,
}: CalendarViewProps): ReactElement {
  const base = selectedDate ? new Date(`${selectedDate}T00:00:00`) : new Date();
  const [cursor, setCursor] = useState(() => ({
    year: base.getFullYear(),
    month: base.getMonth(),
  }));

  // Если выбранная дата ушла в другой месяц — переключаемся на неё.
  useEffect(() => {
    if (!selectedDate) return;
    const date = new Date(`${selectedDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) return;
    setCursor((current) =>
      current.year === date.getFullYear() && current.month === date.getMonth()
        ? current
        : { year: date.getFullYear(), month: date.getMonth() },
    );
  }, [selectedDate]);

  const from = new Date(cursor.year, cursor.month, 1).toISOString();
  const to = new Date(cursor.year, cursor.month + 1, 0, 23, 59, 59).toISOString();
  const { data, isLoading, isError, error, refetch } = useCalendar(from, to);

  const days = new Map((data?.days ?? []).map((day) => [day.date, day.events]));
  const cells = monthGrid(cursor.year, cursor.month);
  const todayKey = dayKey(new Date());

  const shift = (delta: number) => {
    const next = addMonths(cursor.year, cursor.month, delta);
    setCursor(next);
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Предыдущий месяц"
          onClick={() => shift(-1)}
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <p className="text-sm font-semibold text-slate-100">
          {monthLabel(cursor.year, cursor.month)}
        </p>
        <button
          type="button"
          aria-label="Следующий месяц"
          onClick={() => shift(1)}
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-[10px] font-medium uppercase text-slate-500">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday} className="py-1">
            {weekday}
          </span>
        ))}
      </div>

      {isLoading ? (
        <LoadingBlock label="Загрузка календаря…" />
      ) : isError ? (
        <ErrorBlock error={error} onRetry={() => void refetch()} />
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {cells.map((date) => {
            const key = dayKey(date);
            const events = days.get(key) ?? [];
            const inMonth = date.getMonth() === cursor.month;
            const isSelected = key === selectedDate;
            const isToday = key === todayKey;
            const types = [...new Set(events.map((event) => event.eventType))].slice(0, 2);

            return (
              <button
                key={key}
                type="button"
                aria-label={key}
                aria-pressed={isSelected}
                onClick={() => onSelectDate(key)}
                className={cx(
                  'flex min-h-[3rem] flex-col items-center justify-start rounded-lg px-0.5 py-1 transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                  inMonth ? 'text-slate-200' : 'text-slate-600',
                  isSelected
                    ? 'bg-primary/20 ring-1 ring-primary-400'
                    : 'hover:bg-slate-800',
                )}
              >
                <span
                  className={cx(
                    'flex h-6 w-6 items-center justify-center rounded-full text-xs',
                    isToday && !isSelected ? 'bg-slate-700 font-semibold' : '',
                  )}
                >
                  {date.getDate()}
                </span>

                <span className="mt-0.5 flex min-h-[4px] items-center justify-center gap-0.5">
                  {events.slice(0, 3).map((event) => (
                    <span
                      key={event.id}
                      className={cx('h-1.5 w-1.5 rounded-full', STATUS_DOT[event.status])}
                    />
                  ))}
                </span>

                {!compact && inMonth && types.length > 0 ? (
                  <span className="mt-0.5 flex items-center justify-center gap-0.5 text-slate-500">
                    {types.map((type) => {
                      const Icon = eventIcon(type);
                      return <Icon key={type} className="h-3 w-3" aria-hidden="true" />;
                    })}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-800 pt-2 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden="true" /> состоялось
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" aria-hidden="true" /> отказ
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-500" aria-hidden="true" /> запланировано
        </span>
      </div>
    </div>
  );
}
