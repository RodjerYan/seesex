import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ImagePlus, Pencil, Trash2 } from 'lucide-react';
import {
  useRef,
  useState,
  type ChangeEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { AuthImage } from '../../components/ui/AuthImage';
import { Stars } from '../../components/ui/Stars';
import { Button, Card, ErrorText, SectionTitle } from '../../components/ui/controls';
import { ErrorBlock, LoadingBlock } from '../../components/ui/states';
import { api, uploadForm } from '../../lib/api';
import { formatDate, formatDateTime, formatDuration, formatTime } from '../../lib/format';
import { errorMessage } from '../../lib/errors';
import { eventQueryKey, overviewQueryKey, useEvent } from '../../lib/queries';
import type { PhotoView } from '../../types/api';
import { eventTypeLabel } from '../../lib/eventTypeLabels';

const STATUS_LABEL: Record<string, string> = {
  occurred: 'Состоялось',
  planned: 'Запланировано',
  turndown: 'Отказ',
};

function Row({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/10 py-2 last:border-b-0">
      <dt className="shrink-0 text-xs text-slate-500">{label}</dt>
      <dd className="text-right text-sm text-slate-200">{children}</dd>
    </div>
  );
}

function NamedList({ items, to }: { items: { id: string; name: string }[]; to?: (id: string) => string }) {
  if (items.length === 0) return <span className="text-xs text-slate-500">—</span>;
  return (
    <span className="flex flex-wrap justify-end gap-1.5">
      {items.map((item) =>
        to ? (
          <Link
            key={item.id}
            to={to(item.id)}
            className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-300 hover:border-primary-400 hover:text-primary-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            {item.name}
          </Link>
        ) : (
          <span key={item.id} className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-300">
            {item.name}
          </span>
        ),
      )}
    </span>
  );
}

/** Детали события: поля, фото, связи, редактирование и удаление. */
export default function EventDetail(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const eventQuery = useEvent(id);
  const [actionError, setActionError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const remove = useMutation({
    mutationFn: () => api.delete(`/api/events/${id ?? ''}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['events'] });
      void queryClient.invalidateQueries({ queryKey: overviewQueryKey });
      navigate('/events', { replace: true });
    },
    onError: (error) => setActionError(errorMessage(error)),
  });

  const onUpload = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = event.target.files;
    event.target.value = '';
    if (!files || files.length === 0 || !id) return;
    const formData = new FormData();
    for (const file of Array.from(files)) formData.append('files', file);
    setUploading(true);
    setActionError(null);
    try {
      await uploadForm<{ photos: PhotoView[] }>(`/api/events/${id}/photos`, formData);
      void queryClient.invalidateQueries({ queryKey: eventQueryKey(id) });
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setUploading(false);
    }
  };

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

  return (
    <section className="px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          to="/events"
          aria-label="Назад к списку"
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <div className="flex gap-2">
          <Link
            to={`/events/${item.id}/edit`}
            className="flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
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
        <p className="text-xs uppercase tracking-wide text-slate-500">
          {STATUS_LABEL[item.status] ?? item.status}
        </p>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-100">
          {item.title || eventTypeLabel(item.eventType)}
          {item.isCustomType ? <span className="ml-2 text-sm font-normal text-slate-500">(свой тип)</span> : null}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
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
          <Row label="Калории">{item.calories === null ? '—' : `${item.calories} ккал`}</Row>
          <Row label="Пульс">{item.heartRate === null ? '—' : `${item.heartRate} уд/мин`}</Row>
          <Row label="Инициатор">{item.initiatedBy || '—'}</Row>
          <Row label="Тип">{eventTypeLabel(item.eventType)}</Row>
          <Row label="Создано">{item.createdAt ? formatDateTime(item.createdAt) : '—'}</Row>
        </dl>
      </Card>

      <Card className="mb-4">
        <SectionTitle>Связи</SectionTitle>
        <dl>
          <Row label="Партнёры">
            <NamedList items={item.partners} to={(partnerId) => `/partners/${partnerId}`} />
          </Row>
          <Row label="Позиции">
            <NamedList items={item.positions} to={(positionId) => `/positions/${positionId}`} />
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

      <Card className="mb-4">
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle>Фото</SectionTitle>
          <Button variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <ImagePlus className="h-4 w-4" aria-hidden="true" />
            {uploading ? 'Загрузка…' : 'Добавить'}
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => void onUpload(event)}
        />
        {item.photos.length === 0 ? (
          <p className="text-xs text-slate-500">Фотографий нет.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {item.photos.map((photo) => (
              <AuthImage
                key={photo.id}
                src={photo.url}
                alt={photo.caption ?? `Фото ${formatDate(photo.createdAt)}`}
                className="aspect-square w-full rounded-lg object-cover"
              />
            ))}
          </div>
        )}
      </Card>

      {item.notes ? (
        <Card>
          <SectionTitle>Заметки</SectionTitle>
          <p className="whitespace-pre-wrap text-sm text-slate-300">{item.notes}</p>
        </Card>
      ) : null}
    </section>
  );
}
