import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Star, Trash2 } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { EventCard } from '../../components/events/EventCard';
import { Button, Card, ErrorText } from '../../components/ui/controls';
import { Badge, ListRow, SectionHeader } from '../../components/ui/primitives';
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

/**
 * Метаданные-строка (ListRow): label — .type-label ink-dim uppercase,
 * значение — tabular-nums справа, разделитель — hairline.
 * `-mx-4` растягивает строку во всю ширину карточки (компенсирует p-4 Card).
 */
function DataRow({ label, value }: { label: string; value: string | null | undefined }): ReactElement {
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
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-white/[0.06] hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <div className="flex flex-wrap justify-end gap-2">
          <Link
            to={`/partners/${partner.id}/edit`}
            className="press inline-flex h-12 items-center gap-2 rounded-full border border-white/[0.08] bg-elev-2 px-4 text-sm font-medium text-ink transition-colors hover:bg-elev-3 active:bg-elev-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
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
        <h1 className="flex items-center gap-2 text-[22px] font-semibold leading-7 text-ink">
          {partner.name}
          {partner.isPrimary ? (
            <Badge tone="amber">
              <Star className="h-2.5 w-2.5 fill-amber-400" aria-hidden="true" />
              основной
            </Badge>
          ) : null}
        </h1>
        <p className="mt-1 text-[13px] text-ink-muted">
          В приложении с <span className="num">{formatDate(partner.createdAt)}</span>
        </p>
      </div>

      {actionError ? (
        <div className="mb-4">
          <ErrorText>{actionError}</ErrorText>
        </div>
      ) : null}

      <Card className="mb-4">
        <SectionHeader>Данные</SectionHeader>
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
        {partner.customFields && Object.keys(partner.customFields).length > 0 ? (
          <div className="mt-2">
            {Object.entries(partner.customFields).map(([key, value]) => (
              <DataRow key={key} label={key} value={String(value)} />
            ))}
          </div>
        ) : null}
      </Card>

      <Card className="mb-4">
        <SectionHeader>Статистика</SectionHeader>
        {statsQuery.isLoading ? (
          <LoadingBlock label="Загрузка статистики…" />
        ) : stat ? (
          <>
            <DataRow label="Событий" value={String(stat.count)} />
            <DataRow label="Средняя оценка" value={stat.avgRating === null ? null : String(stat.avgRating)} />
            <DataRow label="Последнее событие" value={stat.lastDate ? formatDate(stat.lastDate) : null} />
          </>
        ) : (
          <p className="text-[13px] text-ink-muted">Событий с этим партнёром пока нет.</p>
        )}
      </Card>

      <Card>
        <SectionHeader>События</SectionHeader>
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
              <Link
                to={`/events`}
                className="block py-3 text-center text-[13px] text-primary-400 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                Показать все события →
              </Link>
            ) : null}
          </div>
        )}
      </Card>
    </section>
  );
}
