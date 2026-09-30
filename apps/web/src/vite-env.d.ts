/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Переменные окружения фронтенда (VITE_*). */
interface ImportMetaEnv {
  /** Базовый URL API. Пустая строка = относительные /api (тот же origin). */
  readonly VITE_API_URL?: string;
}
