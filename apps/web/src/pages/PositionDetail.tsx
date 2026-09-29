import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Star, Trash2 } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Button, Card, ErrorText, Field, Input, SectionTitle } from '../components/ui/controls';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../components/ui/states';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { formatDate } from '../lib/format';
import { PositionIcon } from '../lib/positionIcons';
import {
  allPositionsQueryKey,
  categoriesQueryKey,
  useAllPositions,
  usePositionStats,
  useWishlist,
  wishlistQueryKey,
} from '../lib/queries';
import type { PositionView, WishlistView } from '../types/api';

function DataRow({ label, value }: { label: string; value: string | null | undefined }): ReactElement {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/10 py-2 last:border-b-0">
      <dt className="shrink-0 text-xs text-slate-500">{label}</dt>
      <dd className="text-right text-sm text-slate-200">{value || '—'}</dd>
    </div>
  );
}

/** Детали позиции: данные, статистика, вишлист, редактирование/удаление своих. */
export default function PositionDetail(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const positionsQuery = useAllPositions();
  const statsQuery = usePositionStats({});
  const wishlistQuery = useWishlist();

  const position = (positionsQuery.data ?? []).find((item) => item.id === id) ?? null;
  const stat = (statsQuery.data?.positions ?? []).find((item) => item.id === id) ?? null;
  const wishlistEntry = (wishlistQuery.data ?? []).find((entry) => entry.positionId === id) ?? null;

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: allPositionsQueryKey });
    void queryClient.invalidateQueries({ queryKey: categoriesQueryKey });
    void queryClient.invalidateQueries({ queryKey: wishlistQueryKey });
    void queryClient.invalidateQueries({ queryKey: ['statistics'] });
  };

  const addToWishlist = useMutation({
    mutationFn: () => api.post<{ entry: WishlistView }>('/api/wishlist', { positionId: id }),
    onSuccess: invalidate,
    onError: (error) => setActionError(errorMessage(error)),
  });

  const update = useMutation({
    mutationFn: (input: { name: string; category: string }) =>
      api.put<{ position: PositionView }>(`/api/positions/${id ?? ''}`, input),
    onSuccess: () => {
      setEditing(false);
      setActionError(null);
      invalidate();
    },
    onError: (error) => setActionError(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/api/positions/${id ?? ''}`),
    onSuccess: () => {
      invalidate();
      navigate('/positions', { replace: true });
    },
    onError: (error) => setActionError(errorMessage(error)),
  });

  if (positionsQuery.isLoading) return <LoadingBlock label="Загрузка позиции…" />;
  if (positionsQuery.isError) {
    return (
      <section className="px-4 py-6 sm:px-6">
        <ErrorBlock error={positionsQuery.error} onRetry={() => void positionsQuery.refetch()} />
      </section>
    );
  }

  if (!position) {
    return (
      <section className="px-4 py-6 sm:px-6">
        <EmptyBlock
          title="Позиция не найдена"
          description="Возможно, она была удалена."
          action={
            <Button onClick={() => navigate('/positions')}>Вернуться в каталог</Button>
          }
        />
      </section>
    );
  }

  const isOwn = !position.isSystem;

  return (
    <section className="px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          to="/positions"
          aria-label="Назад в каталог"
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-100"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              if (wishlistEntry) return;
              addToWishlist.mutate();
            }}
            disabled={Boolean(wishlistEntry) || addToWishlist.isPending}
          >
            <Star className="h-4 w-4" aria-hidden="true" />
            {wishlistEntry ? 'В вишлисте' : 'В вишлист'}
          </Button>
          {isOwn ? (
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setEditName(position.name);
                  setEditCategory(position.category);
                  setEditing((value) => !value);
                }}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Изменить
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  if (window.confirm(`Удалить позицию «${position.name}»?`)) remove.mutate();
                }}
                disabled={remove.isPending}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Удалить
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="mb-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">{position.category}</p>
        <div className="mt-1 flex items-center gap-3">
          <PositionIcon name={position.name} className="w-7 h-7 text-primary-400" />
          <h1 className="text-xl font-semibold tracking-tight text-slate-100">{position.name}</h1>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {position.isSystem ? 'Системная позиция' : 'Пользовательская позиция'}
          {position.iconName ? ` · иконка: ${position.iconName}` : ''}
        </p>
      </div>

      {actionError ? (
        <div className="mb-4">
          <ErrorText>{actionError}</ErrorText>
        </div>
      ) : null}

      {editing ? (
        <Card className="mb-4">
          <SectionTitle>Редактирование</SectionTitle>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const name = editName.trim();
              if (!name) return;
              update.mutate({ name, category: editCategory.trim() || position.category });
            }}
          >
            <Field label="Название *" htmlFor="pd-name">
              <Input
                id="pd-name"
                value={editName}
                maxLength={120}
                onChange={(event) => setEditName(event.target.value)}
              />
            </Field>
            <Field label="Категория" htmlFor="pd-category">
              <Input
                id="pd-category"
                value={editCategory}
                maxLength={60}
                onChange={(event) => setEditCategory(event.target.value)}
              />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" disabled={update.isPending || !editName.trim()}>
                {update.isPending ? 'Сохраняем…' : 'Сохранить'}
              </Button>
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Отмена
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card>
        <SectionTitle>Статистика</SectionTitle>
        {statsQuery.isLoading ? (
          <LoadingBlock label="Загрузка статистики…" />
        ) : stat ? (
          <dl>
            <DataRow label="Использований" value={String(stat.count)} />
            <DataRow label="Средняя оценка" value={stat.avgRating === null ? null : String(stat.avgRating)} />
            <DataRow label="Последний раз" value={stat.lastDate ? formatDate(stat.lastDate) : null} />
          </dl>
        ) : (
          <p className="text-xs text-slate-500">Эта позиция ещё не использовалась в событиях.</p>
        )}
      </Card>
    </section>
  );
}
