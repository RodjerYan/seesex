import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Users } from 'lucide-react';
import { useState, type FormEvent, type ReactElement } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Button, Card, ErrorText, Fab, Field, Input, SectionTitle } from '../components/ui/controls';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../components/ui/states';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { formatDate } from '../lib/format';
import { groupCalendarsQueryKey, useGroupCalendars } from '../lib/queries';
import type { GroupCalendarView } from '../types/api';

/** Менеджер групповых календарией: список, создание по имени, вступление по коду. */
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
        <h1 className="text-lg font-semibold tracking-tight text-slate-100">
          Групповые календари
        </h1>
        <p className="text-xs text-slate-500">Общий доступ к событиям по invite-коду</p>
      </div>

      {actionError ? (
        <div className="mb-4">
          <ErrorText>{actionError}</ErrorText>
        </div>
      ) : null}

      <Card className="mb-4">
        <SectionTitle>Создать календарь</SectionTitle>
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
        <SectionTitle>Вступить по коду</SectionTitle>
        <form onSubmit={onJoin}>
          <Field label="Invite-код" htmlFor="gcm-code" hint="8 символов из карточки календаря">
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

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Мои календари
      </h2>

      {calendarsQuery.isLoading ? (
        <LoadingBlock label="Загрузка календарей…" />
      ) : calendarsQuery.isError ? (
        <ErrorBlock error={calendarsQuery.error} onRetry={() => void calendarsQuery.refetch()} />
      ) : (calendarsQuery.data ?? []).length === 0 ? (
        <EmptyBlock
          title="Календарией пока нет"
          description="Создайте свой или вступите по коду."
        />
      ) : (
        <ul className="space-y-2">
          {(calendarsQuery.data ?? []).map((calendar) => (
            <li key={calendar.id}>
              <Link
                to={`/group-calendars/${calendar.id}`}
                className="flex items-center justify-between gap-3 rounded-xl glass p-4 transition-colors hover:border-white/10"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-100">{calendar.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-slate-500">
                    <Users className="h-3 w-3" aria-hidden="true" />
                    {calendar.memberCount} участник(ов) · {calendar.role ?? 'участник'} ·{' '}
                    {formatDate(calendar.createdAt)}
                  </p>
                </div>
                {calendar.inviteCode ? (
                  <span className="shrink-0 rounded border border-slate-700 px-2 py-1 font-mono text-[11px] text-slate-400">
                    {calendar.inviteCode}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Fab label="Создать календарь" onClick={() => document.getElementById('gcm-name')?.focus()}>
        <Plus className="h-6 w-6" aria-hidden="true" />
      </Fab>
    </section>
  );
}
