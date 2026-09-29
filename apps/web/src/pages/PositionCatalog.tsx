import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Star, Trash2, X } from 'lucide-react';
import { useMemo, useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { Button, Card, ErrorText, Fab, Field, Input, SectionTitle } from '../components/ui/controls';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../components/ui/states';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import {
  allPositionsQueryKey,
  categoriesQueryKey,
  useAllPositions,
  usePositionCategories,
  useWishlist,
  wishlistQueryKey,
} from '../lib/queries';
import type { PositionView, WishlistView } from '../types/api';

/** Позиция в строке каталога: имя, категория, бейдж, действия. */
function PositionRow({
  position,
  inWishlist,
  onAddToWishlist,
  onDelete,
}: {
  position: PositionView;
  inWishlist: boolean;
  onAddToWishlist: () => void;
  onDelete?: () => void;
}): ReactElement {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5">
      <div className="min-w-0">
        <Link to={`/positions/${position.id}`} className="block truncate text-sm font-medium text-slate-100 hover:text-primary-400">
          {position.name}
        </Link>
        <p className="mt-0.5 flex items-center gap-2 truncate text-[11px] text-slate-500">
          <span className="rounded border border-slate-700 px-1.5 py-0.5 uppercase tracking-wide">
            {position.category}
          </span>
          {position.isSystem ? 'системная' : 'своя'}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          aria-label={inWishlist ? 'Уже в вишлисте' : 'Добавить в вишлист'}
          title={inWishlist ? 'Уже в вишлисте' : 'Добавить в вишлист'}
          disabled={inWishlist}
          onClick={onAddToWishlist}
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-amber-300 disabled:opacity-40"
        >
          <Star className={inWishlist ? 'h-4 w-4 fill-amber-400 text-amber-400' : 'h-4 w-4'} aria-hidden="true" />
        </button>
        {onDelete ? (
          <button
            type="button"
            aria-label="Удалить позицию"
            title="Удалить позицию"
            onClick={onDelete}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </li>
  );
}

/** Каталог позиций: поиск, категории, добавление в вишлист, свои позиции (create/delete). */
export default function PositionCatalog(): ReactElement {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('STANDARD');
  const [actionError, setActionError] = useState<string | null>(null);

  const positionsQuery = useAllPositions();
  const categoriesQuery = usePositionCategories();
  const wishlistQuery = useWishlist();

  const wishlistPositionIds = useMemo(() => {
    const ids = new Set<string>();
    for (const entry of wishlistQuery.data ?? []) {
      if (entry.positionId) ids.add(entry.positionId);
    }
    return ids;
  }, [wishlistQuery.data]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (positionsQuery.data ?? []).filter((position) => {
      if (category && position.category !== category) return false;
      if (query && !position.name.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [positionsQuery.data, category, search]);

  const addToWishlist = useMutation({
    mutationFn: (positionId: string) =>
      api.post<{ entry: WishlistView }>('/api/wishlist', { positionId }),
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: wishlistQueryKey });
    },
    onError: (error) => setActionError(errorMessage(error)),
  });

  const createPosition = useMutation({
    mutationFn: (input: { name: string; category: string }) =>
      api.post<{ position: PositionView }>('/api/positions', input),
    onSuccess: () => {
      setActionError(null);
      setCreating(false);
      setNewName('');
      void queryClient.invalidateQueries({ queryKey: allPositionsQueryKey });
      void queryClient.invalidateQueries({ queryKey: categoriesQueryKey });
    },
    onError: (error) => setActionError(errorMessage(error)),
  });

  const removePosition = useMutation({
    mutationFn: (id: string) => api.delete(`/api/positions/${id}`),
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: allPositionsQueryKey });
      void queryClient.invalidateQueries({ queryKey: categoriesQueryKey });
    },
    onError: (error) => setActionError(errorMessage(error)),
  });

  if (positionsQuery.isLoading) return <LoadingBlock label="Загрузка каталога…" />;
  if (positionsQuery.isError) {
    return (
      <section className="px-4 py-6 sm:px-6">
        <ErrorBlock error={positionsQuery.error} onRetry={() => void positionsQuery.refetch()} />
      </section>
    );
  }

  const categories = categoriesQuery.data ?? [];

  return (
    <section className="px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-100">Каталог позиций</h1>
          <p className="text-xs text-slate-500">
            {positionsQuery.data ? `Найдено ${filtered.length} из ${positionsQuery.data.length}` : '\u00A0'}
          </p>
        </div>
      </div>

      <div className="relative mb-3">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
          aria-hidden="true"
        />
        <Input
          type="search"
          aria-label="Поиск позиции"
          placeholder="Поиск позиции…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="pl-9"
        />
      </div>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setCategory('')}
          className={
            category === ''
              ? 'shrink-0 rounded-full border border-primary-400 bg-primary/10 px-3 py-1 text-xs text-primary-400'
              : 'shrink-0 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400'
          }
        >
          Все
        </button>
        {categories.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setCategory(item)}
            className={
              category === item
                ? 'shrink-0 rounded-full border border-primary-400 bg-primary/10 px-3 py-1 text-xs text-primary-400'
                : 'shrink-0 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400'
            }
          >
            {item}
          </button>
        ))}
      </div>

      {actionError ? (
        <div className="mb-3">
          <ErrorText>{actionError}</ErrorText>
        </div>
      ) : null}

      {creating ? (
        <Card className="mb-4">
          <SectionTitle>Новая позиция</SectionTitle>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const name = newName.trim();
              if (!name) return;
              createPosition.mutate({ name, category: newCategory.trim() || 'STANDARD' });
            }}
          >
            <Field label="Название *" htmlFor="pc-name">
              <Input
                id="pc-name"
                value={newName}
                maxLength={120}
                onChange={(event) => setNewName(event.target.value)}
                autoFocus
              />
            </Field>
            <Field label="Категория" htmlFor="pc-category" hint="Можно придумать свою — просто впишите текст.">
              <Input
                id="pc-category"
                list="pc-categories"
                value={newCategory}
                maxLength={60}
                onChange={(event) => setNewCategory(event.target.value)}
              />
              <datalist id="pc-categories">
                {categories.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </Field>
            <div className="flex gap-2">
              <Button type="submit" disabled={createPosition.isPending || !newName.trim()}>
                {createPosition.isPending ? 'Сохраняем…' : 'Создать'}
              </Button>
              <Button variant="ghost" onClick={() => setCreating(false)}>
                <X className="h-4 w-4" aria-hidden="true" />
                Отмена
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyBlock
          title="Ничего не найдено"
          description="Измените поиск или создайте свою позицию."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Создать позицию
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((position) => (
            <PositionRow
              key={position.id}
              position={position}
              inWishlist={wishlistPositionIds.has(position.id)}
              onAddToWishlist={() => addToWishlist.mutate(position.id)}
              onDelete={
                position.isSystem
                  ? undefined
                  : () => {
                      if (window.confirm(`Удалить позицию «${position.name}»?`)) {
                        removePosition.mutate(position.id);
                      }
                    }
              }
            />
          ))}
        </ul>
      )}

      <Fab label="Создать позицию" onClick={() => setCreating(true)}>
        <Plus className="h-6 w-6" aria-hidden="true" />
      </Fab>
    </section>
  );
}
