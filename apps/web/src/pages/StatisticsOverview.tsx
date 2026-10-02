import { Download, FileJson, Sparkles } from 'lucide-react';
import { useMemo, useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { ColumnBars, RowBars, StatTile } from '../components/statistics/Charts';
import {
  DEFAULT_RANGE,
  RangePicker,
  rangeToStatsRange,
  type RangeState,
} from '../components/statistics/RangePicker';
import { Button, Card, ErrorText, SectionTitle } from '../components/ui/controls';
import { ErrorBlock, LoadingBlock } from '../components/ui/states';
import { downloadExport, type ExportKind } from '../lib/download';
import { errorMessage } from '../lib/errors';
import { formatDate, shortMonthLabel } from '../lib/format';
import {
  useFrequency,
  useOverview,
  usePartnerStats,
  useRatings,
} from '../lib/queries';
import { eventMeta } from '../lib/eventMeta';

function numberOr(value: number | null | undefined, fallback = '—'): string {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback;
  return String(value);
}

/**
 * Строки «По типам»: слева цветной чип с иконкой типа (eventMeta),
 * справа счётчик и бар. Локальная замена RowBars, т.к. ChartItem.label — строка.
 */
export function TypeBars({
  items,
}: {
  items: { eventType: string; count: number }[];
}): ReactElement {
  const rows = items.map((item) => ({ ...item, meta: eventMeta(item.eventType) }));
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <ul className="space-y-2">
      {rows.map(({ eventType, count, meta: { Icon, color, label } }, index) => (
        <li key={`${eventType}-${index}`}>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span
              className="inline-flex min-w-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]"
              style={{
                borderColor: `${color}55`,
                backgroundColor: `${color}1A`,
                color,
              }}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="truncate">{label}</span>
            </span>
            <span className="shrink-0 tabular-nums text-slate-400">{count}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-primary-400/80 animate-grow-up"
              style={{
                width: `${Math.max(3, (count / max) * 100)}%`,
                transformOrigin: 'left',
                animationDelay: `${index * 40}ms`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Сводная статистика: KPI + частота (столбцы) + оценки + топы + экспорт. */
export default function StatisticsOverview(): ReactElement {
  const [range, setRange] = useState<RangeState>(DEFAULT_RANGE);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<ExportKind | null>(null);

  const statsRange = useMemo(() => rangeToStatsRange(range), [range]);

  const overviewQuery = useOverview();
  const frequencyQuery = useFrequency(statsRange);
  const ratingsQuery = useRatings(statsRange);
  const partnersQuery = usePartnerStats(statsRange);

  const onExport = async (kind: ExportKind): Promise<void> => {
    setExportError(null);
    setExporting(kind);
    try {
      await downloadExport(kind);
    } catch (error) {
      setExportError(errorMessage(error));
    } finally {
      setExporting(null);
    }
  };

  const monthItems = (frequencyQuery.data?.byMonth ?? []).map((item) => ({
    label: shortMonthLabel(item.month),
    value: item.count,
    hint: `${item.month}: ${item.count}`,
  }));

  const ratingItems = (ratingsQuery.data?.distribution ?? [])
    .filter((item) => item.rating !== null)
    .map((item) => ({
      label: `${item.rating} ★`,
      value: item.count,
      hint: item.avgDurationMinutes
        ? `средняя длительность ${Math.round(item.avgDurationMinutes)} мин`
        : undefined,
    }));

  const partnerItems = (partnersQuery.data?.partners ?? []).slice(0, 8).map((item) => ({
    label: item.name,
    value: item.count,
    hint: item.lastDate ? `последнее: ${formatDate(item.lastDate)}` : undefined,
  }));

  return (
    <section className="px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold tracking-tight text-slate-100">Статистика</h1>
        <Link
          to="/statistics/custom"
          className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Расширенная
        </Link>
      </div>

      <RangePicker value={range} onChange={setRange} />

      {exportError ? (
        <div className="mb-4">
          <ErrorText>{exportError}</ErrorText>
        </div>
      ) : null}

      <div className="mb-4 flex gap-2">
        <Button
          variant="ghost"
          onClick={() => void onExport('json')}
          disabled={exporting !== null}
        >
          <FileJson className="h-4 w-4" aria-hidden="true" />
          {exporting === 'json' ? 'Готовим…' : 'Экспорт JSON'}
        </Button>
        <Button
          variant="ghost"
          onClick={() => void onExport('csv')}
          disabled={exporting !== null}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {exporting === 'csv' ? 'Готовим…' : 'Экспорт CSV'}
        </Button>
      </div>

      {overviewQuery.isLoading ? (
        <LoadingBlock label="Загрузка статистики…" />
      ) : overviewQuery.isError ? (
        <ErrorBlock error={overviewQuery.error} onRetry={() => void overviewQuery.refetch()} />
      ) : overviewQuery.data ? (
        <>
          <Card className="mb-4">
            <SectionTitle>Ключевые показатели (за всё время)</SectionTitle>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatTile label="Событий" value={numberOr(overviewQuery.data.totalEvents, '0')} />
              <StatTile label="Средняя оценка" value={numberOr(overviewQuery.data.avgRating)} />
              <StatTile
                label="Средняя длительность"
                value={
                  overviewQuery.data.avgDurationMinutes === null
                    ? '—'
                    : `${Math.round(overviewQuery.data.avgDurationMinutes)} мин`
                }
              />
              <StatTile
                label="Средний пульс"
                value={
                  overviewQuery.data.avgHeartRate === null
                    ? '—'
                    : `${Math.round(overviewQuery.data.avgHeartRate)} уд/мин`
                }
              />
              <StatTile label="Калории" value={`${overviewQuery.data.totalCalories} ккал`} />
              <StatTile
                label="Вишлист"
                value={`${overviewQuery.data.wishlist.completed}/${overviewQuery.data.wishlist.total}`}
              />
              <StatTile label="Партнёров" value={numberOr(overviewQuery.data.partnersCount, '0')} />
              <StatTile
                label="Период"
                value={
                  overviewQuery.data.firstEventDate && overviewQuery.data.lastEventDate
                    ? `${formatDate(overviewQuery.data.firstEventDate)} — ${formatDate(overviewQuery.data.lastEventDate)}`
                    : '—'
                }
              />
            </div>

            {overviewQuery.data.eventsByType.length > 0 ? (
              <div className="mt-4">
                <SectionTitle>По типам</SectionTitle>
                <TypeBars items={overviewQuery.data.eventsByType} />
              </div>
            ) : null}
          </Card>

          <Card className="mb-4">
            <SectionTitle>Частота событий</SectionTitle>
            {frequencyQuery.isLoading ? (
              <LoadingBlock label="Загрузка частоты…" />
            ) : frequencyQuery.isError ? (
              <ErrorBlock
                error={frequencyQuery.error}
                onRetry={() => void frequencyQuery.refetch()}
              />
            ) : frequencyQuery.data ? (
              <>
                <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <StatTile label="Всего" value={numberOr(frequencyQuery.data.total, '0')} />
                  <StatTile
                    label="В среднем/мес"
                    value={numberOr(frequencyQuery.data.avgPerMonth)}
                  />
                  <StatTile
                    label="Интервал, дней"
                    value={numberOr(frequencyQuery.data.avgIntervalDays)}
                  />
                  <StatTile
                    label="Активных месяцев"
                    value={numberOr(frequencyQuery.data.activeMonths, '0')}
                  />
                  <StatTile label="За 30 дней" value={numberOr(frequencyQuery.data.last30Days, '0')} />
                  <StatTile
                    label="Пиковый месяц"
                    value={
                      frequencyQuery.data.busiestMonth
                        ? `${shortMonthLabel(frequencyQuery.data.busiestMonth.month)} (${frequencyQuery.data.busiestMonth.count})`
                        : '—'
                    }
                  />
                </div>
                {monthItems.length > 0 ? (
                  <ColumnBars items={monthItems} />
                ) : (
                  <p className="text-xs text-slate-500">За выбранный период событий нет.</p>
                )}
              </>
            ) : null}
          </Card>

          <Card className="mb-4">
            <SectionTitle>Оценки</SectionTitle>
            {ratingsQuery.isLoading ? (
              <LoadingBlock label="Загрузка оценок…" />
            ) : ratingsQuery.isError ? (
              <ErrorBlock
                error={ratingsQuery.error}
                onRetry={() => void ratingsQuery.refetch()}
              />
            ) : ratingsQuery.data ? (
              <>
                <p className="mb-3 text-xs text-slate-500">
                  Оценено событий: {ratingsQuery.data.ratedEvents}
                  {ratingsQuery.data.avgRating !== null
                    ? ` · средняя оценка ${ratingsQuery.data.avgRating}`
                    : ''}
                </p>
                {ratingItems.length > 0 ? (
                  <RowBars items={ratingItems} suffix=" шт." />
                ) : (
                  <p className="text-xs text-slate-500">Оценок за выбранный период нет.</p>
                )}
              </>
            ) : null}
          </Card>

          <Card>
            <SectionTitle>Топ партнёров</SectionTitle>
            {partnersQuery.isLoading ? (
              <LoadingBlock label="Загрузка…" />
            ) : partnerItems.length > 0 ? (
              <RowBars items={partnerItems} suffix=" шт." />
            ) : (
              <p className="text-xs text-slate-500">Нет данных за период.</p>
            )}
          </Card>
        </>
      ) : null}
    </section>
  );
}
