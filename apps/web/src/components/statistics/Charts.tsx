/**
 * Графики без внешних библиотек (чистый CSS/SVG): столбчатые и линейные бары.
 * Решение S5: recharts не подключаем — MVP-статистики хватает CSS-барам.
 */
import type { ReactElement } from 'react';

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
            <span className="pointer-events-none absolute -top-5 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-white/[0.08] backdrop-blur-md border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-200 group-hover:block group-active:block">
              {valueLabel ? valueLabel(item.value) : item.value}
            </span>
            <div
              className="w-full rounded-t bg-primary/70 animate-grow-up transition-colors group-hover:bg-primary group-active:bg-primary"
              style={{ height: `${Math.max(2, ratio * 100)}%`, animationDelay: `${index * 40}ms` }}
              title={item.hint ?? `${item.label}: ${item.value}`}
            />
            <span className="mt-1 truncate text-center text-[9px] text-slate-500">{item.label}</span>
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
            <span className="truncate text-slate-300">{item.label}</span>
            <span className="shrink-0 tabular-nums text-slate-400">
              {item.value}
              {suffix ?? ''}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-primary-400/80 animate-grow-up"
              style={{ width: `${Math.max(3, (item.value / max) * 100)}%`, transformOrigin: 'left', animationDelay: `${index * 40}ms` }}
              title={item.hint}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Плитка KPI. */
export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}): ReactElement {
  return (
    // !rounded-2xl — перебивает border-radius:32px из .glass (плитка не должна быть pill)
    <div className="glass !rounded-2xl p-2.5 flex flex-col gap-1">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-slate-100 -mt-0.5">{value}</p>
      {hint ? <p className="text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}