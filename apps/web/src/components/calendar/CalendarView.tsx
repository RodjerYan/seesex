/**
 * CalendarView — сетка месяца (неделя с понедельника), mobile-first.
 * Редизайн в духе Apple Calendar внутри тёмной glass-темы: крупный заголовок
 * месяца, круглые кнопки-стрелки (44px), акцентный выбранный день с glow,
 * контурной «сегодня», приглушённые дни чужих месяцев.
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

/** Круглая кнопка-стрелка навигации: тач-зона 44×44, hover/active/focus. */
const NAV_BTN =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 ' +
  'bg-white/[0.06] text-slate-300 transition-all ' +
  'hover:border-white/20 hover:bg-white/[0.12] hover:text-slate-50 ' +
  'active:scale-95 active:bg-white/[0.16] ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400';

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

  // «Сентябрь 2026» -> крупное «Сентябрь» + приглушённый «2026».
  const [monthName = monthLabel(cursor.year, cursor.month), yearName] = monthLabel(
    cursor.year,
    cursor.month,
  ).split(' ');

  return (
    <div className="glass p-4 sm:p-5">
      {/* Шапка: крупный заголовок месяца + круглые стрелки 44px. */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="min-w-0 truncate text-2xl font-bold leading-none tracking-tight text-slate-50">
          {monthName}
          {yearName ? (
            <span className="ml-1.5 text-base font-medium text-slate-400">{yearName}</span>
          ) : null}
        </h2>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Предыдущий месяц"
            onClick={() => shift(-1)}
            className={NAV_BTN}
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Следующий месяц"
            onClick={() => shift(1)}
            className={NAV_BTN}
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Дни недели: чистая типографика, приглушённая, но читаемая. */}
      <div className="mb-1 grid grid-cols-7 gap-1 px-0.5 text-center">
        {WEEKDAYS.map((weekday) => (
          <span
            key={weekday}
            className="py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500"
          >
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
                  'flex min-h-[44px] flex-col items-center justify-start gap-1 rounded-2xl px-0.5 py-1',
                  'transition-colors duration-150',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                  isSelected
                    ? 'day-selected-glow bg-primary/[0.10]'
                    : inMonth
                      ? 'hover:bg-white/[0.07] active:bg-white/[0.12]'
                      : 'hover:bg-white/[0.04] active:bg-white/[0.07]',
                )}
              >
                <span
                  className={cx(
                    'flex h-8 w-8 items-center justify-center rounded-full text-[13px] leading-none',
                    isSelected
                      ? 'bg-primary font-semibold text-white shadow-[0_0_14px_rgba(245,41,110,0.6)]'
                      : isToday
                        ? 'font-semibold text-primary-400 ring-1 ring-primary-400/50'
                        : inMonth
                          ? 'font-medium text-slate-100'
                          : 'font-normal text-slate-600',
                  )}
                >
                  {date.getDate()}
                </span>

                <span className="flex h-1.5 items-center justify-center gap-[3px]">
                  {events.slice(0, 3).map((event) => (
                    <span
                      key={event.id}
                      className={cx('h-1.5 w-1.5 rounded-full', STATUS_DOT[event.status])}
                    />
                  ))}
                </span>

                {!compact && inMonth && types.length > 0 ? (
                  <span className="flex h-3.5 items-center justify-center gap-1 text-slate-400">
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

      {/* Легенда: та же информация, аккуратнее. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-white/[0.08] pt-2.5 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden="true" /> состоялось
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" aria-hidden="true" /> отказ
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-500" aria-hidden="true" /> запланировано
        </span>
      </div>
    </div>
  );
}
