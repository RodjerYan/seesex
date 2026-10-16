import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Heart, Pencil, Trash2 } from 'lucide-react';
import { useState, type ReactElement, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Stars } from '../../components/ui/Stars';
import { Button, Card, ErrorText, SectionTitle } from '../../components/ui/controls';
import { StatusPill } from '../../components/ui/primitives';
import { ErrorBlock, LoadingBlock } from '../../components/ui/states';
import { api } from '../../lib/api';
import { formatDate, formatDateTime, formatDuration, formatTime } from '../../lib/format';
import { errorMessage } from '../../lib/errors';
import { overviewQueryKey, useEvent } from '../../lib/queries';
import { eventMeta } from '../../lib/eventMeta';

const STATUS_LABEL: Record<string, string> = {
  occurred: 'Состоялось',
  planned: 'Запланировано',
  turndown: 'Отказ',
};

function Row({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] py-2.5 last:border-b-0">
      <dt className="shrink-0 text-[13px] text-ink-dim">{label}</dt>
      <dd className="min-w-0 text-right text-[15px] leading-5 text-ink">{children}</dd>
    </div>
  );
}

function NamedList({ items, to }: { items: { id: string; name: string }[]; to?: (id: string) => string }) {
  if (items.length === 0) return <span className="text-[13px] text-ink-dim">—</span>;
  return (
    <span className="flex flex-wrap justify-end gap-1.5">
      {items.map((item) =>
        to ? (
          <Link
            key={item.id}
            to={to(item.id)}
            className="rounded-full border border-white/[0.08] bg-elev-2 px-2.5 py-1 text-xs text-ink-muted hover:border-primary/40 hover:text-primary-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            {item.name}
          </Link>
        ) : (
          <span key={item.id} className="rounded-full border border-white/[0.08] bg-elev-2 px-2.5 py-1 text-xs text-ink-muted">
            {item.name}
          </span>
        ),
      )}
    </span>
  );
}

/** Детали события: поля, связи, редактирование и удаление. */
export default function EventDetail(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const eventQuery = useEvent(id);
  const [actionError, setActionError] = useState<string | null>(null);

  const remove = useMutation({
    mutationFn: () => api.delete(`/api/events/${id ?? ''}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['events'] });
      void queryClient.invalidateQueries({ queryKey: overviewQueryKey });
      navigate('/events', { replace: true });
    },
    onError: (error) => setActionError(errorMessage(error)),
  });

  const onDelete = (): void => {
    if (!window.confirm('Удалить событие? Это действие нельзя отменить.')) return;
    setActionError(null);
    remove.mutate();
  };

  if (eventQuery.isLoading) return <LoadingBlock label="Загрузка события…" />;
  if (eventQuery.isError || !eventQuery.data) {
    return (
      <section className="px-4 py-6 sm:px-6">
        <ErrorBlock error={eventQuery.error} onRetry={() => void eventQuery.refetch()} />
      </section>
    );
  }

  const item = eventQuery.data;
  const date = new Date(item.date);
  const { Icon, color, label } = eventMeta(item.eventType);

  // Пульс/калории одной строкой: «♥ 88 уд/мин · 181 ккал».
  const heartRatePart = item.heartRate === null ? null : `${item.heartRate} уд/мин`;
  const caloriesPart = item.calories === null ? null : `${item.calories} ккал`;
  const healthPart = [heartRatePart, caloriesPart].filter(Boolean).join(' · ');

  return (
    <section className="px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          to="/events"
          aria-label="Назад к списку"
          className="rounded-full p-2 text-ink-muted transition-colors hover:bg-white/[0.06] hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <div className="flex gap-2">
          <Link
            to={`/events/${item.id}/edit`}
            className="inline-flex h-12 items-center gap-1.5 rounded-full border border-white/[0.08] bg-elev-2 px-4 text-sm text-ink transition-colors hover:bg-elev-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Изменить
          </Link>
          <Button variant="danger" onClick={onDelete} disabled={remove.isPending}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {remove.isPending ? 'Удаляем…' : 'Удалить'}
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <StatusPill status={item.status}>
          {STATUS_LABEL[item.status] ?? item.status}
        </StatusPill>
        <h1 className="mt-2 text-[22px] font-semibold tracking-tight text-ink">
          {item.title || label}
          {item.isCustomType ? <span className="ml-2 text-[13px] font-normal text-ink-dim">(свой тип)</span> : null}
        </h1>
        <p className="num mt-1 text-[13px] text-ink-muted">
          {formatDate(item.date)} · {formatTime(date)}
        </p>
      </div>

      {actionError ? (
        <div className="mb-4">
          <ErrorText>{actionError}</ErrorText>
        </div>
      ) : null}

      <Card className="mb-4">
        <SectionTitle>Параметры</SectionTitle>
        <dl>
          <Row label="Оценка">
            <Stars value={item.rating} />
          </Row>
          <Row label="Длительность">{formatDuration(item.duration)}</Row>
          <Row label="Пульс и калории">
            {healthPart ? (
              <span className="inline-flex items-center gap-1.5">
                <Heart className="h-3.5 w-3.5 text-red-400" aria-hidden="true" />
                {healthPart}
              </span>
            ) : (
              '—'
            )}
          </Row>
          <Row label="Инициатор">{item.initiatedBy || '—'}</Row>
          <Row label="Тип">
            <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
              <span
                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]"
                style={{
                  borderColor: `${color}55`,
                  backgroundColor: `${color}1A`,
                  color,
                }}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
              </span>
              {item.isCustomType && item.eventType.trim() !== label ? (
                <span className="text-xs text-ink-dim">{item.eventType}</span>
              ) : null}
            </span>
          </Row>
          <Row label="Создано">{item.createdAt ? formatDateTime(item.createdAt) : '—'}</Row>
        </dl>
      </Card>

      <Card className="mb-4">
        <SectionTitle>Связи</SectionTitle>
        <dl>
          <Row label="Партнёры">
            <NamedList items={item.partners} to={(partnerId) => `/partners/${partnerId}`} />
          </Row>
          <Row label="Настроения">
            <NamedList items={item.moods} />
          </Row>
          <Row label="Места">
            <NamedList items={item.places} />
          </Row>
          <Row label="Аксессуары">
            <NamedList items={item.accessories} />
          </Row>
          {item.groupCalendar ? (
            <Row label="Групповой календарь">
              <Link
                to={`/group-calendars/${item.groupCalendar.id}`}
                className="text-primary-400 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                {item.groupCalendar.name}
              </Link>
            </Row>
          ) : null}
        </dl>
      </Card>

      {item.notes ? (
        <Card>
          <SectionTitle>Заметки</SectionTitle>
          <p className="whitespace-pre-wrap text-[15px] leading-6 text-ink">{item.notes}</p>
        </Card>
      ) : null}
    </section>
  );
}
