import { ArrowLeft } from 'lucide-react';
import { useMemo, useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { RowBars, StatTile } from '../components/statistics/Charts';
import {
  DEFAULT_RANGE,
  RangePicker,
  rangeToStatsRange,
  type RangeState,
} from '../components/statistics/RangePicker';
import { Card, SectionTitle } from '../components/ui/controls';
import { ErrorBlock, LoadingBlock } from '../components/ui/states';
import { formatDate } from '../lib/format';
import { useCustomStats, useGroupCalendars } from '../lib/queries';
import { eventTypeLabel } from '../lib/eventTypeLabels';

/** Расширенная статистика: произвольный период + фильтр по групповым календарям. */
export default function StatisticsCustom(): ReactElement {
  const [range, setRange] = useState<RangeState>({ ...DEFAULT_RANGE, preset: '90' });
  const [groupIds, setGroupIds] = useState<string[]>([]);

  const calendarsQuery = useGroupCalendars();
  const params = useMemo(() => {
    const base = rangeToStatsRange(range);
    return groupIds.length > 0 ? { ...base, groupIds: groupIds.join(',') } : base;
  }, [range, groupIds]);

  const statsQuery = useCustomStats(params);

  const toggleGroup = (id: string): void => {
    setGroupIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  return (
    <section className="px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center gap-3">
        <Link
          to="/statistics"
          aria-label="Назад к статистике"
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-100"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <h1 className="text-lg font-bold tracking-tight text-slate-100">
          Расширенная статистика
        </h1>
      </div>

      <RangePicker value={range} onChange={setRange} />

      <Card className="mb-4">
        <SectionTitle>Групповые календари</SectionTitle>
        <p className="mb-2 text-xs text-slate-500">
          Выберите группы — попадут только их события (включая чужие, если это общий календарь).
          Ничего не выбрано — считаются только ваши события.
        </p>
        {calendarsQuery.isLoading ? (
          <LoadingBlock label="Загрузка календарей…" />
        ) : (calendarsQuery.data ?? []).length === 0 ? (
          <p className="text-xs text-slate-500">Групповых календарей пока нет.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(calendarsQuery.data ?? []).map((calendar) => {
              const active = groupIds.includes(calendar.id);
              return (
                <button
                  key={calendar.id}
                  type="button"
                  onClick={() => toggleGroup(calendar.id)}
                  className={
                    active
                      ? 'rounded-full border border-primary-400 bg-primary/10 px-3 py-1 text-xs text-primary-400'
                      : 'rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400'
                  }
                >
                  {calendar.name}
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {statsQuery.isLoading ? (
        <LoadingBlock label="Считаем статистику…" />
      ) : statsQuery.isError ? (
        <ErrorBlock error={statsQuery.error} onRetry={() => void statsQuery.refetch()} />
      ) : statsQuery.data ? (
        <Card>
          <SectionTitle>Результат</SectionTitle>
          <p className="mb-3 text-xs text-slate-500">
            Период:{' '}
            {statsQuery.data.range.from ? formatDate(statsQuery.data.range.from) : 'начало'} —{' '}
            {statsQuery.data.range.to ? formatDate(statsQuery.data.range.to) : 'сегодня'}
            {statsQuery.data.range.groupIds
              ? ` · групп: ${statsQuery.data.range.groupIds.length}`
              : ''}
          </p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Событий" value={String(statsQuery.data.totalEvents)} />
            <StatTile
              label="Средняя оценка"
              value={statsQuery.data.avgRating === null ? '—' : String(statsQuery.data.avgRating)}
            />
            <StatTile
              label="Средняя длительность"
              value={
                statsQuery.data.avgDurationMinutes === null
                  ? '—'
                  : `${Math.round(statsQuery.data.avgDurationMinutes)} мин`
              }
            />
            <StatTile label="Калории" value={`${statsQuery.data.totalCalories} ккал`} />
          </div>

          {statsQuery.data.eventsByType.length > 0 ? (
            <div className="mt-4">
              <SectionTitle>По типам</SectionTitle>
<RowBars
                  items={statsQuery.data.eventsByType.map((item) => ({
                    label: eventTypeLabel(item.eventType),
                    value: item.count,
                  }))}
              />
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-500">За выбранный период событий нет.</p>
          )}
        </Card>
      ) : null}
    </section>
  );
}
