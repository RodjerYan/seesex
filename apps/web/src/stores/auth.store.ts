/**
 * Zustand auth-store: токены + пользователь, действия login/logout/refresh.
 *
 * Стратегия хранения (см. также README.md, раздел «Токены»):
 * - accessToken + user -> localStorage (переживает перезагрузку страницы;
 *   access токен короткоживущий (15 мин) — приемлемо для SPA);
 * - refreshToken -> sessionStorage (только текущая вкладка): так «свежий»
 *   refresh переживает reload, но не копируется в другие вкладки/вкладки
 *   после закрытия. httpOnly-cookie недоступен для нашего API (Bearer в теле),
 *   поэтому sessionStorage — прагматичный компромисс. XSS-риск описан в README.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { api, refreshAccessToken, setAuthAdapter } from '../lib/api';
import type { SessionUser } from '../types';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** Ответ POST /api/auth/login: либо пара токенов, либо запрос на 2FA. */
export type LoginResult =
  | { kind: 'tokens'; tokens: AuthTokens; user: SessionUser }
  | { kind: 'two_factor'; tmpToken: string };

type LoginResponse = (AuthTokens & { user: SessionUser }) | { requires2FA: true; tmpToken: string };

export const AUTH_STORAGE_KEY = 'xtracker.auth';
export const REFRESH_STORAGE_KEY = 'xtracker.refresh';

function readSessionStorage(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSessionStorage(key: string, value: string | null): void {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    // Приватный режим Safari и т.п. — молча работаем без persistence.
  }
}

/** Модульный refresh-токен (sessionStorage), вне React-состояния. */
let refreshToken: string | null = readSessionStorage(REFRESH_STORAGE_KEY);

export interface AuthState {
  accessToken: string | null;
  user: SessionUser | null;

  /** POST /api/auth/login; при включённой 2FA возвращает tmpToken. */
  login(email: string, password: string): Promise<LoginResult>;
  /** Явное обновление пары токенов ( refresh() вынесен в api ). */
  refresh(): Promise<boolean>;
  /** Выход: инвалидация refresh на бэке (best-effort) + локальный сброс. */
  logout(): Promise<void>;
  /** Установка сессии (login / подтверждение 2FA в S5). */
  setSession(tokens: AuthTokens, user: SessionUser): void;
  /** Локальный сброс без сетевых вызовов (используется api при протухшей сессии). */
  clearSession(): void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,

      login: async (email, password) => {
        const data = await api.post<LoginResponse>(
          '/api/auth/login',
          { email, password },
          { auth: false },
        );
        if ('requires2FA' in data) {
          return { kind: 'two_factor', tmpToken: data.tmpToken };
        }
        const tokens: AuthTokens = {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        };
        get().setSession(tokens, data.user);
        return { kind: 'tokens', tokens, user: data.user };
      },

      refresh: async () => {
        const ok = await refreshAccessToken();
        if (!ok) get().clearSession();
        return ok;
      },

      logout: async () => {
        const currentRefresh = refreshToken;
        try {
          if (currentRefresh) {
            await api.post('/api/auth/logout', { refreshToken: currentRefresh });
          }
        } catch {
          // Best-effort: даже если бэкенд недоступен — чистим локально.
        } finally {
          get().clearSession();
        }
      },

      setSession: (tokens, user) => {
        refreshToken = tokens.refreshToken;
        writeSessionStorage(REFRESH_STORAGE_KEY, tokens.refreshToken);
        set({ accessToken: tokens.accessToken, user });
      },

      clearSession: () => {
        refreshToken = null;
        writeSessionStorage(REFRESH_STORAGE_KEY, null);
        set({ accessToken: null, user: null });
      },
    }),
    {
      name: AUTH_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Refresh намеренно НЕ попадает в localStorage — только sessionStorage.
      partialize: (state) => ({ accessToken: state.accessToken, user: state.user }),
    },
  ),
);

// Адаптер для api.ts (разрывает циклический импорт store <-> api).
setAuthAdapter({
  getAccessToken: () => useAuthStore.getState().accessToken,
  getRefreshToken: () => refreshToken,
  applyRefreshedTokens: ({ accessToken, refreshToken: nextRefreshToken }) => {
    refreshToken = nextRefreshToken;
    writeSessionStorage(REFRESH_STORAGE_KEY, nextRefreshToken);
    useAuthStore.setState({ accessToken });
  },
  onSessionExpired: () => useAuthStore.getState().clearSession(),
});
