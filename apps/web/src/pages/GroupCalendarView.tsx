import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Copy, LogOut, Plus, Users } from 'lucide-react';
import { useState, type ReactElement, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { EventForm, type EventPayload } from '../components/events/EventForm';
import { Button, Card, ErrorText } from '../components/ui/controls';
import { Badge, ListRow, SectionHeader, StatusPill } from '../components/ui/primitives';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../components/ui/states';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { formatDate, formatDateTime } from '../lib/format';
import { GROUP_ROLE_LABEL, tr } from '../lib/labels';
import {
  groupCalendarEventsQueryKey,
  groupCalendarsQueryKey,
  overviewQueryKey,
  useGroupCalendar,
  useGroupCalendarEvents,
} from '../lib/queries';
import type { CalendarStatus, EventView, GroupCalendarView } from '../types/api';
import { eventMeta } from '../lib/eventMeta';
import { STATUS_LABEL } from '../components/events/EventCard';

/**
 * Метаданные-строка (ListRow): label — .type-label ink-dim uppercase,
 * значение — tabular-nums справа, разделитель — hairline.
 * `-mx-4` растягивает строку во всю ширину карточки (компенсирует p-4 Card).
 */
function DataRow({ label, value }: { label: string; value: ReactNode }): ReactElement {
  return (
    <ListRow
      className="-mx-4 border-t border-white/[0.08] first:border-t-0"
      leading={<span className="type-label uppercase text-ink-dim">{label}</span>}
      trailing={<span className="num text-[15px] text-ink">{value || '—'}</span>}
    >
      {null}
    </ListRow>
  );
}

/** Карточка группового календаря: код, участники, события, добавление события, выход. */
export default function GroupCalendarView(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const calendarQuery = useGroupCalendar(id);
  const eventsQuery = useGroupCalendarEvents(id);

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: groupCalendarsQueryKey });
    void queryClient.invalidateQueries({ queryKey: groupCalendarEventsQueryKey(id ?? '') });
    void queryClient.invalidateQueries({ queryKey: ['events'] });
    void queryClient.invalidateQueries({ queryKey: overviewQueryKey });
  };

  const createEvent = useMutation({
    mutationFn: (payload: EventPayload) =>
      api.post<{ event: EventView }>(`/api/group-calendars/${id ?? ''}/events`, payload),
    onSuccess: () => {
      setFormError(null);
      setAdding(false);
      invalidate();
    },
    onError: (error) => setFormError(errorMessage(error)),
  });

  const leave = useMutation({
    mutationFn: () => api.delete(`/api/group-calendars/${id ?? ''}/leave`),
    onSuccess: () => {
      invalidate();
      navigate('/group-calendars', { replace: true });
    },
    onError: (error) => setFormError(errorMessage(error)),
  });

  const copyCode = async (): Promise<void> => {
    const code = calendarQuery.data?.inviteCode;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setFormError('Не удалось скопировать код — скопируйте его вручную.');
    }
  };

  if (calendarQuery.isLoading) return <LoadingBlock label="Загрузка календаря…" />;
  if (calendarQuery.isError || !calendarQuery.data) {
    return (
      <section className="px-4 py-6 sm:px-6">
        <ErrorBlock error={calendarQuery.error} onRetry={() => void calendarQuery.refetch()} />
      </section>
    );
  }

  const calendar = calendarQuery.data;

  return (
    <section className="px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          to="/group-calendars"
          aria-label="Назад к списку"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-white/[0.06] hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <Button
          variant="danger"
          onClick={() => {
            if (window.confirm('Выйти из группового календаря?')) leave.mutate();
          }}
          disabled={leave.isPending}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          {leave.isPending ? 'Выходим…' : 'Выйти'}
        </Button>
      </div>

      <div className="mb-4">
        <h1 className="min-w-0 text-[22px] font-semibold leading-7 text-ink">{calendar.name}</h1>
        <p className="mt-1 text-[13px] text-ink-muted">
          Ваша роль: {tr(GROUP_ROLE_LABEL, calendar.role, 'Участник')} · создан{' '}
          <span className="num">{formatDate(calendar.createdAt)}</span>
        </p>
      </div>

      {formError ? (
        <div className="mb-4">
          <ErrorText>{formError}</ErrorText>
        </div>
      ) : null}

      <Card className="mb-4">
        <SectionHeader>Доступ</SectionHeader>
        <DataRow label="Участников" value={String(calendar.memberCount)} />
        <DataRow
          label="Код приглашения"
          value={
            calendar.inviteCode ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="num font-mono tracking-widest">{calendar.inviteCode}</span>
                <button
                  type="button"
                  aria-label="Скопировать код"
                  onClick={() => void copyCode()}
                  className="flex h-10 w-10 items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-white/[0.06] hover:text-primary-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <Copy className="h-4 w-4" aria-hidden="true" />
                </button>
                {copied ? <span className="text-[11px] text-emerald-400">скопирован</span> : null}
              </span>
            ) : null
          }
        />

        <div className="mt-4">
          <p className="type-label flex items-center gap-1.5 uppercase text-ink-dim">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            Участники
          </p>
          <ul className="mt-1">
            {calendar.members.map((member, index) => (
              <ListRow
                key={member.id}
                as="li"
                className={index > 0 ? '-mx-4 border-t border-white/[0.08]' : '-mx-4'}
                trailing={
                  <Badge tone={member.role === 'OWNER' ? 'violet' : 'sky'}>
                    {tr(GROUP_ROLE_LABEL, member.role, 'Участник')}
                  </Badge>
                }
              >
                <span className="block truncate">{member.email ?? member.userId}</span>
              </ListRow>
            ))}
          </ul>
        </div>
      </Card>

      <SectionHeader
        className="mt-6"
        action={
          <Button variant="ghost" onClick={() => setAdding((value) => !value)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {adding ? 'Свернуть' : 'Добавить'}
          </Button>
        }
      >
        События группы
      </SectionHeader>

      {adding ? (
        <Card className="mb-4">
          <EventForm
            submitLabel="Добавить в группу"
            submitting={createEvent.isPending}
            formError={formError}
            onSubmit={(payload) => {
              setFormError(null);
              createEvent.mutate(payload);
            }}
          />
        </Card>
      ) : null}

      {eventsQuery.isLoading ? (
        <LoadingBlock label="Загрузка событий…" />
      ) : eventsQuery.isError ? (
        <ErrorBlock error={eventsQuery.error} onRetry={() => void eventsQuery.refetch()} />
      ) : (eventsQuery.data ?? []).length === 0 ? (
        <EmptyBlock
          title="Событий пока нет"
          description="Добавьте первое событие в общий календарь."
        />
      ) : (
        <ul className="stagger space-y-2">
          {(eventsQuery.data ?? []).map((event) => {
            const { Icon, color, label } = eventMeta(event.eventType);
            return (
              <li key={event.id}>
                <Link
                  to={`/events/${event.id}`}
                  className="glass flex items-center justify-between gap-3 p-4 transition-colors hover:border-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      {event.title ? (
                        <p className="truncate text-[15px] font-medium text-ink">{event.title}</p>
                      ) : null}
                      <span
                        // S3 (review M-02): read-only чип — однократный twinkle при
                        // mount; hover/press-glow — только интерактивным чипам EventForm.
                        className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] animate-sensual-pop"
                        style={{
                          borderColor: `${color}55`,
                          backgroundColor: `${color}1A`,
                          color,
                        }}
                      >
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                        {label}
                      </span>
                    </div>
                    <p className="num mt-0.5 truncate text-[13px] text-ink-muted">
                      {formatDateTime(event.date)}
                    </p>
                  </div>
                  <StatusPill status={event.status}>
                    {STATUS_LABEL[event.status as CalendarStatus] ?? event.status}
                  </StatusPill>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
