/**
 * CalendarView — сетка месяца (неделя с понедельника), mobile-first.
 * Glass-редизайн (T-20261001-004/S4): день — glass-плитка rounded-xl,
 * «сегодня» — тонкая pink-рамка + мягкое гало на круге числа (B1),
 * выбранный — сплошной bg-primary + glow (day-selected-glow) + scale-[1.04];
 * строка недели с сегодняшним днём — тонкий фон-бэнд, выходные числа —
 * brand-tint; заголовок месяца — крупный, с subtle brand-gradient по названию.
 *
 * Статусы событий — один сегментный бар под числом (B2): полоска во всю
 * ширину ячейки, сегменты пропорционально количеству событий каждого
 * статуса, «+N» справа при 4+ событиях:
 * occurred #EF4444, turndown #94A3B8, planned #8B5CF6.
 * compact (Dashboard): бар есть, иконки типов нет. Иконки типов
 * (не-compact) и 4-й чип легенды — через eventMeta (lib/eventMeta, S1).
 * Данные: GET /api/events/calendar?from&to за видимый месяц (useCalendar).
 *
 * B4 (T-20261005-005): долгий тап (≥350ms) на день с событиями —
 * компактный glass-тултип со списком событий (точка статуса из
 * STATUS_PILL, максимум 5 строк + «+N ещё»); тап по заголовку месяца —
 * мини-пикер 12 месяцев года курсора (3×4, glass-фон, overlay/Esc).
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
import type { CalendarDayEvent, CalendarStatus } from '../../types/api';
import { cx } from '../ui/controls';
import { ErrorBlock, LoadingBlock } from '../ui/states';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** Цвета сегментов бара статуса — в ячейке дня и в легенде (единый источник). */
const STATUS_PILL: Record<CalendarStatus, string> = {
  occurred: 'bg-[#EF4444]',
  turndown: 'bg-[#94A3B8]',
  planned: 'bg-[#8B5CF6]',
};

/** Порядок сегментов бара и чипов легенды — как в STATUS_PILL (порядок ключей = порядок вставки). */
const STATUS_ORDER = Object.keys(STATUS_PILL) as CalendarStatus[];

/** Иконка 4-го чипа легенды «тип» (только не-compact режим). */
const TYPE_LEGEND_ICON = eventMeta('SEX').Icon;

/** B4: long-press превью — время удержания и порог сдвига пальца для отмены. */
const LONG_PRESS_MS = 350;
const LONG_PRESS_SLOP_PX = 10;

/** B4: тултип превью — максимум ширины и строк списка (+N ещё при переполнении). */
const TOOLTIP_MAX_W = 240;
const TOOLTIP_MAX_ROWS = 5;

/** B4: мини-пикер месяца — сокращения месяцев для сетки 3×4 (янв…дек). */
const MONTHS_SHORT = [
  'Янв',
  'Фев',
  'Мар',
  'Апр',
  'Май',
  'Июн',
  'Июл',
  'Авг',
  'Сен',
  'Окт',
  'Ноя',
  'Дек',
];

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

/** B4: открытый тултип long-press — координаты относительно .glass-контейнера. */
interface LongPressPreview {
  /** Ключ дня YYYY-MM-DD (для aria-label). */
  key: string;
  events: CalendarDayEvent[];
  /** Центр тултипа по X (элемент рендерится с -translate-x-1/2). */
  left: number;
  /** true — тултип над ячейкой (нижние строки), false — под ней. */
  above: boolean;
  /** Отступ от края контейнера (top/bottom) в px. */
  offset: number;
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

