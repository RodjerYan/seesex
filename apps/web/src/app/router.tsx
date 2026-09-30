import { lazy, Suspense, type ReactElement } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import Layout from './Layout';
import { RequireAuth } from './RequireAuth';

/** Все страницы — lazy-чанки (спека: Lazy loading для всех маршрутов). */
const Login = lazy(() => import('../pages/Login'));
const Register = lazy(() => import('../pages/Register'));
const TwoFactor = lazy(() => import('../pages/TwoFactor'));
const Dashboard = lazy(() => import('../pages/Dashboard'));
const EventList = lazy(() => import('../pages/events/EventList'));
const EventCreate = lazy(() => import('../pages/events/EventCreate'));
const EventDetail = lazy(() => import('../pages/events/EventDetail'));
const EventEdit = lazy(() => import('../pages/events/EventEdit'));
const PartnerList = lazy(() => import('../pages/partners/PartnerList'));
const PartnerCreate = lazy(() => import('../pages/partners/PartnerCreate'));
const PartnerDetail = lazy(() => import('../pages/partners/PartnerDetail'));
const PartnerEdit = lazy(() => import('../pages/partners/PartnerEdit'));
const PositionCatalog = lazy(() => import('../pages/PositionCatalog'));
const PositionDetail = lazy(() => import('../pages/PositionDetail'));
const Wishlist = lazy(() => import('../pages/Wishlist'));
const StatisticsOverview = lazy(() => import('../pages/StatisticsOverview'));
const StatisticsCustom = lazy(() => import('../pages/StatisticsCustom'));
const PeriodTracker = lazy(() => import('../pages/PeriodTracker'));
const GroupCalendarManager = lazy(() => import('../pages/GroupCalendarManager'));
const GroupCalendarView = lazy(() => import('../pages/GroupCalendarView'));
const Settings = lazy(() => import('../pages/Settings'));
const NotFound = lazy(() => import('../pages/NotFound'));

/**
 * Fallback внешнего Suspense — только публичные маршруты (/login, /register, /2fa, *),
 * которые лежат вне Layout. Компактный блок по центру на ambient-фоне body,
 * без fullscreen-заливки bg-surface (иначе — чёрный экран).
 */
function RouteLoadingFallback(): ReactElement {
  return (
    <div
      role="status"
      aria-label="Загрузка"
      className="flex min-h-[50vh] items-center justify-center px-4"
    >
      <div className="inline-flex items-center gap-3 glass rounded-3xl px-6 py-5 text-sm text-slate-400">
        <svg className="animate-spin h-5 w-5 text-primary" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
          <circle className="opacity-75" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="30 60" strokeLinecap="round" />
        </svg>
        Загрузка…
      </div>
    </div>
  );
}

/**
 * Маршрутизация v6.
 * - Публичные: /login, /register, /2fa (заглушки, наполнит S5).
 * - Приватные: всё под RequireAuth + Layout (нижний таб-бар / сайдбар).
 * - 401 -> api.ts: refresh -> retry -> clearSession -> RequireAuth -> /login.
 * - Внешний Suspense ловит только маршруты вне Layout (иначе React уронит
 *   ошибку на suspended lazy); приватные страницы гасит собственный Suspense
 *   вокруг <Outlet/> внутри Layout — шапка/таб-бар/ambient при этом видны.
 * - PageTransitionOutlet удалён как мёртвый код: нигде не использовался
 *   (page-in-keyframes продолжают применяться в SecurityLock).
 */
export default function AppRouter(): ReactElement {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/2fa" element={<TwoFactor />} />

          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="events" element={<EventList />} />
              <Route path="events/new" element={<EventCreate />} />
              <Route path="events/:id" element={<EventDetail />} />
              <Route path="events/:id/edit" element={<EventEdit />} />
              <Route path="partners" element={<PartnerList />} />
              <Route path="partners/new" element={<PartnerCreate />} />
              <Route path="partners/:id" element={<PartnerDetail />} />
              <Route path="partners/:id/edit" element={<PartnerEdit />} />
              <Route path="positions" element={<PositionCatalog />} />
              <Route path="positions/:id" element={<PositionDetail />} />
              <Route path="wishlist" element={<Wishlist />} />
              <Route path="statistics" element={<StatisticsOverview />} />
              <Route path="statistics/custom" element={<StatisticsCustom />} />
              <Route path="periods" element={<PeriodTracker />} />
              <Route path="group-calendars" element={<GroupCalendarManager />} />
              <Route path="group-calendars/:id" element={<GroupCalendarView />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}