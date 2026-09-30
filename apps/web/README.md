# @xtracker/web — React PWA (xTracker)

Каркас **S4**: Vite + React 18 + TypeScript (strict) + Tailwind CSS v3 + React Router v6 +
Zustand + TanStack Query + vite-plugin-pwa. Наполнение страниц — **S5**.

## Команды

```bash
npm run dev -w apps/web     # dev-сервер: http://127.0.0.1:5173 (прокси /api -> http://localhost:3001)
npm run build -w apps/web   # tsc --noEmit && vite build (в сборку входят manifest.webmanifest + sw.js)
npm run typecheck -w apps/web
npm run icons -w apps/web   # регенерация PWA-иконок (scripts/generate-icons.mjs, чистый Node)
```

## Структура

```
src/
  app/          # router.tsx (lazy-маршруты), Layout.tsx (header + таб-бар/сайдбар), RequireAuth.tsx
  components/   # ui/ — общие компоненты (PageStub — страница-заглушка S4)
  lib/          # api.ts (fetch-клиент), queryClient.ts, queries/ (useHealth, useMe)
  pages/        # страницы-заглушки (наполнит S5)
  stores/       # auth.store.ts (Zustand)
  types/        # доменные типы (базовые — реэкспорт @xtracker/shared)
public/icons/   # icon-192/512, icon-maskable, apple-touch-icon (PNG)
```

## API

- Базовый URL: `import.meta.env.VITE_API_URL`, по умолчанию `http://localhost:3001`.
  Пустая строка (`VITE_API_URL=`) = относительные пути `/api` (тот же origin — прод-режим,
  когда статику раздаёт Express).
- Все защищённые запросы: `Authorization: Bearer <accessToken>`.
- **401 → auto-refresh → retry**: `POST /api/auth/refresh` выполняется один раз на всю
  очередь параллельных запросов, после чего исходный запрос повторяется один раз;
  если refresh не удался — локальный logout (clearSession) и редирект на `/login`.
- Ошибки типизированы: `ApiError { status, code, message }`.

## Токены (решение по хранению)

| Токен | Хранилище | Ключ | Почему |
| --- | --- | --- | --- |
| `accessToken` + `user` | `localStorage` | `xtracker.auth` | Переживает перезагрузку; access живёт 15 минут, потери минимальны. |
| `refreshToken` | `localStorage` | `xtracker.refresh` | Переживает закрытие браузера/приложения — пользователь не вводит логин/пароль повторно. Миграция из старого `sessionStorage` выполняется автоматически при загрузке. |

Почему не `sessionStorage` для refresh: там он исчезал при закрытии вкладки/браузера, заставляя логиниться снова. Почему не httpOnly-cookie: API принимает refresh только в теле запроса (`{ refreshToken }`), cookie-flow в бэкенде не реализован (вне скоупа).

**Оставшийся риск:** XSS в SPA может прочитать оба токена (доступны из JS). Митигации:
короткий TTL access (15 мин), helmet/CSP на бэке, отсутствие стороннего JS. Идеал —
перевести refresh на httpOnly `Secure` cookie (задача отдельного этапа).

## PWA

- `manifest.webmanifest` генерирует vite-plugin-pwa из `vite.config.ts` (name/short_name,
  standalone, `#0f172a` / `#6366f1`, `lang: ru-RU`, иконки 192/512/maskable).
- Service worker: `registerType: autoUpdate`, precache `**/*.{js,css,html,ico,png,svg,woff2}`,
  runtime-caching **NetworkFirst** для относительного паттерна `*/api/*`
  (cacheName `api-cache`, 100 записей / 86400 с) — НЕ привязан к `api.xtracker.app`,
  т.к. деплой одиночный (API и статика с одного origin).
- Safe-area: CSS-переменные `--sat/--sab/--sal/--sar` из `env(safe-area-inset-*)`
  применяются в `.app-header/.app-main/.app-tabbar/.app-sidebar` (см. `src/index.css`).

## TODO S5

- Формы login/register/2FA (`react-hook-form` + `zod` уже подключены), `useMe` переключить
  на `GET /api/auth/me`, когда бэкенд добавит эндпоинт.
- Наполнение всех страниц, календарь, каталоги, статистика.