  // ===== B4: long-press превью событий дня + мини-пикер месяца =====
  // Таймер удержания живёт на ячейке; сеточный свайп не трогаем: оба
  // обработчика всплывают. Конфликт решён порогами — сдвиг >10px отменяет
  // long-press (палец «ушёл»), сдвиг >50px по-прежнему ловит grid как свайп.
  const rootRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const lpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lpStartRef = useRef<{ x: number; y: number } | null>(null);
  const lpRectRef = useRef<DOMRect | null>(null);
  const [longPress, setLongPress] = useState<LongPressPreview | null>(null);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);

  const clearLongPressTimer = () => {
    if (lpTimerRef.current !== null) {
      clearTimeout(lpTimerRef.current);
      lpTimerRef.current = null;
    }
  };

  /** Показать тултип: координаты ячейки пересчитываем в систему .glass-контейнера. */
  const showLongPressPreview = (key: string, events: CalendarDayEvent[]) => {
    const rect = lpRectRef.current;
    const rootRect = rootRef.current?.getBoundingClientRect();
    if (!rect || !rootRect || events.length === 0) return;
    // Прижимаем к краям контейнера (запас 6px), иначе центр по ячейке.
    const half = TOOLTIP_MAX_W / 2;
    const minLeft = Math.min(half + 6, rootRect.width / 2);
    const maxLeft = Math.max(rootRect.width - half - 6, rootRect.width / 2);
    const center = rect.left - rootRect.left + rect.width / 2;
    // Нижние строки сетки — тултип над ячейкой, верхние — под ней,
    // чтобы не вылезать за шапку/легенду карточки.
    const above = rect.top - rootRect.top >= rootRect.height / 2;
    setLongPress({
      key,
      events,
      left: Math.min(Math.max(center, minLeft), maxLeft),
      above,
      offset: above ? rootRect.bottom - rect.top + 6 : rect.bottom - rootRect.top + 6,
    });
  };

  const handleCellTouchStart = (
    e: React.TouchEvent<HTMLButtonElement>,
    key: string,
    events: CalendarDayEvent[],
  ) => {
    clearLongPressTimer();
    if (events.length === 0) return; // превью только для дня, где есть события
    const touch = e.touches[0];
    if (!touch) return;
    lpStartRef.current = { x: touch.clientX, y: touch.clientY };
    lpRectRef.current = e.currentTarget.getBoundingClientRect();
    lpTimerRef.current = setTimeout(() => {
      lpTimerRef.current = null;
      showLongPressPreview(key, events);
    }, LONG_PRESS_MS);
  };

  const handleCellTouchMove = (e: React.TouchEvent<HTMLButtonElement>) => {
    if (lpTimerRef.current === null || !lpStartRef.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    if (
      Math.abs(touch.clientX - lpStartRef.current.x) > LONG_PRESS_SLOP_PX ||
      Math.abs(touch.clientY - lpStartRef.current.y) > LONG_PRESS_SLOP_PX
    ) {
      clearLongPressTimer(); // палец сдвинулся >10px — long-press отменён
    }
  };

  // Таймер long-press не должен пережить размонтирование.
  useEffect(
    () => () => {
      if (lpTimerRef.current !== null) clearTimeout(lpTimerRef.current);
    },
    [],
  );

  // Смена месяца (стрелки/свайп/«Сегодня»/пикер) закрывает превью long-press.
  useEffect(() => {
    setLongPress(null);
  }, [cursor]);

  // Закрытие попапов по тапу мимо. Слушатель живёт, пока открыт хотя бы
  // один попап (тултип или пикер). pointerdown (capture) — раньше React-
  // обработчиков, чтобы закрытие не мешало click/select.
  useEffect(() => {
    if (!longPress && !monthPickerOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (longPress && !tooltipRef.current?.contains(target)) {
        clearLongPressTimer(); // REWORK: таймер не должен открыть тултип после закрытия
        setLongPress(null);
      }
      if (monthPickerOpen && !pickerRef.current?.contains(target)) setMonthPickerOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [longPress, monthPickerOpen]);

  // Esc закрывает пикер месяца.
  useEffect(() => {
    if (!monthPickerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMonthPickerOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [monthPickerOpen]);

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

  const { data, isLoading, isError, error, refetch } = useCalendar(from, to, {
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

  // B4: выбор месяца в пикере — год не переключаем (всегда год курсора).
  const pickMonth = (month: number) => {
    setMonthPickerOpen(false);
    setCursor((current) => (current.month === month ? current : { year: current.year, month }));
  };

  // «Сентябрь 2026» -> крупное «Сентябрь» + приглушённый «2026».
  const [monthName = monthLabel(cursor.year, cursor.month), yearName] = monthLabel(
    cursor.year,
    cursor.month,
  ).split(' ');

  const isCurrentMonth =
    cursor.year === new Date().getFullYear() && cursor.month === new Date().getMonth();

  // week-band: индекс строки (7 ячеек) с сегодняшним днём — только когда
  // сегодняшний месяц отображается (в иной месяц сегодня в сетке не попадает).
  const todayIdx = isCurrentMonth ? displayCells.findIndex((d) => dayKey(d) === todayKey) : -1;
  const weekRowToday = todayIdx === -1 ? -1 : Math.floor(todayIdx / 7);

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
    <div ref={rootRef} className="glass p-3">
      {/* B4: overlay пикера месяца — только визуальный маркер слоя; реальное
          закрытие по тапу мимо делает document-listener (pointerdown capture),
          поэтому pointer-events-none: кнопки шапки («Сегодня»/стрелки) и сетка
          остаются кликабельными поверх (z-10 ниже пикера z-20). */}
      {monthPickerOpen && (
        <div className="pointer-events-none absolute inset-0 z-10" aria-hidden="true" />
      )}

      {/* Шапка: кнопка-заголовок месяца (B4 — открывает пикер) + "Сегодня" + круглые стрелки 48px.
          -ml-1 висит на h2, НЕ на кнопке (T-20261005-006): на кнопке он урезал
          max-w-full на 4px и truncate обрезал год — «Октябрь 2...». */}
      <div className="relative mb-2 flex items-center justify-between gap-2">
        <h2 className="-ml-1 min-w-0 text-xl font-bold leading-tight tracking-tight text-slate-50">
          <button
            type="button"
            onClick={() => setMonthPickerOpen((open) => !open)}
            aria-expanded={monthPickerOpen}
            aria-controls="cal-month-picker"
            className="block max-w-full truncate rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            <span className="brand-gradient">{monthName}</span>
            {yearName ? (
              <span className="ml-1.5 text-sm font-medium text-slate-400">{yearName}</span>
            ) : null}
          </button>
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

        {/* B4: мини-пикер месяца — 12 месяцев ГОДА КУРСОРА (3×4), под шапкой.
            Всегда смонтирован: закрыт — invisible + opacity-0 (не фокусируется,
            скрыт для SR), открыт — fade через transition-opacity (глобальный
            prefers-reduced-motion guard в index.css гасит transition). */}
        <div
          ref={pickerRef}
          id="cal-month-picker"
          className={cx(
            'absolute left-0 top-full z-20 mt-1.5 w-full rounded-xl border border-white/15',
            // Непрозрачный тёмный фон (T-20261005-006): bg-white/[0.12] просвечивал —
            // числа сетки читались сквозь пикер. Тёмный solid + blur как у модалок.
            'bg-[#12141C]/95 p-2 shadow-[0_12px_32px_rgba(0,0,0,0.45)] backdrop-blur-md',
            'transition-opacity duration-150',
            monthPickerOpen ? 'opacity-100' : 'pointer-events-none invisible opacity-0',
          )}
        >
          <div role="group" aria-label={`Месяцы ${cursor.year}`} className="grid grid-cols-4 gap-1">
            {MONTHS_SHORT.map((label, month) => {
              const isCursorMonth = month === cursor.month;
              const isTodayMonth =
                todayKey.startsWith(`${cursor.year}-${String(month + 1).padStart(2, '0')}`);
              return (
                <button
                  key={month}
                  type="button"
                  onClick={() => pickMonth(month)}
                  aria-current={isCursorMonth ? 'true' : undefined}
                  className={cx(
                    'rounded-lg px-1 py-1.5 text-[11px] font-semibold leading-none transition-colors',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                    isTodayMonth
                      ? 'bg-primary/20 text-primary-400'
                      : 'text-slate-300 hover:bg-white/[0.08] hover:text-slate-50',
                    isCursorMonth && 'ring-1 ring-primary-400',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
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
          key={`${cursor.year}-${cursor.month}`}
          role="grid"
          aria-label={`Календарь на ${monthName} ${yearName}`}
          onKeyDown={handleKeyDown}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{ minHeight: 'calc(6 * 48px)' }}
          className={cx(
            'grid grid-cols-7 gap-0.5',
            animDirection === 'left' && 'animate-cal-in-left',
            animDirection === 'right' && 'animate-cal-in-right',
          )}
        >
          {displayCells.map((date, index) => {
            const key = dayKey(date);
            const events = days.get(key) ?? [];
            const inMonth = date.getMonth() === cursor.month;
            const isSelected = key === selectedDate;
            const isToday = key === todayKey;
            // Выходной в текущем месяце (Сб/Вс) — тонированный цвет числа.
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            // Ячейка строки «сегодня» (фон-бэнд всей недели).
            const inWeekBand = weekRowToday !== -1 && Math.floor(index / 7) === weekRowToday;
            const types = [...new Set(events.flatMap((event) => event.eventTypes?.length ? event.eventTypes : [event.eventType]))].slice(0, 3);
            // B2: счётчики статусов — пропорции сегментов бара (2 occurred + 1 planned → 2:1).
            const statusCounts: Record<CalendarStatus, number> = {
              occurred: 0,
              turndown: 0,
              planned: 0,
            };
            for (const event of events) statusCounts[event.status] += 1;

            // CAL-009: Человекочитаемый aria-label
            const ariaLabel = `${date.getDate()} ${MONTHS_GEN[date.getMonth()]} ${date.getFullYear()}${
              isToday ? ', сегодня' : ''
            }${isSelected ? ', выбрано' : ''}${events.length > 0 ? `, ${events.length} событий` : ''}`;

            // CAL-010: Явная иерархия стилей: selected > today > inMonth > outside
            // Ниже всего — week-band (фон строки «сегодня»): только для ячеек
            // ТЕКУЩЕГО месяца без собственного акцентного фона (не selected /
            // не today); вне-месячные ячейки бэнд не получают (REWORK #1).
            const cellStyle = isSelected
              ? 'day-selected-glow z-10 scale-[1.04] border-transparent bg-primary shadow-[0_0_16px_rgba(245,41,110,0.35)]'
              : isToday
                ? 'border border-pink-400/30'
                : inWeekBand && inMonth
                  ? 'border-transparent bg-white/[0.03] hover:bg-white/[0.06]'
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
                onTouchStart={(e) => handleCellTouchStart(e, key, events)}
                onTouchMove={handleCellTouchMove}
                onTouchEnd={clearLongPressTimer}
                onTouchCancel={clearLongPressTimer}
                className={cx(
                  // select-none: долгий тап не должен запускать выделение текста (B4)
                  'relative flex min-h-[52px] flex-col items-center justify-start rounded-xl border px-0.5 pt-1.5 select-none',
                  'transition-all duration-200',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                  cellStyle,
                )}
              >
                {/* Число дня: tabular-nums, вес/цвет по иерархии selected > today > inMonth > outside.
                    B3: stagger-проявление (opacity + сдвиг 4px) — задержка inline,
                    только на числовом span, бар/гало/бэнд не анимируются. */}
                <span
                  className={cx(
                    'tabular-nums flex h-6 w-6 items-center justify-center rounded-full text-[13px] leading-none transition-colors',
                    'animate-cal-cell',
                    isSelected
                      ? 'font-semibold text-white'
                      : isToday
                        ? 'bg-white/10 font-semibold text-white shadow-[0_0_12px_rgba(255,107,163,0.45)]'
                        : inMonth
                          ? isWeekend
                            ? 'font-medium text-primary-400/70'
                            : 'font-medium text-slate-100'
                          : 'font-normal text-slate-600/60',
                  )}
                  style={{ animationDelay: `${index * 35}ms` }}
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

                {/* B2: сегментный бар статусов — одна полоска во всю ширину внизу
                    ячейки (absolute), сегменты пропорционально count каждого
                    статуса; подложка: bg-white/10 на обычных плитках, bg-black/20
                    на выбранном дне (на bg-primary белая подложка вымывала
                    контраст — REWORK #1). Пустой день — ничего не рисуем. */}
                {events.length > 0 && (
                  <span
                    className="pointer-events-none absolute inset-x-1 bottom-1 flex h-1 items-center gap-1"
                    aria-hidden="true"
                  >
                    <span
                      className={cx(
                        'flex h-1 min-w-0 flex-1 overflow-hidden rounded-full',
                        isSelected ? 'bg-black/20' : 'bg-white/10',
                      )}
                    >
                      {STATUS_ORDER.map((status) =>
                        statusCounts[status] > 0 ? (
                          <span
                            key={status}
                            className={cx('h-full', STATUS_PILL[status])}
                            style={{ flexGrow: statusCounts[status] }}
                          />
                        ) : null,
                      )}
                    </span>
                    {events.length > 3 ? (
                      // CAL-006: +N — 10px, bg-white/10, rounded-full, text-slate-300
                      // (bar flex-1, бейдж shrink-0 — на узкой ячейке не переполняется)
                      <span className="shrink-0 rounded-full bg-white/10 px-0.5 text-[10px] font-semibold leading-none text-slate-300">
                        +{events.length - 3}
                      </span>
                    ) : null}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* B4: long-press превью событий дня — компактный glass-тултип рядом с
          ячейкой (координаты пересчитаны в showLongPressPreview). Вне grid —
          не влияет на свайп, key и строки сетки. pointer-events-none: тап
          «сквозь» тултип попадает в ячейку (выбор дня + закрытие превью). */}
      {longPress && (
        <div
          ref={tooltipRef}
          role="tooltip"
          aria-label={dayAriaLabel(longPress.key)}
          style={
            longPress.above
              ? { left: longPress.left, bottom: longPress.offset }
              : { left: longPress.left, top: longPress.offset }
          }
          className="pointer-events-none absolute z-20 w-max max-w-[240px] -translate-x-1/2 rounded-lg border border-white/15 bg-[#12141C]/95 p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-md"
        >
          <ul className="flex flex-col gap-0.5">
            {longPress.events.slice(0, TOOLTIP_MAX_ROWS).map((event) => (
              <li key={event.id} className="flex items-center gap-1.5 px-1 py-0.5">
                <span
                  className={cx('h-1.5 w-1.5 shrink-0 rounded-full', STATUS_PILL[event.status])}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate text-[11px] leading-tight text-slate-200">
                  {event.title?.trim() || eventMeta(event.eventType).label}
                </span>
              </li>
            ))}
          </ul>
          {longPress.events.length > TOOLTIP_MAX_ROWS ? (
            <div className="px-1 pt-1 text-[11px] font-semibold leading-none text-slate-400">
              +{longPress.events.length - TOOLTIP_MAX_ROWS} ещё
            </div>
          ) : null}
        </div>
      )}

      {/* Легенда (B2): фиксированный ряд из 4 чипов вместо <details>/<summary>,
          виден всегда; в compact — скрыт. Строка разделителя — border-t. */}
      {!compact && (
        <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-white/[0.08] pt-2">
          <span className="flex items-center gap-1 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px]">
            <span className={cx('h-1.5 w-1.5 rounded-full', STATUS_PILL.occurred)} aria-hidden="true" />
            состоялось
          </span>
          <span className="flex items-center gap-1 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px]">
            <span className={cx('h-1.5 w-1.5 rounded-full', STATUS_PILL.turndown)} aria-hidden="true" />
            отказ
          </span>
          <span className="flex items-center gap-1 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px]">
            <span className={cx('h-1.5 w-1.5 rounded-full', STATUS_PILL.planned)} aria-hidden="true" />
            запланировано
          </span>
          <span className="flex items-center gap-1 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px]">
            <TYPE_LEGEND_ICON className="h-3 w-3 text-slate-300" aria-hidden="true" />
            тип
          </span>
        </div>
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

/** B4: «События: 5 октября» — aria-label для тултипа long-press (ключ YYYY-MM-DD). */
function dayAriaLabel(key: string): string {
  const date = new Date(`${key}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'События дня';
  return `События: ${date.getDate()} ${MONTHS_GEN[date.getMonth()]}`;
}
