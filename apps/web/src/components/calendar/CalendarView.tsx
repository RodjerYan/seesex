/**
 * CalendarView — сетка месяца (неделя с понедельника), mobile-first.
 * Glass-редизайн (T-20261001-004/S4): день — glass-плитка rounded-xl,
 * «сегодня» — градиентная рамка pink→violet, выбранный — сплошной
 * bg-primary + glow (day-selected-glow) + scale-[1.04]; заголовок месяца —
 * крупный, с subtle brand-gradient по названию месяца.
 *
 * Статусы событий — цветные pill-полоски под числом (до 3 в ряд + «+N»):
 * occurred #EF4444, turndown #94A3B8, planned #8B5CF6.
 * compact (Dashboard): полоски есть, иконки типов нет. Иконки типов
 * (не-compact) и 4-й чип легенды — через eventMeta (lib/eventMeta, S1).
 * Данные: GET /api/events/calendar?from&to за видимый месяц (useCalendar).
 */
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState, type ReactElement } from 'react';

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

/** Круглая кнопка-стрелка навигации: тач-зона 48×48, hover/active/focus, touch-manipulation. */
const NAV_BTN =
  'flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 ' +
  'bg-white/[0.06] text-slate-300 transition-all ' +
  'hover:border-white/20 hover:bg-white/[0.12] hover:text-slate-50 ' +
  'active:scale-90 active:bg-white/[0.16] ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ' +
  'touch-manipulation';

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

  // Анимация смены месяца: направление слайда
  const [animDirection, setAnimDirection] = useState<'left' | 'right' | null>(null);

  // Touch-свайп для навигации по месяцам
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      shift(diff > 0 ? 1 : -1);
    }
  };

  // Если выбранная дата ушла в другой месяц — переключаемся на неё.
  useEffect(() => {
    if (!selectedDate) return;
    const date = new Date(`${selectedDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) return;
    setCursor((current) => {
      if (current.year === date.getFullYear() && current.month === date.getMonth()) {
        return current; // тот же объект — React не ре-рендерит
      }
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  }, [selectedDate]);

  // CAL-001: Используем dayKey + фиксированное время вместо toISOString()
  // чтобы избежать сдвига даты для TZ восточнее UTC
  const from = dayKey(new Date(cursor.year, cursor.month, 1)) + 'T00:00:00';
  const to = dayKey(new Date(cursor.year, cursor.month + 1, 0)) + 'T23:59:59';

  const { data, isLoading, isFetching, isError, error, refetch } = useCalendar(from, to, {
    placeholderData: (prev) => prev,
  });

  const days = new Map((data?.days ?? []).map((day) => [day.date, day.events]));
  const cells = monthGrid(cursor.year, cursor.month);
  const todayKey = dayKey(new Date());

  // CAL-002: Всегда показываем 6 недель (42 ячейки), убираем условную обрезку
  const displayCells = cells;

  const shift = (delta: number) => {
    setAnimDirection(delta > 0 ? 'left' : 'right');
    const next = addMonths(cursor.year, cursor.month, delta);
    setCursor(next);
    setTimeout(() => setAnimDirection(null), 250);
  };

  // «Сентябрь 2026» -> крупное «Сентябрь» + приглушённый «2026».
  const [monthName = monthLabel(cursor.year, cursor.month), yearName] = monthLabel(
    cursor.year,
    cursor.month,
  ).split(' ');

  const isCurrentMonth =
    cursor.year === new Date().getFullYear() && cursor.month === new Date().getMonth();

  // Клавиатурная навигация по сетке
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const currentIdx = displayCells.findIndex((d) => dayKey(d) === selectedDate);
    if (currentIdx === -1) return;
    let nextIdx = -1;
    switch (e.key) {
      case 'ArrowRight':
        nextIdx = currentIdx + 1;
        break;
      case 'ArrowLeft':
        nextIdx = currentIdx - 1;
        break;
      case 'ArrowDown':
        nextIdx = currentIdx + 7;
        break;
      case 'ArrowUp':
        nextIdx = currentIdx - 7;
        break;
      default:
        return;
    }
    e.preventDefault();
    if (nextIdx >= 0 && nextIdx < displayCells.length) {
      onSelectDate(dayKey(displayCells[nextIdx]));
    }
  };

  return (
    <div className="glass p-3">
      {/* Шапка: заголовок месяца + кнопка "Сегодня" + круглые стрелки 48px. */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="min-w-0 truncate text-xl font-bold leading-tight tracking-tight text-slate-50">
          <span className="brand-gradient">{monthName}</span>
          {yearName ? (
            <span className="ml-1.5 text-sm font-medium text-slate-400">{yearName}</span>
          ) : null}
        </h2>
        <div className="flex items-center gap-1.5">
          {!isCurrentMonth && (
            <button
              type="button"
              onClick={() =>
                setCursor({
                  year: new Date().getFullYear(),
                  month: new Date().getMonth(),
                })
              }
              className="rounded-full bg-primary/20 px-2.5 py-1 text-[11px] font-medium text-primary-400 transition-colors hover:bg-primary/30"
            >
              Сегодня
            </button>
          )}
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
      <div className="mb-0.5 grid grid-cols-7 gap-0.5 px-0.5 text-center">
        {WEEKDAYS.map((weekday) => (
          <span
            key={weekday}
            className="py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500"
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
        <div
          role="grid"
          aria-label={`Календарь на ${monthName} ${yearName}`}
          onKeyDown={handleKeyDown}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{ minHeight: 'calc(6 * 48px)' }}
          className={cx(
            'grid grid-cols-7 gap-0.5',
            animDirection === 'left' && 'animate-slide-left',
            animDirection === 'right' && 'animate-slide-right',
          )}
        >
          {displayCells.map((date) => {
            const key = dayKey(date);
            const events = days.get(key) ?? [];
            const inMonth = date.getMonth() === cursor.month;
            const isSelected = key === selectedDate;
            const isToday = key === todayKey;
            const types = [...new Set(events.flatMap((event) => event.eventTypes?.length ? event.eventTypes : [event.eventType]))].slice(0, 3);

            // CAL-009: Человекочитаемый aria-label
            const ariaLabel = `${date.getDate()} ${MONTHS_GEN[date.getMonth()]} ${date.getFullYear()}${
              isToday ? ', сегодня' : ''
            }${isSelected ? ', выбрано' : ''}${events.length > 0 ? `, ${events.length} событий` : ''}`;

            // CAL-010: Явная иерархия стилей: selected > today > inMonth > outside
            const cellStyle = isSelected
              ? 'day-selected-glow z-10 scale-[1.04] border-transparent bg-primary shadow-[0_0_16px_rgba(245,41,110,0.35)]'
              : isToday
                ? 'border-2 border-pink-400/50 bg-gradient-to-br from-[#FF6BA3]/15 to-[#E0B8FF]/10'
                : inMonth
                  ? 'border-transparent bg-white/[0.04] hover:bg-white/[0.08]'
                  : 'border-white/5 bg-white/[0.02]';

            return (
              <button
                key={key}
                type="button"
                role="gridcell"
                aria-label={ariaLabel}
                aria-selected={isSelected}
                aria-current={isToday ? 'date' : undefined}
                onClick={() => onSelectDate(key)}
                className={cx(
                  'relative flex min-h-[52px] flex-col items-center justify-start rounded-xl border px-0.5 pt-1.5',
                  'transition-all duration-200',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                  cellStyle,
                )}
              >
                {/* Число дня */}
                <span
                  className={cx(
                    'flex h-6 w-6 items-center justify-center rounded-full text-[13px] leading-none transition-colors',
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

                {/* Иконки типов — сразу под числом (только не-compact и в текущем месяце) */}
                {!compact && inMonth && types.length > 0 && (
                  <span className="mt-0.5 flex h-3 items-center gap-0.5" aria-hidden="true">
                    {types.map((type) => {
                      const { Icon } = eventMeta(type);
                      return <Icon key={type} className="h-3 w-3 text-slate-400" />;
                    })}
                  </span>
                )}

                {/* Полоски статусов — в самом низу ячейки (absolute) */}
                <span
                  className="pointer-events-none absolute inset-x-1 bottom-1 flex h-1 items-center justify-center gap-[2px]"
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
                    // CAL-006: +N — 10px, bg-white/10, rounded-full, text-slate-300
                    <span className="shrink-0 rounded-full bg-white/10 px-0.5 text-[10px] font-semibold leading-none text-slate-300">
                      +{events.length - 3}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Легенда: в compact — скрыта; в полном — <details><summary>Обозначения</summary> */}
      {!compact && (
        <details className="mt-2 border-t border-white/[0.08] pt-2">
          <summary className="cursor-pointer text-[11px] text-slate-500 select-none">
            Обозначения
          </summary>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <span className="flex items-center gap-1 rounded-full bg-white/[0.06] px-1.5 py-0.5">
              <span className={cx('h-1.5 w-1.5 rounded-full', STATUS_PILL.occurred)} aria-hidden="true" />
              состоялось
            </span>
            <span className="flex items-center gap-1 rounded-full bg-white/[0.06] px-1.5 py-0.5">
              <span className={cx('h-1.5 w-1.5 rounded-full', STATUS_PILL.turndown)} aria-hidden="true" />
              отказ
            </span>
            <span className="flex items-center gap-1 rounded-full bg-white/[0.06] px-1.5 py-0.5">
              <span className={cx('h-1.5 w-1.5 rounded-full', STATUS_PILL.planned)} aria-hidden="true" />
              запланировано
            </span>
            <span className="flex items-center gap-1 rounded-full bg-white/[0.06] px-1.5 py-0.5">
              <TYPE_LEGEND_ICON className="h-3 w-3 text-slate-300" aria-hidden="true" />
              тип
            </span>
          </div>
        </details>
      )}
    </div>
  );
}

// MONTHS_GEN нужен для aria-label — дублируем локально, чтобы не тянуть лишние импорты
const MONTHS_GEN = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];
