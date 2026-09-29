import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { api } from '../api';
import type { SessionView } from '../../types/api';

export const sessionsQueryKey = ['auth', 'sessions'] as const;

/** GET /api/auth/sessions — сессии текущего пользователя. */
export function useSessions(): UseQueryResult<SessionView[]> {
  return useQuery<SessionView[]>({
    queryKey: sessionsQueryKey,
    queryFn: ({ signal }) =>
      api.get<{ sessions: SessionView[] }>('/api/auth/sessions', { signal }).then((r) => r.sessions),
    staleTime: 15_000,
  });
}
