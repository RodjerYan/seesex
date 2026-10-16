/**
 * Графики без внешних библиотек (чистый CSS/SVG): столбчатые и линейные бары.
 * Решение S5: recharts не подключаем — MVP-статистики хватает CSS-барам.
 * S1 «Премиальный нуар»: тултип — solid elev3 + hairline (без backdrop-blur),
 * подписи осей text-ink-dim ≥11px, плитка StatTile — вложенный тайл elev2,
 * числовые метрики — display/tabular-nums.
 */
import type { ReactElement } from 'react';

import { cx } from '../ui/controls';

export interface ChartItem {
  label: string;
  value: number;
  hint?: string;
}

/**
 * Вертикальные столбцы (частота по месяцам).
 *
 * Мало данных (1–3 месяца): у колонки есть `max-w-[48px]`, поэтому она не
 * растягивается на всю ширину — столбцы компактные и центрируются
 * (`justify-center` на контейнере), а не превращаются в сплошную плашку.
 * Много данных (6–12+ месяцев): `flex-1` упирается в max-w раньше, чем
 * закончится ширина контейнера, распределение остаётся равномерным.
 */
export function ColumnBars({
  items,
  height = 120,
  valueLabel,
}: {
  items: ChartItem[];
  height?: number;
  valueLabel?: (value: number) => string;
}): ReactElement {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <div
      className="flex items-end justify-center gap-1.5"
      style={{ height }}
      role="img"
      aria-label="Столбчатая диаграмма"
    >
      {items.map((item, index) => {
        const ratio = item.value / max;
        return (
          <div
            key={`${item.label}-${index}`}
            className="group relative flex h-full min-w-0 max-w-[48px] flex-1 flex-col justify-end"
          >
            {/* S8: тултип и подпись оси ≥11px (было 10/9px) — читаемость на мобильном.
                S1: solid elev3 + hairline + тень вместо blur-подложки. */}
            <span className="pointer-events-none absolute -top-5 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/[0.08] bg-elev-3 px-2 py-0.5 text-[11px] text-ink shadow-[0_4px_16px_rgba(0,0,0,0.5)] group-hover:block group-active:block">
              {valueLabel ? valueLabel(item.value) : item.value}
            </span>
            <div
              className="bar-intimate w-full rounded-t animate-grow-up group-hover:brightness-110 group-active:brightness-95"
              style={{ height: `${Math.max(2, ratio * 100)}%`, animationDelay: `${index * 40}ms` }}
              title={item.hint ?? `${item.label}: ${item.value}`}
            />
            <span className="mt-1 truncate text-center text-[11px] text-ink-dim">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Горизонтальные бары (топы партнёров/позиций, распределение оценок). */
export function RowBars({ items, suffix }: { items: ChartItem[]; suffix?: string }): ReactElement {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={`${item.label}-${index}`}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
            <span className="truncate text-ink-muted">{item.label}</span>
            <span className="shrink-0 tabular-nums text-ink">
              {item.value}
              {suffix ?? ''}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className="bar-intimate h-full rounded-full animate-grow-x"
              style={{ width: `${Math.max(3, (item.value / max) * 100)}%`, animationDelay: `${index * 40}ms` }}
              title={item.hint}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Плитка KPI (вложенный тайл: elev2 + hairline, радиус 16), число — display/tabular-nums.
 * Пустое значение («—») — приглушённый прочерк + подпись «нет данных»;
 * длинные значения (диапазоны дат) не влезают в display-кегль — компактный кегль.
 */
export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}): ReactElement {
  const empty = value === '' || value === '—';
  // «12 сентября 2026 — 16 октября 2026» display-кеглем в узкой плитке
  // переносится на 4 строки и «ломает» карточку — переводим в 15px.
  const compact = !empty && value.length > 12;
  const valueClass = empty
    ? 'type-display text-ink-dim'
    : compact
      ? 'text-[15px] font-semibold leading-5 tabular-nums text-ink'
      : 'type-display text-ink';
  return (
    <div className="rounded-tile bg-elev-2 p-3 ring-1 ring-white/[0.08]">
      <p className={cx('break-words', valueClass)}>{value}</p>
      <p className="type-label mt-1 text-ink-dim">{label}</p>
      {hint || empty ? (
        <p className="mt-1 text-[13px] text-ink-muted">{hint ?? 'нет данных'}</p>
      ) : null}
    </div>
  );
}