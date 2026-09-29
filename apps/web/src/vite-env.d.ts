/// <reference types="vite/client" />

/** Переменные окружения фронтенда (VITE_*). */
interface ImportMetaEnv {
  /** Базовый URL API. Пустая строка = относительные /api (тот же origin). */
  readonly VITE_API_URL?: string;
}
