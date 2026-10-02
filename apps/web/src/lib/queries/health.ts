import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { api } from '../api';
import type { HealthTokenCreated, HealthTokenRevoked, HealthTokenStatus } from '../../types/api';

/** Ответ GET /api/health (см. apps/api/src/app.ts healthHandler). */
export interface HealthResponse {
  status: string;
  service: string;
  uptime: number;
}

export const healthQueryKey = ['health'] as const;
export const healthTokenStatusQueryKey = ['health', 'token'] as const;

/** Заготовка S4; S5 может использовать для индикатора доступности API. */
export function useHealth(): UseQueryResult<HealthResponse> {
  return useQuery<HealthResponse>({
    queryKey: healthQueryKey,
    queryFn: ({ signal }) => api.get<HealthResponse>('/api/health', { auth: false, signal }),
    staleTime: 15_000,
  });
}

/**
 * GET /api/health/token (JWT) — статус device-токенов Apple Health:
 * есть ли токен, сколько их и когда была последняя синхронизация.
 */
export function useHealthTokenStatus(): UseQueryResult<HealthTokenStatus> {
  return useQuery<HealthTokenStatus>({
    queryKey: healthTokenStatusQueryKey,
    queryFn: ({ signal }) => api.get<HealthTokenStatus>('/api/health/token', { signal }),
    staleTime: 15_000,
  });
}

/** POST /api/health/token { action: 'create' } — новый device-токен (показывается один раз). */
export function useCreateHealthToken(): UseMutationResult<HealthTokenCreated, unknown, void> {
  const queryClient = useQueryClient();
  return useMutation<HealthTokenCreated, unknown, void>({
    mutationFn: () => api.post<HealthTokenCreated>('/api/health/token', { action: 'create' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: healthTokenStatusQueryKey }),
  });
}

/** POST /api/health/token { action: 'revoke' } — отзыв всех device-токенов пользователя. */
export function useRevokeHealthToken(): UseMutationResult<HealthTokenRevoked, unknown, void> {
  const queryClient = useQueryClient();
  return useMutation<HealthTokenRevoked, unknown, void>({
    mutationFn: () => api.post<HealthTokenRevoked>('/api/health/token', { action: 'revoke' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: healthTokenStatusQueryKey }),
  });
}
