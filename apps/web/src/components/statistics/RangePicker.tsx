/**
 * Выбор периода для статистики: пресеты (всё время/30/90/365 дней) + свои даты.
 * Общий для StatisticsOverview и StatisticsCustom.
 * S1 «Премиальный нуар»: активный пресет — rose-пилюля (primary tint + ring),
 * неактивные — ghost (elev2 + hairline); панель своих дат — Card-слой
 * (elev1 + hairline), поля — Field/Input. Логика выбора (preset/from/to,
 * min/max, onChange) не меняется.
 */
import { type ReactElement } from 'react';

import { MS_PER_DAY } from '../../lib/format';
import type { StatsRange } from '../../lib/queries';
import { cx, Field, Input } from '../ui/controls';

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
              // S8: тап-зона ≥40px сохранена. На мобильном чипы делят строку
              // пополам, «Свои даты» растягивается на всю строку — без кривой
              // одиночной пилюли в углу; на sm+ — компактные по контенту.
              'inline-flex min-h-[40px] grow basis-[calc(50%_-_0.25rem)] items-center justify-center whitespace-nowrap rounded-full px-3 text-[13px] font-medium transition-colors sm:grow-0 sm:basis-auto',
              value.preset === preset.value
                ? 'bg-primary/[0.16] text-primary-400 ring-1 ring-inset ring-primary/30'
                : 'bg-elev-2 text-ink-muted ring-1 ring-inset ring-white/[0.08] hover:bg-elev-3 hover:text-ink',
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {value.preset === 'custom' ? (
        <div className="glass mt-3 rounded-tile p-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="-mb-4">
              <Field label="С" htmlFor="stats-range-from">
                <Input
                  id="stats-range-from"
                  type="date"
                  value={value.from}
                  max={value.to || undefined}
                  onChange={(event) => onChange({ ...value, from: event.target.value })}
                />
              </Field>
            </div>
            <div className="-mb-4">
              <Field label="По" htmlFor="stats-range-to">
                <Input
                  id="stats-range-to"
                  type="date"
                  value={value.to}
                  min={value.from || undefined}
                  onChange={(event) => onChange({ ...value, to: event.target.value })}
                />
              </Field>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
