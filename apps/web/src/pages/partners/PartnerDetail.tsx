import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Star, Trash2 } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { EventCard } from '../../components/events/EventCard';
import { Button, Card, ErrorText, SectionTitle } from '../../components/ui/controls';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/ui/states';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { errorMessage } from '../../lib/errors';
import { GENDER_LABEL, ORIENTATION_LABEL, RELATIONSHIP_LABEL, tr } from '../../lib/labels';
import {
  partnerQueryKey,
  partnersQueryKey,
  useEvents,
  usePartner,
  usePartnerStats,
} from '../../lib/queries';

function DataRow({ label, value }: { label: string; value: string | null | undefined }): ReactElement {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/10 py-2 last:border-b-0">
      <dt className="shrink-0 text-xs text-slate-500">{label}</dt>
      <dd className="text-right text-sm text-slate-200">{value || '—'}</dd>
    </div>
  );
}

/** Детали партнёра: данные, статистика, события, «сделать основным». */
export default function PartnerDetail(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [actionError, setActionError] = useState<string | null>(null);

  const partnerQuery = usePartner(id);
  const eventsQuery = useEvents({ partnerId: id, limit: 10 });
  const statsQuery = usePartnerStats({});

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: partnersQueryKey });
    void queryClient.invalidateQueries({ queryKey: partnerQueryKey(id ?? '') });
    void queryClient.invalidateQueries({ queryKey: ['events'] });
    void queryClient.invalidateQueries({ queryKey: ['statistics'] });
  };

  const setPrimary = useMutation({
    mutationFn: () => api.put(`/api/partners/${id ?? ''}/primary`),
    onSuccess: invalidate,
    onError: (error) => setActionError(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/api/partners/${id ?? ''}`),
    onSuccess: () => {
      invalidate();
      navigate('/partners', { replace: true });
    },
    onError: (error) => setActionError(errorMessage(error)),
  });

  const onDeletePartner = (): void => {
    if (!window.confirm('Удалить партнёра? Это действие нельзя отменить.')) return;
    setActionError(null);
    remove.mutate();
  };

  if (partnerQuery.isLoading) return <LoadingBlock label="Загрузка партнёра…" />;
  if (partnerQuery.isError || !partnerQuery.data) {
    return (
      <section className="px-4 py-6 sm:px-6">
        <ErrorBlock error={partnerQuery.error} onRetry={() => void partnerQuery.refetch()} />
      </section>
    );
  }

  const partner = partnerQuery.data;
  const stat = (statsQuery.data?.partners ?? []).find((item) => item.id === partner.id);

  return (
    <section className="px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          to="/partners"
          aria-label="Назад к списку"
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-100"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <div className="flex flex-wrap justify-end gap-2">
          <Link
            to={`/partners/${partner.id}/edit`}
            className="flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-white/[0.06]"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Изменить
          </Link>
          <Button
            variant="ghost"
            onClick={() => setPrimary.mutate()}
            disabled={partner.isPrimary || setPrimary.isPending}
          >
            <Star className="h-4 w-4" aria-hidden="true" />
            {partner.isPrimary ? 'Основной' : 'Сделать основным'}
          </Button>
          <Button variant="danger" onClick={onDeletePartner} disabled={remove.isPending}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Удалить
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-100">
          {partner.name}
          {partner.isPrimary ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">
              <Star className="h-3 w-3 fill-amber-400" aria-hidden="true" />
              основной
            </span>
          ) : null}
        </h1>
        <p className="mt-1 text-xs text-slate-500">В приложении с {formatDate(partner.createdAt)}</p>
      </div>

      {actionError ? (
        <div className="mb-4">
          <ErrorText>{actionError}</ErrorText>
        </div>
      ) : null}

      <Card className="mb-4">
        <SectionTitle>Данные</SectionTitle>
        <dl>
          <DataRow label="Прозвище" value={partner.nickname} />
          <DataRow label="Пол" value={tr(GENDER_LABEL, partner.gender, partner.gender ?? '')} />
          <DataRow
            label="Ориентация"
            value={tr(ORIENTATION_LABEL, partner.sexualOrientation, partner.sexualOrientation ?? '')}
          />
          <DataRow label="Местоимения" value={partner.pronouns} />
          <DataRow
            label="Отношения"
            value={tr(RELATIONSHIP_LABEL, partner.relationshipStatus, partner.relationshipStatus ?? '')}
          />
        </dl>
        {partner.customFields && Object.keys(partner.customFields).length > 0 ? (
          <dl className="mt-2">
            {Object.entries(partner.customFields).map(([key, value]) => (
              <DataRow key={key} label={key} value={String(value)} />
            ))}
          </dl>
        ) : null}
      </Card>

      <Card className="mb-4">
        <SectionTitle>Статистика</SectionTitle>
        {statsQuery.isLoading ? (
          <LoadingBlock label="Загрузка статистики…" />
        ) : stat ? (
          <dl>
            <DataRow label="Событий" value={String(stat.count)} />
            <DataRow label="Средняя оценка" value={stat.avgRating === null ? null : String(stat.avgRating)} />
            <DataRow label="Последнее событие" value={stat.lastDate ? formatDate(stat.lastDate) : null} />
          </dl>
        ) : (
          <p className="text-xs text-slate-500">Событий с этим партнёром пока нет.</p>
        )}
      </Card>

      <Card>
        <SectionTitle>События</SectionTitle>
        {eventsQuery.isLoading ? (
          <LoadingBlock label="Загрузка событий…" />
        ) : eventsQuery.isError ? (
          <ErrorBlock error={eventsQuery.error} onRetry={() => void eventsQuery.refetch()} />
        ) : (eventsQuery.data?.events ?? []).length === 0 ? (
          <EmptyBlock title="Событий нет" description="Отметьте первое событие с этим партнёром." />
        ) : (
          <div className="stagger space-y-3">
            {(eventsQuery.data?.events ?? []).map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
            {(eventsQuery.data?.events ?? []).length < (eventsQuery.data?.total ?? 0) ? (
              <Link to={`/events`} className="block text-center text-xs text-primary-400 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400">
                Показать все события →
              </Link>
            ) : null}
          </div>
        )}
      </Card>
    </section>
  );
}
