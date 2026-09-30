/**
 * Выбор периода для статистики: пресеты (всё время/30/90/365 дней) + свои даты.
 * Общий для StatisticsOverview и StatisticsCustom.
 */
import { type ReactElement } from 'react';

import { MS_PER_DAY } from '../../lib/format';
import type { StatsRange } from '../../lib/queries';
import { cx } from '../ui/controls';

export type RangePreset = 'all' | '30' | '90' | '365' | 'custom';

export interface RangeState {
  preset: RangePreset;
  /** YYYY-MM-DD (для preset=custom). */
  from: string;
  to: string;
}

export const DEFAULT_RANGE: RangeState = { preset: 'all', from: '', to: '' };

const PRESETS: { value: RangePreset; label: string }[] = [
  { value: 'all', label: 'Всё время' },
  { value: '30', label: '30 дней' },
  { value: '90', label: '90 дней' },
  { value: '365', label: 'Год' },
  { value: 'custom', label: 'Свои даты' },
];

function startOfDayIso(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function endOfDayIso(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** RangeState -> query-параметры from/to. */
export function rangeToStatsRange(state: RangeState): StatsRange {
  if (state.preset === 'all') return {};
  if (state.preset === 'custom') {
    return { from: startOfDayIso(state.from), to: endOfDayIso(state.to) };
  }
  const days = Number(state.preset);
  return { from: new Date(Date.now() - days * MS_PER_DAY).toISOString() };
}

export function RangePicker({
  value,
  onChange,
}: {
  value: RangeState;
  onChange: (next: RangeState) => void;
}): ReactElement {
  return (
    <div className="mb-4">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => onChange({ ...value, preset: preset.value })}
            className={cx(
              'rounded-full border px-3 py-1 text-xs transition-colors',
              value.preset === preset.value
                ? 'border-primary-400 bg-primary/10 text-primary-400'
                : 'border-slate-700 text-slate-400 hover:border-slate-600',
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {value.preset === 'custom' ? (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">С</span>
            <input
              type="date"
              value={value.from}
              max={value.to || undefined}
              onChange={(event) => onChange({ ...value, from: event.target.value })}
              className="w-full rounded-lg border border-slate-700 bg-white/[0.08] px-3 py-2 text-[16px] leading-5 text-slate-100 focus:border-primary-400 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">По</span>
            <input
              type="date"
              value={value.to}
              min={value.from || undefined}
              onChange={(event) => onChange({ ...value, to: event.target.value })}
              className="w-full rounded-lg border border-slate-700 bg-white/[0.08] px-3 py-2 text-[16px] leading-5 text-slate-100 focus:border-primary-400 focus:outline-none"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
