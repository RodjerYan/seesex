/**
 * HTTP-клиент API.
 *
 * Возможности:
 * - Bearer access-токен из auth-store;
 * - авто-refresh при 401: один POST /api/auth/refresh на очередь параллельных
 *   запросов, после чего исходный запрос повторяется ОДИН раз;
 * - типизированные ошибки (`ApiError`) с code/status из формата бэкенда.
 */

const RAW_BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001') as string;
/** '' (пустая строка) = относительные пути /api (тот же origin, прод-режим). */
export const API_BASE_URL = RAW_BASE_URL.replace(/\/+$/, '');

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Тело ошибки бэкенда: { error: { code, message } } (см. @xtracker/shared ApiError). */
interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

/** Типизированная ошибка запроса. status=0 — сетевая ошибка (offline и т.п.). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

/**
 * Адаптер токенов: реализуется auth-store, чтобы api.ts не зависел от store
 * (иначе циклический импорт store <-> api).
 */
export interface AuthAdapter {
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  /** Применить новую пару токенов после успешного refresh. */
  applyRefreshedTokens(tokens: { accessToken: string; refreshToken: string }): void;
  /** Сессия истекла (refresh не удался) — локальный logout без сети. */
  onSessionExpired(): void;
}

let authAdapter: AuthAdapter | null = null;

/** Регистрируется auth-store при загрузке модуля. */
export function setAuthAdapter(adapter: AuthAdapter): void {
  authAdapter = adapter;
}

/** Очередь: все параллельные 401 ждут ОДИН refresh. */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!authAdapter) return false;
  const refreshToken = authAdapter.getRefreshToken();
  if (!refreshToken) return false;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!response.ok) return false;
        const data = (await response.json()) as { accessToken?: string; refreshToken?: string };
        if (!data.accessToken || !data.refreshToken) return false;
        authAdapter?.applyRefreshedTokens({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        });
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

export interface RequestOptions {
  method?: HttpMethod;
  /** JSON-тело (сериализуется автоматически). */
  body?: unknown;
  /** Query-параметры (undefined/null пропускаются). */
  query?: Record<string, string | number | boolean | null | undefined>;
  /** Bearer-авторизация (по умолчанию true). */
  auth?: boolean;
  headers?: HeadersInit;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    params.append(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}${url.includes('?') ? '&' : '?'}${qs}` : url;
}

async function toApiError(response: Response): Promise<ApiError> {
  let code = `HTTP_${response.status}`;
  let message = response.statusText || `Request failed with status ${response.status}`;
  try {
    const data = (await response.json()) as ApiErrorBody;
    if (data.error?.code) code = data.error.code;
    if (data.error?.message) message = data.error.message;
  } catch {
    // Тело не JSON — оставляем статус-текст.
  }
  return new ApiError(response.status, code, message);
}

/** Базовый запрос с авторизацией и однократным auto-refresh при 401. */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    query,
    auth = true,
    headers,
    signal,
  } = options;
  const url = buildUrl(path, query);

  const send = (token: string | null): Promise<Response> => {
    const finalHeaders = new Headers(headers);
    finalHeaders.set('Accept', 'application/json');
    if (body !== undefined) finalHeaders.set('Content-Type', 'application/json');
    if (auth && token) finalHeaders.set('Authorization', `Bearer ${token}`);
    return fetch(url, {
      method,
      headers: finalHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  };

  let response = await send(auth ? authAdapter?.getAccessToken() ?? null : null);

  if (response.status === 401 && auth) {
    const refreshed = await refreshSession();
    if (refreshed) {
      // Однократный retry с новым access-токеном.
      response = await send(authAdapter?.getAccessToken() ?? null);
    } else {
      authAdapter?.onSessionExpired();
      throw await toApiError(response);
    }
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Короткие обёртки HTTP-методов. */
export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> =>
    request<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> =>
    request<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> =>
    request<T>(path, { ...options, method: 'DELETE' }),
};

/** Явное обновление токенов (используется auth-store.refresh()). */
export const refreshAccessToken = refreshSession;
