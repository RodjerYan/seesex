import { Plus } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { EventCard } from '../../components/events/EventCard';
import { Button, ErrorText, Fab, Field, Select } from '../../components/ui/controls';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/ui/states';
import { api } from '../../lib/api';
import { MS_PER_DAY, eventsRu, formatDate, isValidDayKey } from '../../lib/format';
import { errorMessage } from '../../lib/errors';
import { overviewQueryKey, useEvents, usePartners, type EventsFilter } from '../../lib/queries';

type PeriodKey = 'all' | 'day' | 'today' | '7' | '30' | '90';

const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: 'all', label: 'Всё время' },
  { value: 'today', label: 'Сегодня' },
  { value: '7', label: '±7 дней' },
  { value: '30', label: '±30 дней' },
  { value: '90', label: '±90 дней' },
];

const PAGE_SIZE = 20;

/** ?date=YYYY-MM-DD (переход из календаря на Dashboard). */
function readDateParam(params: URLSearchParams): string | null {
  const value = params.get('date');
  return value && isValidDayKey(value) ? value : null;
}

function periodRange(
  period: PeriodKey,
  day: string | null,
): Pick<EventsFilter, 'dateFrom' | 'dateTo'> {
  if (period === 'all') return {};
  if (period === 'day') {
    if (!day) return {};
    return {
      dateFrom: new Date(`${day}T00:00:00.000`).toISOString(),
      dateTo: new Date(`${day}T23:59:59.999`).toISOString(),
    };
  }
  const now = Date.now();
  if (period === 'today') {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
  }
  const days = Number(period);
  return {
    dateFrom: new Date(now - days * MS_PER_DAY).toISOString(),
    dateTo: new Date(now + days * MS_PER_DAY).toISOString(),
  };
}

/** Список событий: фильтры (период, партнёр), карточки, FAB «+», удаление. */
export default function EventList(): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const [day, setDay] = useState<string | null>(() => readDateParam(searchParams));
  const [period, setPeriod] = useState<PeriodKey>(() => (readDateParam(searchParams) ? 'day' : 'all'));
  const [partnerId, setPartnerId] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [listError, setListError] = useState<string | null>(null);

  // ?date= мог прийти/смениться после монтирования (например, из календаря).
  useEffect(() => {
    const next = readDateParam(searchParams);
    if (next && next !== day) {
      setDay(next);
      setPeriod('day');
      setLimit(PAGE_SIZE);
    }
  }, [searchParams, day]);

  const periodOptions = useMemo<{ value: PeriodKey; label: string }[]>(() => {
    if (!day) return PERIOD_OPTIONS;
    return [
      { value: 'day', label: `День: ${formatDate(`${day}T00:00:00`)}` },
      ...PERIOD_OPTIONS,
    ];
  }, [day]);

  const filter = useMemo<EventsFilter>(
    () => ({ ...periodRange(period, day), partnerId: partnerId || undefined, limit }),
    [period, day, partnerId, limit],
  );

  const eventsQuery = useEvents(filter);
  const partnersQuery = usePartners();

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/events/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['events'] });
      void queryClient.invalidateQueries({ queryKey: overviewQueryKey });
    },
    onError: (error) => setListError(errorMessage(error)),
  });

  const onDelete = (id: string): void => {
    if (!window.confirm('Удалить событие? Это действие нельзя отменить.')) return;
    setListError(null);
    remove.mutate(id);
  };

  const events = eventsQuery.data?.events ?? [];
  const total = eventsQuery.data?.total ?? 0;

  return (
    <section className="px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-100">События</h1>
          {eventsQuery.data ? (
            <p className="text-xs text-slate-500">{eventsRu(total)}</p>
          ) : null}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <Field label="Период" htmlFor="ev-period">
          <Select
            id="ev-period"
            value={period}
            onChange={(event) => {
              setPeriod(event.target.value as PeriodKey);
              setLimit(PAGE_SIZE);
            }}
          >
            {periodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Партнёр" htmlFor="ev-partner">
          <Select
            id="ev-partner"
            value={partnerId}
            onChange={(event) => {
              setPartnerId(event.target.value);
              setLimit(PAGE_SIZE);
            }}
          >
            <option value="">Все</option>
            {(partnersQuery.data ?? []).map((partner) => (
              <option key={partner.id} value={partner.id}>
                {partner.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {listError ? (
        <div className="mb-4">
          <ErrorText>{listError}</ErrorText>
        </div>
      ) : null}

      {eventsQuery.isLoading ? (
        <LoadingBlock label="Загрузка событий…" />
      ) : eventsQuery.isError ? (
        <ErrorBlock error={eventsQuery.error} onRetry={() => void eventsQuery.refetch()} />
      ) : events.length === 0 ? (
        <EmptyBlock
          title="Событий нет"
          description="За выбранным фильтром ничего не нашлось."
          action={
            <Button onClick={() => navigate('/events/new')}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Добавить событие
            </Button>
          }
        />
      ) : (
        <div className="stagger space-y-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} onDelete={() => onDelete(event.id)} />
          ))}

          {total > events.length ? (
            <Button variant="ghost" className="w-full" onClick={() => setLimit((value) => value + PAGE_SIZE)}>
              Показать ещё (показано {events.length} из {total})
            </Button>
          ) : null}
        </div>
      )}

      <Fab label="Создать событие" onClick={() => navigate('/events/new')}>
        <Plus className="h-6 w-6" aria-hidden="true" />
      </Fab>
    </section>
  );
}
