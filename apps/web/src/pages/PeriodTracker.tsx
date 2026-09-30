import { CalendarDays, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent, type ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { ColumnBars, StatTile } from '../components/statistics/Charts';
import { Button, Card, ErrorText, Fab, Field, Input, SectionTitle, TextArea } from '../components/ui/controls';
import { EmptyBlock, LoadingBlock } from '../components/ui/states';
import { dayFromDate, dayKey, daysBetween, formatDate } from '../lib/format';
import {
  addPeriod,
  averageCycleLength,
  cycleLengths,
  forecastNextStart,
  readPeriods,
  removePeriod,
  updatePeriod,
  type PeriodRecord,
} from '../lib/periods';
import { usePartners, usePeriodStats } from '../lib/queries';

function averagePeriodLength(records: PeriodRecord[]): number | null {
  const lengths = records
    .filter((record) => record.endDate)
    .map((record) => daysBetween(dayFromDate(record.startDate), dayFromDate(record.endDate ?? '')) + 1)
    .filter((value) => value > 0 && value < 20);
  if (lengths.length === 0) return null;
  return Math.round((lengths.reduce((sum, value) => sum + value, 0) / lengths.length) * 10) / 10;
}

/**
 * Трекер цикла. Журнал — локальный (backend не даёт CRUD по циклам,
 * только агрегат GET /api/statistics/periods по periodTracking партнёров).
 */
export default function PeriodTracker(): ReactElement {
  const [records, setRecords] = useState<PeriodRecord[]>(() => readPeriods());
  const [startDate, setStartDate] = useState(() => dayKey(new Date()));
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const statsQuery = usePeriodStats();
  const partnersQuery = usePartners();

  const partnerName = (partnerId: string): string =>
    (partnersQuery.data ?? []).find((partner) => partner.id === partnerId)?.name ??
    `Партнёр ${partnerId.slice(0, 8)}…`;

  const forecast = useMemo(() => forecastNextStart(records), [records]);
  const avgCycle = useMemo(() => averageCycleLength(records), [records]);
  const avgLength = useMemo(() => averagePeriodLength(records), [records]);
  const cycleItems = useMemo(
    () =>
      cycleLengths(records)
        .slice(-12)
        .map((value, index) => ({ label: `#${index + 1}`, value, hint: `${value} дней` })),
    [records],
  );

  const onAdd = (event: FormEvent): void => {
    event.preventDefault();
    setError(null);
    if (!startDate) {
      setError('Укажите дату начала.');
      return;
    }
    if (endDate && endDate < startDate) {
      setError('Дата окончания раньше даты начала.');
      return;
    }
    const result = addPeriod({ startDate, endDate: endDate || null, notes: notes.trim() || null });
    if (!result.added) {
      setError('Цикл с такой датой начала уже есть в журнале.');
      return;
    }
    setRecords(result.records);
    setEndDate('');
    setNotes('');
  };

  const onDelete = (id: string): void => {
    if (!window.confirm('Удалить запись цикла?')) return;
    setRecords(removePeriod(id));
  };

  const onUpdateEnd = (record: PeriodRecord, value: string): void => {
    if (value && value < record.startDate) {
      setError('Дата окончания раньше даты начала.');
      return;
    }
    setError(null);
    setRecords(updatePeriod(record.id, { endDate: value || null }));
  };

  return (
    <section className="px-4 py-6 sm:px-6">
      <div className="mb-4">
        <h1 className="text-lg font-semibold tracking-tight text-slate-100">Цикл</h1>
        <p className="text-xs text-slate-500">
          Журнал хранится в этом устройстве · справа — сводка с сервера по партнёрам
        </p>
      </div>

      {error ? (
        <div className="mb-4">
          <ErrorText>{error}</ErrorText>
        </div>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Записей" value={String(records.length)} />
        <StatTile
          label="Средний цикл"
          value={avgCycle === null ? '—' : `${avgCycle} дн.`}
          hint="по вашему журналу"
        />
        <StatTile label="Средняя длительность" value={avgLength === null ? '—' : `${avgLength} дн.`} />
        <StatTile
          label="Прогноз"
          value={forecast ? formatDate(forecast) : '—'}
          hint={forecast ? 'следующий цикл' : 'нужно ≥2 записи'}
        />
      </div>

      <Card className="mb-4">
        <SectionTitle>Добавить цикл</SectionTitle>
        <form onSubmit={onAdd}>
          <div className="grid grid-cols-2 gap-3 min-w-0">
            <Field label="Начало *" htmlFor="pt-start">
              <Input
                id="pt-start"
                type="date"
                value={startDate}
                max={dayKey(new Date())}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </Field>
            <Field label="Окончание" htmlFor="pt-end" hint="необязательно">
              <Input
                id="pt-end"
                type="date"
                value={endDate}
                min={startDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </Field>
          </div>
          <Field label="Заметка" htmlFor="pt-notes">
            <TextArea
              id="pt-notes"
              value={notes}
              maxLength={500}
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>
          <Button type="submit" className="w-full">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Добавить в журнал
          </Button>
        </form>
      </Card>

      {cycleItems.length > 1 ? (
        <Card className="mb-4">
          <SectionTitle>Длина цикла (последние {cycleItems.length})</SectionTitle>
          <ColumnBars items={cycleItems} height={100} valueLabel={(value) => `${value} дн.`} />
        </Card>
      ) : null}

      <Card className="mb-4">
        <SectionTitle>Журнал</SectionTitle>
        {records.length === 0 ? (
          <EmptyBlock
            title="Записей пока нет"
            description="Отметьте первый день цикла — дальше прогнозы появятся автоматически."
          />
        ) : (
          <ul className="divide-y divide-white/10">
            {records.map((record) => (
              <li key={record.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm text-slate-100">
                    <CalendarDays className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                    {formatDate(record.startDate)}
                    {record.endDate ? ` — ${formatDate(record.endDate)}` : ''}
                  </p>
                  {record.notes ? (
                    <p className="mt-0.5 truncate text-xs text-slate-500">{record.notes}</p>
                  ) : null}
                  <label className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-500">
                    Дата окончания:
                    <input
                      type="date"
                      value={record.endDate ?? ''}
                      min={record.startDate}
                      onChange={(event) => onUpdateEnd(record, event.target.value)}
                      className="rounded-2xl border border-white/10 bg-white/[0.08] px-3 py-2 text-[16px] leading-5 text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  aria-label="Удалить запись"
                  onClick={() => onDelete(record.id)}
                  className="shrink-0 rounded-xl p-2 text-slate-400 hover:bg-white/[0.06] hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle>Сводка с сервера (по партнёрам)</SectionTitle>
        {statsQuery.isLoading ? (
          <LoadingBlock label="Загрузка сводки…" />
        ) : statsQuery.data ? (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Записей всего" value={String(statsQuery.data.totalEntries)} />
              <StatTile
                label="Средний цикл"
                value={
                  statsQuery.data.avgCycleLengthDays === null
                    ? '—'
                    : `${statsQuery.data.avgCycleLengthDays} дн.`
                }
              />
              <StatTile
                label="Средняя длительность"
                value={
                  statsQuery.data.avgPeriodLengthDays === null
                    ? '—'
                    : `${statsQuery.data.avgPeriodLengthDays} дн.`
                }
              />
              <StatTile
                label="Последнее начало"
                value={
                  statsQuery.data.lastPeriodStart ? formatDate(statsQuery.data.lastPeriodStart) : '—'
                }
              />
            </div>
            {statsQuery.data.trackings.length === 0 ? (
              <p className="text-xs text-slate-500">
                У партнёров пока нет данных цикла (API хранит их отдельно от этого журнала).
              </p>
            ) : (
              <ul className="space-y-2">
                {statsQuery.data.trackings.map((tracking) => (
                  <li
                    key={tracking.partnerId}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 px-3 py-2 text-xs"
                  >
                    <Link
                      to={`/partners/${tracking.partnerId}`}
                      className="truncate text-slate-200 hover:text-primary-400"
                    >
                      {partnerName(tracking.partnerId)}
                    </Link>
                    <span className="shrink-0 text-slate-500">
                      {tracking.entriesCount} зап. · цикл{' '}
                      {tracking.averageCycleLength ?? '—'} дн.
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
      </Card>

      <Fab label="Добавить цикл" onClick={() => document.getElementById('pt-start')?.focus()}>
        <Plus className="h-6 w-6" aria-hidden="true" />
      </Fab>
    </section>
  );
}
