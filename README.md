# xTracker — веб-PWA клон интимного трекера

Монорепозиторий (npm workspaces): Express + TypeScript + Prisma + PostgreSQL 15 backend,
React 18 + Vite PWA frontend, деплой всего на **Render** (web service + PostgreSQL + Disk).

## Структура

```
.
├── apps/
│   ├── api/                # Express + TypeScript + Prisma
│   │   ├── prisma/
│   │   │   ├── schema.prisma        # все модели + связи + индексы
│   │   │   ├── seed.ts              # сид-данные
│   │   │   └── migrations/          # SQL-миграции
│   │   └── src/            # controllers/services/middleware/routes (S2/S3)
│   └── web/                # React 18 + Vite PWA (S4/S5 наполнят экранами)
├── packages/
│   └── shared/             # общие типы и константы api/web
├── docker-compose.yml      # PostgreSQL 15 для локальной разработки
├── render.yaml             # Render Blueprint (web service + db + disk)
├── tsconfig.base.json      # strict: true для всех пакетов
└── package.json            # workspaces + dev/build/lint scripts
```

## Локальный запуск

```bash
# 1. PostgreSQL 15
docker compose up -d

# 2. Переменные окружения
cp .env.example apps/api/.env        # заполните JWT_SECRET / ENCRYPTION_KEY!

# 3. Зависимости (workspaces ставят всё из корня)
npm install

# 4. Миграции + сид-данные
npm run db:deploy -w apps/api        # применить migrations/
npm run db:seed -w apps/api          # либо: npx prisma db seed (в apps/api)

# 5. Разработка (api :3000 + web :5173, web проксирует /api -> api)
npm run dev

# Прочее
npm run build        # api (tsc) + web (vite build)
npm run lint         # ESLint
npm run format       # Prettier
npm run typecheck    # tsc --noEmit во всех пакетах
```

> При первой разработке вместо `db:deploy` можно создать миграцию из схемы:
> `npm run db:migrate -w apps/api` (требует запущенной БД).
> В репозитории уже лежит `apps/api/prisma/migrations/0001_init/migration.sql`,
> сгенерированный через `prisma migrate diff` (БД на момент инициализации была недоступна).

## Схема данных (Prisma / PostgreSQL 15)

Основные модели из ТЗ: `User` (lock/2FA-настройки), `Event`, `Partner`,
`Wishlist`, `GroupCalendar` — плюс связи: `Profile`, `Session`, `RefreshToken`,
`Mood`, `Place`, `Accessory`, `PeriodTracking`,
`PeriodEntry`, `GroupCalendarMember`.

Ключевые индексы: `Event(userId, date)`, `Event(groupCalendarId, date)`,
`User.email` (unique), `GroupCalendar.inviteCode` (unique),
`GroupCalendarMember(groupCalendarId, userId)` (unique).

## Деплой на Render

1. Залейте репозиторий в GitHub, подключите его в Render как **Blueprint**
   (Render сам прочитает `render.yaml`).
2. Создадутся:
   - web service `xtracker-web` (Node, plan starter),
   - PostgreSQL `xtracker-db` (plan starter, db `xtracker`),
   - env-переменные: `DATABASE_URL` подтянется из базы,
     `JWT_SECRET` и `ENCRYPTION_KEY` Render сгенерирует сам.
3. Проверьте вручную в настройках сервиса:
   - `FRONTEND_URL` / `ALLOWED_ORIGINS` — домен сервиса
     (`https://xtracker-web.onrender.com`),
   - rate-limit — уже прописан в blueprint.
4. Build: `cd apps/api && npm install && npm run build && cd ../web && npm install &&
npm run build && cp -r ../web/dist ./public`
   Start: `cd apps/api && npm start` — статика web отдаётся из `apps/api/public`.
5. Первый деплой: выполните миграции и сид
   (Render Shell → `npx prisma migrate deploy && npx prisma db seed` в `apps/api`).

CI/CD: GitHub → Render, авто-деплой при пуше в `main`.

## Безопасность / приватность

- `.env` в git не попадает (см. `.gitignore`); секреты — только в env/Render Secrets.
- Пароли — bcrypt (12 раундов), JWT access 15m / refresh 7d, TOTP 2FA.
- Чувствительные поля — AES-256-GCM (`ENCRYPTION_KEY`).
