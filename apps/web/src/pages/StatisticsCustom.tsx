import { ArrowLeft } from 'lucide-react';
import { useMemo, useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { StatTile } from '../components/statistics/Charts';
import {
  DEFAULT_RANGE,
  RangePicker,
  rangeToStatsRange,
  type RangeState,
} from '../components/statistics/RangePicker';
import { Card, cx, SectionTitle } from '../components/ui/controls';
import { ErrorBlock, LoadingBlock } from '../components/ui/states';
import { formatDate } from '../lib/format';
import { useCustomStats, useGroupCalendars } from '../lib/queries';
import { TypeBars } from './StatisticsOverview';

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
          className="press rounded-full p-2.5 text-ink-muted transition-colors hover:bg-white/[0.06] hover:text-ink"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <h1 className="text-[22px] font-semibold text-ink">Расширенная статистика</h1>
      </div>

      <RangePicker value={range} onChange={setRange} />

      <Card className="mb-4">
        <SectionTitle>Групповые календари</SectionTitle>
        <p className="mb-2 text-[13px] text-ink-muted">
          Выберите группы — попадут только их события (включая чужие, если это общий календарь).
          Ничего не выбрано — считаются только ваши события.
        </p>
        {calendarsQuery.isLoading ? (
          <LoadingBlock label="Загрузка календарей…" />
        ) : (calendarsQuery.data ?? []).length === 0 ? (
          <p className="text-[13px] text-ink-muted">Групповых календарей пока нет.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(calendarsQuery.data ?? []).map((calendar) => {
              const active = groupIds.includes(calendar.id);
              return (
                <button
                  key={calendar.id}
                  type="button"
                  onClick={() => toggleGroup(calendar.id)}
                  className={cx(
                    // Тап-зона ≥40px; активный — rose-пилюля, неактивный — ghost (elev2 + hairline).
                    'rounded-full px-3.5 py-2.5 text-[13px] font-medium transition-colors',
                    active
                      ? 'bg-primary/[0.16] text-primary-400 ring-1 ring-inset ring-primary/30'
                      : 'bg-elev-2 text-ink-muted ring-1 ring-inset ring-white/[0.08] hover:bg-elev-3 hover:text-ink',
                  )}
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
          <p className="num mb-3 text-[13px] text-ink-muted">
            Период:{' '}
            {statsQuery.data.range.from ? formatDate(statsQuery.data.range.from) : 'начало'} —{' '}
            {statsQuery.data.range.to ? formatDate(statsQuery.data.range.to) : 'сегодня'}
            {statsQuery.data.range.groupIds
              ? ` · групп: ${statsQuery.data.range.groupIds.length}`
              : ''}
          </p>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
            {/* S3: единица — в hint, значение — число; пустая статистика — «—». */}
            <StatTile
              label="Калории"
              value={statsQuery.data.totalEvents > 0 ? String(statsQuery.data.totalCalories) : '—'}
              hint={statsQuery.data.totalEvents > 0 ? 'ккал' : undefined}
            />
          </div>

          {statsQuery.data.eventsByType.length > 0 ? (
            <div className="mt-4">
              <SectionTitle>По типам</SectionTitle>
              <TypeBars items={statsQuery.data.eventsByType} />
            </div>
          ) : (
            <p className="mt-3 text-[13px] text-ink-muted">За выбранный период событий нет.</p>
          )}
        </Card>
      ) : null}
    </section>
  );
}
