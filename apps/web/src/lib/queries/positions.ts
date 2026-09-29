import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { api } from '../api';
import type { PositionView, SystemPositionsResult } from '../../types/api';

export const allPositionsQueryKey = ['positions', 'all'] as const;
export const categoriesQueryKey = ['positions', 'categories'] as const;
export const systemPositionsQueryKey = (category: string, offset: number, limit: number) =>
  ['positions', 'system', category, offset, limit] as const;

/** GET /api/positions — системные + свои (без пагинации; нужен для поиска/детали). */
export function useAllPositions(): UseQueryResult<PositionView[]> {
  return useQuery<PositionView[]>({
    queryKey: allPositionsQueryKey,
    queryFn: ({ signal }) =>
      api.get<{ positions: PositionView[] }>('/api/positions', { signal }).then((r) => r.positions),
    staleTime: 5 * 60_000,
  });
}

/** GET /api/positions/categories. */
export function usePositionCategories(): UseQueryResult<string[]> {
  return useQuery<string[]>({
    queryKey: categoriesQueryKey,
    queryFn: ({ signal }) =>
      api.get<{ categories: string[] }>('/api/positions/categories', { signal }).then((r) => r.categories),
    staleTime: 5 * 60_000,
  });
}

/** GET /api/positions/system — пагинация + фильтр по категории. */
export function useSystemPositions(
  category: string,
  offset: number,
  limit: number,
): UseQueryResult<SystemPositionsResult> {
  return useQuery<SystemPositionsResult>({
    queryKey: systemPositionsQueryKey(category, offset, limit),
    queryFn: ({ signal }) =>
      api.get<SystemPositionsResult>('/api/positions/system', {
        query: { category: category || undefined, offset, limit },
        signal,
      }),
    staleTime: 5 * 60_000,
  });
}
