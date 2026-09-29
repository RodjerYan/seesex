import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ImagePlus, Pencil, Star, Trash2 } from 'lucide-react';
import { useRef, useState, type ChangeEvent, type ReactElement } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { EventCard } from '../../components/events/EventCard';
import { AuthImage } from '../../components/ui/AuthImage';
import { Button, Card, ErrorText, SectionTitle } from '../../components/ui/controls';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/ui/states';
import { api, uploadForm } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { errorMessage } from '../../lib/errors';
import {
  partnerQueryKey,
  partnersQueryKey,
  useEvents,
  usePartner,
  usePartnerStats,
} from '../../lib/queries';
import type { PhotoView } from '../../types/api';

/** Лимит фото партнёра (MAX_PHOTOS_PER_PARTNER на бэке, по умолчанию 3). */
const MAX_PHOTOS = 3;

function DataRow({ label, value }: { label: string; value: string | null | undefined }): ReactElement {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-800/70 py-2 last:border-b-0">
      <dt className="shrink-0 text-xs text-slate-500">{label}</dt>
      <dd className="text-right text-sm text-slate-200">{value || '—'}</dd>
    </div>
  );
}

/** Детали партнёра: данные, фото (≤3), статистика, события, «сделать основным». */
export default function PartnerDetail(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [actionError, setActionError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

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

  const onUpload = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = event.target.files;
    event.target.value = '';
    if (!files || files.length === 0 || !id) return;
    const formData = new FormData();
    for (const file of Array.from(files)) formData.append('files', file);
    setUploading(true);
    setActionError(null);
    try {
      await uploadForm<{ photos: PhotoView[] }>(`/api/partners/${id}/photos`, formData);
      invalidate();
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = (photoId: string): void => {
    if (!id || !window.confirm('Удалить фотографию?')) return;
    setActionError(null);
    void api
      .delete(`/api/partners/${id}/photos/${photoId}`)
      .then(invalidate)
      .catch((error: unknown) => setActionError(errorMessage(error)));
  };

  const onDeletePartner = (): void => {
    if (!window.confirm('Удалить партнёра вместе с его фото? Это действие нельзя отменить.')) return;
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
  const photosLeft = MAX_PHOTOS - partner.photos.length;

  return (
    <section className="px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          to="/partners"
          aria-label="Назад к списку"
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <div className="flex flex-wrap justify-end gap-2">
          <Link
            to={`/partners/${partner.id}/edit`}
            className="flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-800"
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
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-100">
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
          <DataRow label="Пол" value={partner.gender} />
          <DataRow label="Ориентация" value={partner.sexualOrientation} />
          <DataRow label="Местоимения" value={partner.pronouns} />
          <DataRow label="Отношения" value={partner.relationshipStatus} />
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
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle>Фото ({partner.photos.length}/{MAX_PHOTOS})</SectionTitle>
          <Button
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || photosLeft <= 0}
          >
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
        {partner.photos.length === 0 ? (
          <p className="text-xs text-slate-500">Фотографий нет.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {partner.photos.map((photo) => (
              <div key={photo.id} className="relative">
                <AuthImage
                  src={photo.url}
                  alt={`Фото ${partner.name}`}
                  className="aspect-square w-full rounded-lg object-cover"
                />
                <button
                  type="button"
                  aria-label="Удалить фото"
                  onClick={() => deletePhoto(photo.id)}
                  className="absolute right-1 top-1 rounded-full bg-slate-900/80 p-1.5 text-slate-300 hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
        {photosLeft > 0 ? (
          <p className="mt-2 text-[11px] text-slate-600">Можно добавить ещё {photosLeft} фото.</p>
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
          <div className="space-y-3">
            {(eventsQuery.data?.events ?? []).map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
            {(eventsQuery.data?.events ?? []).length < (eventsQuery.data?.total ?? 0) ? (
              <Link to={`/events`} className="block text-center text-xs text-primary-400 hover:text-primary">
                Показать все события →
              </Link>
            ) : null}
          </div>
        )}
      </Card>
    </section>
  );
}
