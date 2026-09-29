import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Plus, Trash2, X } from 'lucide-react';
import { useMemo, useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { Button, Card, ErrorText, Fab, Field, Input, SectionTitle } from '../components/ui/controls';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../components/ui/states';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { formatDate } from '../lib/format';
import {
  useAllPositions,
  useWishlist,
  wishlistQueryKey,
} from '../lib/queries';
import type { WishlistView } from '../types/api';

function entryLabel(entry: WishlistView): string {
  return entry.position?.name ?? entry.customName ?? 'Без названия';
}

/** Вишлист: список пожеланий, добавление (из каталога или своим текстом), отметка, удаление. */
export default function Wishlist(): ReactElement {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [positionId, setPositionId] = useState('');
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [showCompleted, setShowCompleted] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  const wishlistQuery = useWishlist();
  const positionsQuery = useAllPositions();

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: wishlistQueryKey });
    void queryClient.invalidateQueries({ queryKey: ['statistics'] });
  };

  const create = useMutation({
    mutationFn: () =>
      api.post<{ entry: WishlistView }>('/api/wishlist', {
        positionId: positionId || undefined,
        customName: positionId ? undefined : customName.trim() || undefined,
        customCategory: positionId ? undefined : customCategory.trim() || undefined,
      }),
    onSuccess: () => {
      setActionError(null);
      setAdding(false);
      setPositionId('');
      setCustomName('');
      setCustomCategory('');
      invalidate();
    },
    onError: (error) => setActionError(errorMessage(error)),
  });

  const toggle = useMutation({
    mutationFn: (entry: WishlistView) =>
      api.put<{ entry: WishlistView }>(`/api/wishlist/${entry.id}/complete`, {
        completed: !entry.isCompleted,
      }),
    onSuccess: invalidate,
    onError: (error) => setActionError(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/wishlist/${id}`),
    onSuccess: invalidate,
    onError: (error) => setActionError(errorMessage(error)),
  });

  const entries = useMemo(() => {
    const all = wishlistQuery.data ?? [];
    return showCompleted ? all : all.filter((entry) => !entry.isCompleted);
  }, [wishlistQuery.data, showCompleted]);

  if (wishlistQuery.isLoading) return <LoadingBlock label="Загрузка вишлиста…" />;
  if (wishlistQuery.isError) {
    return (
      <section className="px-4 py-6 sm:px-6">
        <ErrorBlock error={wishlistQuery.error} onRetry={() => void wishlistQuery.refetch()} />
      </section>
    );
  }

  const all = wishlistQuery.data ?? [];
  const completed = all.filter((entry) => entry.isCompleted).length;

  return (
    <section className="px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-100">Вишлист</h1>
          <p className="text-xs text-slate-500">
            {all.length > 0 ? `Выполнено ${completed} из ${all.length}` : 'Пока пусто'}
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-primary focus:ring-primary-400"
            checked={showCompleted}
            onChange={(event) => setShowCompleted(event.target.checked)}
          />
          Показывать выполненные
        </label>
      </div>

      {actionError ? (
        <div className="mb-4">
          <ErrorText>{actionError}</ErrorText>
        </div>
      ) : null}

      {adding ? (
        <Card className="mb-4">
          <SectionTitle>Новое желание</SectionTitle>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!positionId && !customName.trim()) return;
              create.mutate();
            }}
          >
            <Field
              label="Позиция из каталога"
              htmlFor="wl-position"
              hint="Или оставьте пустым и впишите своё название."
            >
              <Input
                id="wl-position"
                list="wl-positions"
                value={
                  positionId
                    ? (positionsQuery.data ?? []).find((item) => item.id === positionId)?.name ?? ''
                    : ''
                }
                placeholder="Начните вводить название…"
                onChange={(event) => {
                  const value = event.target.value;
                  const match = (positionsQuery.data ?? []).find(
                    (item) => item.name.toLowerCase() === value.trim().toLowerCase(),
                  );
                  setPositionId(match ? match.id : '');
                  if (!match) setCustomName(value);
                }}
              />
              <datalist id="wl-positions">
                {(positionsQuery.data ?? []).map((item) => (
                  <option key={item.id} value={item.name} />
                ))}
              </datalist>
            </Field>

            {!positionId ? (
              <>
                <Field label="Своё название *" htmlFor="wl-name">
                  <Input
                    id="wl-name"
                    value={customName}
                    maxLength={120}
                    onChange={(event) => setCustomName(event.target.value)}
                  />
                </Field>
                <Field label="Категория" htmlFor="wl-category">
                  <Input
                    id="wl-category"
                    value={customCategory}
                    maxLength={60}
                    onChange={(event) => setCustomCategory(event.target.value)}
                  />
                </Field>
              </>
            ) : null}

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={create.isPending || (!positionId && !customName.trim())}
              >
                {create.isPending ? 'Добавляем…' : 'Добавить'}
              </Button>
              <Button variant="ghost" onClick={() => setAdding(false)}>
                <X className="h-4 w-4" aria-hidden="true" />
                Отмена
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {entries.length === 0 ? (
        <EmptyBlock
          title="Вишлист пуст"
          description="Запишите позиции, которые хочется попробовать."
          action={
            <Button onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Добавить
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5"
            >
              <div className="min-w-0">
                {entry.positionId ? (
                  <Link
                    to={`/positions/${entry.positionId}`}
                    className={
                      entry.isCompleted
                        ? 'block truncate text-sm font-medium text-slate-500 line-through hover:text-slate-300'
                        : 'block truncate text-sm font-medium text-slate-100 hover:text-primary-400'
                    }
                  >
                    {entryLabel(entry)}
                  </Link>
                ) : (
                  <p
                    className={
                      entry.isCompleted
                        ? 'truncate text-sm font-medium text-slate-500 line-through'
                        : 'truncate text-sm font-medium text-slate-100'
                    }
                  >
                    {entryLabel(entry)}
                  </p>
                )}
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  {entry.position?.category ?? entry.customCategory ?? 'без категории'} · добавлено{' '}
                  {formatDate(entry.createdAt)}
                  {entry.isCompleted && entry.completedAt
                    ? ` · выполнено ${formatDate(entry.completedAt)}`
                    : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label={entry.isCompleted ? 'Вернуть в планы' : 'Отметить выполненным'}
                  title={entry.isCompleted ? 'Вернуть в планы' : 'Отметить выполненным'}
                  onClick={() => toggle.mutate(entry)}
                  disabled={toggle.isPending}
                  className={
                    entry.isCompleted
                      ? 'rounded-lg p-2 text-emerald-400 hover:bg-slate-800'
                      : 'rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-emerald-400'
                  }
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Удалить из вишлиста"
                  title="Удалить из вишлиста"
                  onClick={() => {
                    if (window.confirm('Удалить запись из вишлиста?')) remove.mutate(entry.id);
                  }}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Fab label="Добавить в вишлист" onClick={() => setAdding(true)}>
        <Plus className="h-6 w-6" aria-hidden="true" />
      </Fab>
    </section>
  );
}
