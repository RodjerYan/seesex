import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { api } from '../api';

/** Ответ GET /api/health (см. apps/api/src/app.ts healthHandler). */
export interface HealthResponse {
  status: string;
  service: string;
  uptime: number;
}

export const healthQueryKey = ['health'] as const;

/** Заготовка S4; S5 может использовать для индикатора доступности API. */
export function useHealth(): UseQueryResult<HealthResponse> {
  return useQuery<HealthResponse>({
    queryKey: healthQueryKey,
    queryFn: ({ signal }) => api.get<HealthResponse>('/api/health', { auth: false, signal }),
    staleTime: 15_000,
  });
}
