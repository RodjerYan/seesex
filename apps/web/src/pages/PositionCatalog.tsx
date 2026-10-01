import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Star, Trash2, X } from 'lucide-react';
import { useMemo, useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { Button, Card, ErrorText, Fab, Field, Input, SectionTitle } from '../components/ui/controls';
import { CardSkeleton, EmptyState } from '../components/ui/listStates';
import { ErrorBlock } from '../components/ui/states';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { POSITION_CATEGORY_LABEL, tr } from '../lib/labels';
import { PositionIcon } from '../lib/positionIcons';
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
    <li className="flex items-center justify-between gap-3 glass px-3 py-2.5 transition-colors press hover:ring-1 hover:ring-white/10 active:ring-1 active:ring-white/20">
      <div className="min-w-0 flex items-center gap-3">
        <PositionIcon name={position.name} className="w-5 h-5 text-slate-400 shrink-0" />
        <div className="min-w-0">
          <Link
            to={`/positions/${position.id}`}
            className="block truncate text-sm font-medium text-slate-100 transition-colors hover:text-primary-400 active:text-primary-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            {position.name}
          </Link>
          <p className="mt-0.5 flex items-center gap-2 truncate text-[11px] text-slate-500">
            <span className="rounded border border-white/10 bg-white/[0.06] px-1.5 py-0.5 uppercase tracking-wide">
              {tr(POSITION_CATEGORY_LABEL, position.category, position.category)}
            </span>
            {position.isSystem ? 'системная' : 'своя'}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          aria-label={inWishlist ? 'Уже в вишлисте' : 'Добавить в вишлист'}
          title={inWishlist ? 'Уже в вишлисте' : 'Добавить в вишлист'}
          disabled={inWishlist}
          onClick={onAddToWishlist}
          className="press rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-amber-300 disabled:opacity-40"
        >
          <Star className={inWishlist ? 'h-4 w-4 fill-amber-400 text-amber-400' : 'h-4 w-4'} aria-hidden="true" />
        </button>
        {onDelete ? (
          <button
            type="button"
            aria-label="Удалить позицию"
            title="Удалить позицию"
            onClick={onDelete}
            className="press rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-red-400"
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
  const [showAll, setShowAll] = useState(false);
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

  // По умолчанию — топ-12; при активном поиске лимит повышается до 60 (как в EventForm).
  const searchActive = search.trim().length > 0;
  const limit = searchActive ? 60 : showAll ? Number.POSITIVE_INFINITY : 12;
  const visible = filtered.slice(0, limit);
  const hiddenCount = filtered.length - visible.length;

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

  if (positionsQuery.isLoading) return <CardSkeleton label="Загрузка каталога…" />;
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
          <h1 className="text-lg font-bold tracking-tight text-slate-100">Каталог позиций</h1>
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
              : 'shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-slate-400'
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
                : 'shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-slate-400'
            }
          >
            {tr(POSITION_CATEGORY_LABEL, item, item)}
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
        <EmptyState
          icon={Search}
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
        <>
          <ul className="stagger space-y-2">
            {visible.map((position) => (
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

          <p className="mt-3 text-center text-xs text-slate-500">
            Показано {visible.length} из {filtered.length}
          </p>

          {!searchActive && hiddenCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="press mt-2 w-full min-h-[44px] rounded-full border border-white/15 bg-white/[0.06] text-sm text-slate-200 transition-colors hover:bg-white/[0.1]"
            >
              Показать все ({filtered.length})
            </button>
          ) : null}

          {!searchActive && showAll && filtered.length > 12 ? (
            <button
              type="button"
              onClick={() => setShowAll(false)}
              className="press mt-2 w-full min-h-[44px] rounded-full border border-white/15 bg-white/[0.06] text-sm text-slate-200 transition-colors hover:bg-white/[0.1]"
            >
              Показать меньше
            </button>
          ) : null}
        </>
      )}

      <Fab label="Создать позицию" onClick={() => setCreating(true)}>
        <Plus className="h-6 w-6" aria-hidden="true" />
      </Fab>
    </section>
  );
}