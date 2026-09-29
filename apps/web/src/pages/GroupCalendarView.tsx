import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Copy, LogOut, Plus, Users } from 'lucide-react';
import { useState, type ReactElement, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { EventForm, type EventPayload } from '../components/events/EventForm';
import { Button, Card, ErrorText, SectionTitle } from '../components/ui/controls';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../components/ui/states';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { formatDate, formatDateTime } from '../lib/format';
import {
  groupCalendarEventsQueryKey,
  groupCalendarsQueryKey,
  overviewQueryKey,
  useGroupCalendar,
  useGroupCalendarEvents,
} from '../lib/queries';
import type { EventView, GroupCalendarView } from '../types/api';

function DataRow({ label, value }: { label: string; value: ReactNode }): ReactElement {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-800/70 py-2 last:border-b-0">
      <dt className="shrink-0 text-xs text-slate-500">{label}</dt>
      <dd className="text-right text-sm text-slate-200">{value || '—'}</dd>
    </div>
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
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
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
        <h1 className="text-xl font-semibold tracking-tight text-slate-100">{calendar.name}</h1>
        <p className="mt-1 text-xs text-slate-500">
          Ваша роль: {calendar.role ?? 'участник'} · создан {formatDate(calendar.createdAt)}
        </p>
      </div>

      {formError ? (
        <div className="mb-4">
          <ErrorText>{formError}</ErrorText>
        </div>
      ) : null}

      <Card className="mb-4">
        <SectionTitle>Доступ</SectionTitle>
        <dl>
          <DataRow label="Участников" value={String(calendar.memberCount)} />
          <DataRow
            label="Invite-код"
            value={calendar.inviteCode ? (
              <span className="inline-flex items-center gap-2">
                <span className="font-mono tracking-widest">{calendar.inviteCode}</span>
                <button
                  type="button"
                  aria-label="Скопировать код"
                  onClick={() => void copyCode()}
                  className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-primary-400"
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                {copied ? <span className="text-[10px] text-emerald-400">скопирован</span> : null}
              </span>
            ) : null}
          />
        </dl>

        <div className="mt-3">
          <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            Участники
          </p>
          <ul className="space-y-1.5">
            {calendar.members.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 px-3 py-2 text-xs"
              >
                <span className="truncate text-slate-300">{member.email ?? member.userId}</span>
                <span className="shrink-0 rounded border border-slate-700 px-1.5 py-0.5 text-[10px] uppercase text-slate-500">
                  {member.role}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          События группы
        </h2>
        <Button variant="ghost" onClick={() => setAdding((value) => !value)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {adding ? 'Свернуть' : 'Добавить'}
        </Button>
      </div>

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
        <ul className="space-y-2">
          {(eventsQuery.data ?? []).map((event) => (
            <li key={event.id}>
              <Link
                to={`/events/${event.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3 transition-colors hover:border-slate-700"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-100">
                    {event.title || event.eventType}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500">
                    {formatDateTime(event.date)}
                  </p>
                </div>
                <span className="shrink-0 rounded border border-slate-700 px-1.5 py-0.5 text-[10px] uppercase text-slate-500">
                  {event.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
