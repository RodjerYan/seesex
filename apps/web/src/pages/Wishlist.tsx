import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Heart, Plus, Trash2, X } from 'lucide-react';
import { useMemo, useState, type ReactElement } from 'react';

import { Button, Card, ErrorText, Fab, Field, Input, SectionTitle } from '../components/ui/controls';
import { CardSkeleton, EmptyState } from '../components/ui/listStates';
import { Badge } from '../components/ui/primitives';
import { ErrorBlock } from '../components/ui/states';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { formatDate } from '../lib/format';
import { useWishlist, wishlistQueryKey } from '../lib/queries';
import type { WishlistView } from '../types/api';

function entryLabel(entry: WishlistView): string {
  return entry.customName ?? 'Без названия';
}

/** Подпись категории записи: свои оставляем как есть. */
function entryCategory(entry: WishlistView): string {
  return entry.customCategory || 'без категории';
}

/** Вишлист: список пожеланий, добавление своим текстом, отметка, удаление. */
export default function Wishlist(): ReactElement {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [showCompleted, setShowCompleted] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  const wishlistQuery = useWishlist();

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: wishlistQueryKey });
    void queryClient.invalidateQueries({ queryKey: ['statistics'] });
  };

  const create = useMutation({
    mutationFn: () =>
      api.post<{ entry: WishlistView }>('/api/wishlist', {
        customName: customName.trim() || undefined,
        customCategory: customCategory.trim() || undefined,
      }),
    onSuccess: () => {
      setActionError(null);
      setAdding(false);
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

  if (wishlistQuery.isLoading) return <CardSkeleton label="Загрузка вишлиста…" />;
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
          <h1 className="text-[22px] font-semibold text-ink">Вишлист</h1>
          <p className="num text-[13px] text-ink-muted">
            {all.length > 0 ? `Выполнено ${completed} из ${all.length}` : 'Пока пусто'}
          </p>
        </div>
        <label className="flex items-center gap-2 text-[13px] text-ink-muted">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-white/10 bg-white/[0.06] text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
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
              if (!customName.trim()) return;
              create.mutate();
            }}
          >
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

            <div className="flex gap-2">
              <Button type="submit" disabled={create.isPending || !customName.trim()}>
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
        <EmptyState
          icon={Heart}
          iconClass="animate-heart-beat"
          title="Вишлист пуст"
          description="Запишите, что хочется попробовать."
          action={
            <Button onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Добавить
            </Button>
          }
        />
      ) : (
        <ul className="stagger space-y-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="glass flex items-center justify-between gap-3 rounded-card px-3.5 py-3 transition-colors press hover:ring-1 hover:ring-white/[0.12] active:ring-1 active:ring-white/20"
            >
              <div className="min-w-0">
                <p
                  className={
                    entry.isCompleted
                      ? 'truncate text-[15px] font-medium leading-5 text-ink-dim line-through'
                      : 'truncate text-[15px] font-medium leading-5 text-ink'
                  }
                >
                  {entryLabel(entry)}
                </p>
                <p className="num mt-0.5 truncate text-[13px] text-ink-muted">
                  {entryCategory(entry)} · добавлено {formatDate(entry.createdAt)}
                </p>
                {entry.isCompleted ? (
                  <p className="mt-1.5">
                    <Badge tone="emerald">
                      выполнено{entry.completedAt ? ` ${formatDate(entry.completedAt)}` : ''}
                    </Badge>
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label={entry.isCompleted ? 'Вернуть в планы' : 'Отметить выполненным'}
                  title={entry.isCompleted ? 'Вернуть в планы' : 'Отметить выполненным'}
                  onClick={() => toggle.mutate(entry)}
                  disabled={toggle.isPending}
                  className="press press-heart rounded-full p-3 text-ink-muted transition-colors hover:bg-white/[0.06] hover:text-emerald-400 active:bg-white/[0.06]"
                >
                  <Check className="press-heart-icon h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Удалить из вишлиста"
                  title="Удалить из вишлиста"
                  onClick={() => {
                    if (window.confirm('Удалить запись из вишлиста?')) remove.mutate(entry.id);
                  }}
                  className="press rounded-full p-3 text-ink-muted transition-colors hover:bg-white/[0.06] hover:text-red-400 active:bg-white/[0.06]"
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