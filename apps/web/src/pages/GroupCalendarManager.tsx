import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Plus, Users } from 'lucide-react';
import { useState, type FormEvent, type ReactElement } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Button, Card, ErrorText, Field, Input } from '../components/ui/controls';
import { Badge, SectionHeader } from '../components/ui/primitives';
import { CardSkeleton, EmptyState } from '../components/ui/listStates';
import { ErrorBlock } from '../components/ui/states';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { formatDate } from '../lib/format';
import { GROUP_ROLE_LABEL, tr } from '../lib/labels';
import { groupCalendarsQueryKey, useGroupCalendars } from '../lib/queries';
import type { GroupCalendarView } from '../types/api';

/** Менеджер групповых календариев: список, создание по имени, вступление по коду. */
export default function GroupCalendarManager(): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const calendarsQuery = useGroupCalendars();

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: groupCalendarsQueryKey });
  };

  const create = useMutation({
    mutationFn: () => api.post<{ calendar: GroupCalendarView }>('/api/group-calendars', { name }),
    onSuccess: (data) => {
      setActionError(null);
      setName('');
      invalidate();
      navigate(`/group-calendars/${data.calendar.id}`);
    },
    onError: (error) => setActionError(errorMessage(error)),
  });

  const join = useMutation({
    mutationFn: () =>
      api.post<{ calendar: GroupCalendarView }>('/api/group-calendars/join', {
        inviteCode: inviteCode.trim(),
      }),
    onSuccess: (data) => {
      setActionError(null);
      setInviteCode('');
      invalidate();
      navigate(`/group-calendars/${data.calendar.id}`);
    },
    onError: (error) => setActionError(errorMessage(error)),
  });

  const onCreate = (event: FormEvent): void => {
    event.preventDefault();
    if (!name.trim()) return;
    create.mutate();
  };

  const onJoin = (event: FormEvent): void => {
    event.preventDefault();
    if (!inviteCode.trim()) return;
    join.mutate();
  };

  return (
    <section className="px-4 py-6 sm:px-6">
      <div className="mb-4">
        <h1 className="text-[22px] font-semibold leading-7 text-ink">
          Групповые календари
        </h1>
        <p className="mt-0.5 text-[13px] text-ink-muted">Общий доступ к событиям по коду приглашения</p>
      </div>

      {actionError ? (
        <div className="mb-4">
          <ErrorText>{actionError}</ErrorText>
        </div>
      ) : null}

      <Card className="mb-4">
        <SectionHeader>Создать календарь</SectionHeader>
        <form onSubmit={onCreate}>
          <Field label="Название *" htmlFor="gcm-name">
            <Input
              id="gcm-name"
              value={name}
              maxLength={100}
              placeholder="Например: Наш общий"
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Button type="submit" className="w-full" disabled={create.isPending || !name.trim()}>
            {create.isPending ? 'Создаём…' : 'Создать'}
          </Button>
        </form>
      </Card>

      <Card className="mb-4">
        <SectionHeader>Вступить по коду</SectionHeader>
        <form onSubmit={onJoin}>
          <Field label="Код приглашения" htmlFor="gcm-code" hint="8 символов из карточки календаря">
            <Input
              id="gcm-code"
              value={inviteCode}
              maxLength={32}
              placeholder="ABCD1234"
              autoCapitalize="characters"
              onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
            />
          </Field>
          <Button type="submit" variant="ghost" className="w-full" disabled={join.isPending || !inviteCode.trim()}>
            {join.isPending ? 'Ищем…' : 'Вступить'}
          </Button>
        </form>
      </Card>

      <SectionHeader className="mt-6">Мои календари</SectionHeader>

      {calendarsQuery.isLoading ? (
        <CardSkeleton label="Загрузка календарей…" />
      ) : calendarsQuery.isError ? (
        <ErrorBlock error={calendarsQuery.error} onRetry={() => void calendarsQuery.refetch()} />
      ) : (calendarsQuery.data ?? []).length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Календариев пока нет"
          description="Создайте свой или вступите по коду приглашения."
          action={
            <Button onClick={() => document.getElementById('gcm-name')?.focus()}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Создать календарь
            </Button>
          }
        />
      ) : (
        <ul className="stagger space-y-2">
          {(calendarsQuery.data ?? []).map((calendar) => (
            <li key={calendar.id}>
              <Link
                to={`/group-calendars/${calendar.id}`}
                className="glass press flex items-center justify-between gap-3 p-4 transition-colors hover:border-white/10 active:border-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium text-ink">{calendar.name}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-ink-muted">
                    <Users className="h-3.5 w-3.5 shrink-0 text-ink-dim" aria-hidden="true" />
                    <span className="num">{calendar.memberCount} участник(ов)</span>
                    <span aria-hidden="true">·</span>
                    <Badge tone={calendar.role === 'OWNER' ? 'violet' : 'sky'}>
                      {tr(GROUP_ROLE_LABEL, calendar.role, 'Участник')}
                    </Badge>
                    <span aria-hidden="true">·</span>
                    <span className="num">{formatDate(calendar.createdAt)}</span>
                  </p>
                </div>
                {calendar.inviteCode ? (
                  <span className="num shrink-0 rounded-full bg-elev-2 px-2.5 py-1 font-mono text-[11px] text-ink-muted ring-1 ring-white/[0.08]">
                    {calendar.inviteCode}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        aria-label="Создать календарь"
        onClick={() => document.getElementById('gcm-name')?.focus()}
        className="press fab-mobile grad-intimate flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg shadow-black/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <Plus className="h-6 w-6" aria-hidden="true" />
      </button>
    </section>
  );
}
