import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useAuthStore } from '../../stores/auth.store';
import type { SessionUser } from '../../types';

export const meQueryKey = ['auth', 'me'] as const;

/**
 * Текущий пользователь.
 *
 * TODO(S5): на бэке пока нет GET /api/auth/me — сейчас источник истины
 * (ответ login) лежит в auth-store; заменить на запрос, когда эндпоинт появится.
 */
export function useMe(): UseQueryResult<SessionUser | null> {
  const user = useAuthStore((state) => state.user);

  return useQuery<SessionUser | null>({
    queryKey: meQueryKey,
    queryFn: async () => user,
    enabled: user !== null,
    staleTime: 60_000,
  });
}
