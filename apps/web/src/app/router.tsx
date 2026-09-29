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
const PartnerList = lazy(() => import('../pages/partners/PartnerList'));
const PartnerDetail = lazy(() => import('../pages/partners/PartnerDetail'));
const PositionCatalog = lazy(() => import('../pages/PositionCatalog'));
const Wishlist = lazy(() => import('../pages/Wishlist'));
const StatisticsOverview = lazy(() => import('../pages/StatisticsOverview'));
const PeriodTracker = lazy(() => import('../pages/PeriodTracker'));
const GroupCalendarManager = lazy(() => import('../pages/GroupCalendarManager'));
const Settings = lazy(() => import('../pages/Settings'));
const NotFound = lazy(() => import('../pages/NotFound'));

function FullPageLoader(): ReactElement {
  return (
    <div
      role="status"
      aria-label="Загрузка"
      className="flex min-h-dvh items-center justify-center bg-surface text-sm text-slate-400"
    >
      Загрузка…
    </div>
  );
}

/**
 * Маршрутизация v6.
 * - Публичные: /login, /register, /2fa (заглушки, наполнит S5).
 * - Приватные: всё под RequireAuth + Layout (нижний таб-бар / сайдбар).
 * - 401 -> api.ts: refresh -> retry -> clearSession -> RequireAuth -> /login.
 */
export default function AppRouter(): ReactElement {
  return (
    <BrowserRouter>
      <Suspense fallback={<FullPageLoader />}>
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
              <Route path="partners" element={<PartnerList />} />
              <Route path="partners/:id" element={<PartnerDetail />} />
              <Route path="positions" element={<PositionCatalog />} />
              <Route path="wishlist" element={<Wishlist />} />
              <Route path="statistics" element={<StatisticsOverview />} />
              <Route path="periods" element={<PeriodTracker />} />
              <Route path="group-calendars" element={<GroupCalendarManager />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
