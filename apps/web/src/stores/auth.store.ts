/**
 * Zustand auth-store: токены + пользователь, действия login/logout/refresh.
 *
 * Стратегия хранения (см. также README.md, раздел «Токены»):
 * - accessToken + user -> localStorage (переживает перезагрузку страницы;
 *   access токен короткоживущий (15 мин) — приемлемо для SPA);
 * - refreshToken -> localStorage (ключ xtracker.refresh): переживает закрытие
 *   браузера/приложения, чтобы пользователь не вводил логин/пароль повторно.
 *   XSS-трейдофф: refresh доступен любому JS в origin. httpOnly-cookie невозможен,
 *   так как API принимает refresh только в теле запроса ({ refreshToken }),
 *   cookie-flow в бэкенде не реализован (вне скоупа). Митигации: короткий TTL
 *   access (15 мин), helmet/CSP на бэке, отсутствие стороннего JS.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { api, refreshAccessToken, setAuthAdapter, isTokenExpiring } from '../lib/api';
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

function readLocalStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Приватный режим Safari и т.п. — молча работаем без persistence.
  }
}

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

/**
 * Миграция: если в localStorage нет refresh, а в sessionStorage есть старое значение
 * — переносим в localStorage и удаляем из sessionStorage.
 * Это сохраняет сессии пользователей, обновивших приложение.
 */
function migrateRefreshToken(): string | null {
  const local = readLocalStorage(REFRESH_STORAGE_KEY);
  if (local) return local;
  const session = readSessionStorage(REFRESH_STORAGE_KEY);
  if (session) {
    writeLocalStorage(REFRESH_STORAGE_KEY, session);
    writeSessionStorage(REFRESH_STORAGE_KEY, null);
    return session;
  }
  return null;
}

/** Модульный refresh-токен (localStorage), вне React-состояния. */
let refreshToken: string | null = migrateRefreshToken();

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
          // Дополнительно чистим sessionStorage (миграция могла оставить хвост).
          writeSessionStorage(REFRESH_STORAGE_KEY, null);
        }
      },

      setSession: (tokens, user) => {
        refreshToken = tokens.refreshToken;
        writeLocalStorage(REFRESH_STORAGE_KEY, tokens.refreshToken);
        set({ accessToken: tokens.accessToken, user });
      },

      clearSession: () => {
        refreshToken = null;
        writeLocalStorage(REFRESH_STORAGE_KEY, null);
        set({ accessToken: null, user: null });
        // zustand persist после set() выше синхронно пишет в localStorage ключ
        // xtracker.auth = {"state":{accessToken:null,user:null},"version":0}.
        // QA-приём (T8-S2): после logout ни в localStorage, ни в sessionStorage
        // не должно остаться ни одного ключа с префиксом xtracker.* — гасим
        // persist-ключ сразу после записи. clearStorage() вызывается только в
        // runtime (clearSession), не на init/гидрации. Побочно: при следующем
        // login/write persist и migrateRefreshToken() создадут ключи заново — ок.
        useAuthStore.persist.clearStorage();
      },
    }),
    {
      name: AUTH_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Refresh хранится отдельно в localStorage (ключ xtracker.refresh),
      // не в zustand persist — чтобы не дублировать и контролировать миграцию.
      partialize: (state) => ({ accessToken: state.accessToken, user: state.user }),
      // При гидрации: если access-токен протухает (< 60с) — проактивно рефрешим
      // ДО того, как react-query запросы начнут уходить (избегаем 401+retry).
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken && isTokenExpiring(state.accessToken)) {
          // Запускаем refresh асинхронно, не блокируя рендер.
          // api.ts.sendWithRefresh тоже проверит isTokenExpiring перед первым запросом.
          void refreshAccessToken();
        }
      },
    },
  ),
);

// Адаптер для api.ts (разрывает циклический импорт store <-> api).
setAuthAdapter({
  getAccessToken: () => useAuthStore.getState().accessToken,
  getRefreshToken: () => refreshToken,
  applyRefreshedTokens: ({ accessToken, refreshToken: nextRefreshToken }) => {
    refreshToken = nextRefreshToken;
    writeLocalStorage(REFRESH_STORAGE_KEY, nextRefreshToken);
    useAuthStore.setState({ accessToken });
  },
  onSessionExpired: () => useAuthStore.getState().clearSession(),
});
