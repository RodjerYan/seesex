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

/** Вертикальные столбцы (частота по месяцам). */
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
    <div className="flex items-end gap-1.5" style={{ height }} role="img" aria-label="Столбчатая диаграмма">
      {items.map((item, index) => {
        const ratio = item.value / max;
        return (
          <div key={`${item.label}-${index}`} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end">
            <span className="pointer-events-none absolute -top-5 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-200 group-hover:block">
              {valueLabel ? valueLabel(item.value) : item.value}
            </span>
            <div
              className="w-full rounded-t bg-primary/70 transition-colors group-hover:bg-primary"
              style={{ height: `${Math.max(2, ratio * 100)}%` }}
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
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-primary-400/80"
              style={{ width: `${Math.max(3, (item.value / max) * 100)}%` }}
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
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-100">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}
