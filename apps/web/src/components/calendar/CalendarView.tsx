/**
 * CalendarView — сетка месяца (неделя с понедельника), mobile-first.
 * Glass-редизайн (T-20261001-004/S4): день — glass-плитка rounded-xl,
 * «сегодня» — градиентная рамка pink→violet, выбранный — сплошной
 * bg-primary + glow (day-selected-glow) + scale-105; заголовок месяца —
 * крупный, с subtle brand-gradient по названию месяца.
 *
 * Статусы событий — цветные pill-полоски под числом (до 3 в ряд + «+N»):
 * occurred #EF4444, turndown #94A3B8, planned #8B5CF6.
 * compact (Dashboard): полоски есть, иконки типов нет. Иконки типов
 * (не-compact) и 4-й чип легенды — через eventMeta (lib/eventMeta, S1).
 * Данные: GET /api/events/calendar?from&to за видимый месяц (useCalendar).
 */
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState, type ReactElement } from 'react';

import { useCalendar } from '../../lib/queries';
import {
  addMonths,
  dayKey,
  monthGrid,
  monthLabel,
} from '../../lib/format';
import { eventMeta } from '../../lib/eventMeta';
import type { CalendarStatus } from '../../types/api';
import { cx } from '../ui/controls';
import { ErrorBlock, LoadingBlock } from '../ui/states';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** Цвета pill-полосок статуса — в ячейке дня и в легенде (единый источник). */
const STATUS_PILL: Record<CalendarStatus, string> = {
  occurred: 'bg-[#EF4444]',
  turndown: 'bg-[#94A3B8]',
  planned: 'bg-[#8B5CF6]',
};

/** Иконка 4-го чипа легенды «тип» (только не-compact режим). */
const TYPE_LEGEND_ICON = eventMeta('SEX').Icon;

/** Круглая кнопка-стрелка навигации: тач-зона 44×44, hover/active/focus. */
const NAV_BTN =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 ' +
  'bg-white/[0.06] text-slate-300 transition-all ' +
  'hover:border-white/20 hover:bg-white/[0.12] hover:text-slate-50 ' +
  'active:scale-95 active:bg-white/[0.16] ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400';

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
      {/* Шапка: крупный заголовок месяца (brand-gradient) + круглые стрелки 44px. */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="min-w-0 truncate text-2xl font-bold leading-none tracking-tight text-slate-50">
          <span className="brand-gradient">{monthName}</span>
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
        /* key по году-месяцу: смена месяца проигрывает fade-in сетки (pure CSS). */
        <div
          key={`${cursor.year}-${cursor.month}`}
          className="grid grid-cols-7 gap-1 animate-[page-in_200ms_ease-out]"
        >
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
                  'relative flex min-h-[44px] flex-col items-center justify-start gap-1 rounded-xl border px-0.5 py-1',
                  'transition-all duration-200',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                  isSelected
                    ? 'day-selected-glow z-10 scale-105 border-transparent bg-primary'
                    : cx(
                        // «Сегодня»: градиентная рамка pink→violet поверх glass-подложки.
                        isToday
                          ? 'border-pink-400/50 bg-gradient-to-br from-[#FF6BA3]/20 to-[#E0B8FF]/15 ring-1 ring-pink-400/40'
                          : 'border-white/10',
                        'bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12]',
                      ),
                )}
              >
                <span
                  className={cx(
                    'flex h-8 w-8 items-center justify-center rounded-full text-[13px] leading-none transition-colors',
                    isSelected
                      ? 'font-semibold text-white'
                      : isToday
                        ? 'bg-white/10 font-semibold text-white'
                        : inMonth
                          ? 'font-medium text-slate-100'
                          : 'font-normal text-slate-600',
                  )}
                >
                  {date.getDate()}
                </span>

                {/* Полоски статусов: высота строки фиксирована — ритм сетки не плавает. */}
                <span
                  className="flex h-2.5 w-full items-center justify-start gap-[2px]"
                  aria-hidden="true"
                >
                  {events.slice(0, 3).map((event) => (
                    <span
                      key={event.id}
                      className={cx(
                        'h-1 w-3.5 min-w-[4px] shrink rounded-full',
                        STATUS_PILL[event.status],
                      )}
                    />
                  ))}
                  {events.length > 3 ? (
                    <span className="shrink-0 text-[9px] font-semibold leading-none text-slate-400">
                      +{events.length - 3}
                    </span>
                  ) : null}
                </span>

                {!compact && inMonth && types.length > 0 ? (
                  <span
                    className="flex h-3.5 items-center justify-center gap-1 text-slate-400"
                    aria-hidden="true"
                  >
                    {types.map((type) => {
                      const { Icon } = eventMeta(type);
                      return <Icon key={type} className="h-3 w-3" />;
                    })}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      {/* Легенда: чипы-плашки; не-compact — + 4-й чип с иконкой типа. */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-white/[0.08] pt-2.5 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2 py-1">
          <span className={cx('h-1.5 w-1.5 rounded-full', STATUS_PILL.occurred)} aria-hidden="true" />
          состоялось
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2 py-1">
          <span className={cx('h-1.5 w-1.5 rounded-full', STATUS_PILL.turndown)} aria-hidden="true" />
          отказ
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2 py-1">
          <span className={cx('h-1.5 w-1.5 rounded-full', STATUS_PILL.planned)} aria-hidden="true" />
          запланировано
        </span>
        {!compact ? (
          <span className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2 py-1">
            <TYPE_LEGEND_ICON className="h-3 w-3 text-slate-300" aria-hidden="true" />
            тип
          </span>
        ) : null}
      </div>
    </div>
  );
}
