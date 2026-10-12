import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';

import { api } from '../api';
import { meQueryKey } from './me';
import { sessionsQueryKey } from './sessions';
import { useAuthStore } from '../../stores/auth.store';

export const profileQueryKey = ['auth', 'profile'] as const;

export interface ProfileView {
  displayName: string | null;
  avatarUrl: string | null;
}

/** GET /api/auth/profile — никнейм + аватар. */
export function useProfile(): UseQueryResult<ProfileView> {
  return useQuery<ProfileView>({
    queryKey: profileQueryKey,
    queryFn: ({ signal }) => api.get<ProfileView>('/api/auth/profile', { signal }),
    staleTime: 60_000,
  });
}

/** PATCH /api/auth/profile — частичное обновление никнейма/аватара. */
export function useUpdateProfile(): UseMutationResult<
  ProfileView,
  unknown,
  { displayName?: string; avatarUrl?: string }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { displayName?: string; avatarUrl?: string }) =>
      api.patch<ProfileView>('/api/auth/profile', input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: profileQueryKey });
      void qc.invalidateQueries({ queryKey: meQueryKey });
    },
  });
}

/** POST /api/auth/password — смена пароля (204). */
export function useChangePassword(): UseMutationResult<
  void,
  unknown,
  { currentPassword: string; newPassword: string }
> {
  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      api.post<void>('/api/auth/password', input),
  });
}

export interface TotpSetupResult {
  secret: string;
  otpauthUrl: string;
  setupToken: string;
}

/** POST /api/auth/totp/setup — секрет + otpauth-URL для QR. */
export function useTotpSetup(): UseMutationResult<TotpSetupResult, unknown, void> {
  return useMutation({
    mutationFn: () => api.post<TotpSetupResult>('/api/auth/totp/setup', {}),
  });
}

/** POST /api/auth/totp/disable — отключение 2FA паролем (204). */
export function useTotpDisable(): UseMutationResult<void, unknown, { password: string }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { password: string }) => api.post<void>('/api/auth/totp/disable', input),
    onSuccess: () => {
      // useMe читает user из auth-store — патчим hasTotp локально (setState,
      // НЕ setSession: тот перезаписал бы refresh-токен пустой строкой).
      const store = useAuthStore.getState();
      if (store.user) {
        useAuthStore.setState({ user: { ...store.user, hasTotp: false } });
      }
      void qc.invalidateQueries({ queryKey: meQueryKey });
    },
  });
}

/** DELETE /api/auth/sessions/:id — закрытие сессии (204). */
export function useDeleteSession(): UseMutationResult<void, unknown, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/auth/sessions/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: sessionsQueryKey });
    },
  });
}
