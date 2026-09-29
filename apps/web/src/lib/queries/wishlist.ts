import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { api } from '../api';
import type { WishlistView } from '../../types/api';

export const wishlistQueryKey = ['wishlist', 'list'] as const;

/** GET /api/wishlist. */
export function useWishlist(): UseQueryResult<WishlistView[]> {
  return useQuery<WishlistView[]>({
    queryKey: wishlistQueryKey,
    queryFn: ({ signal }) =>
      api.get<{ entries: WishlistView[] }>('/api/wishlist', { signal }).then((r) => r.entries),
    staleTime: 15_000,
  });
}
